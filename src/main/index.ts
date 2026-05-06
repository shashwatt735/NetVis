import { app, shell, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initLogger, installUncaughtExceptionHandler, Logger } from './logger'
import { initSettingsStore, getSettingsStore } from './settings-store'
import { initPacketBuffer } from './packet-buffer'
import { initCaptureEngine } from './capture'
import { registerIpcHandlers } from './ipc-handlers'
import { createBufferStatsThrottler } from './buffer-stats-throttler'
import { resolveTitleBarTheme, titleBarWindowOptions } from './window-theme'
import type { BufferStats } from '../shared/capture-types'

// Dev-only cache mitigation for Chromium disk-cache corruption on local profiles.
if (is.dev) {
  app.commandLine.appendSwitch('disable-http-cache')
}

// Register uncaughtException handler as early as possible — before app is ready.
// Requirement: Req 13.2 — log exception type, message, and stack trace.
installUncaughtExceptionHandler()

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  Logger.debug('App', 'Creating main window')
  const titleBarTheme = resolveTitleBarTheme(getSettingsStore().get().theme)

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    ...titleBarWindowOptions(titleBarTheme),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // ARCH-01, ARCH-02: security baseline
      nodeIntegration: false,
      contextIsolation: true,
      // ARCH-03: no remote content
      allowRunningInsecureContent: false,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    Logger.info('App', 'Main window ready to show')
    mainWindow?.show()
  })

  // ARCH-03: deny all new window requests
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (is.dev && url.startsWith(process.env['ELECTRON_RENDERER_URL'] ?? '')) return
    event.preventDefault()
    shell.openExternal(url)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Initialize logger early — now safe because app is ready
  const logPath = join(app.getPath('userData'), 'netvis.log')
  initLogger(logPath, is.dev)
  Logger.info('Main', 'Application started', {
    version: app.getVersion(),
    platform: process.platform,
    isPackaged: app.isPackaged
  })

  // APP-SEC-01: Set up security policies before creating windows
  // Deny all permission requests (camera, microphone, notifications, etc.)
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false) // Deny all permissions
  })

  if (is.dev) {
    void session.defaultSession.clearCache().catch((err: unknown) => {
      Logger.warn('Main', 'Failed to clear renderer cache on startup', {
        error: err instanceof Error ? err.message : String(err)
      })
    })
  }

  // APP-SEC-01: Enforce CSP via webRequest in production
  // KNOWN ISSUE: webRequest.onHeadersReceived can cause NetworkService crashes on Windows
  // Root cause: Chromium bug in Electron 40.x on certain Windows configurations
  // Proper fix: Wait for Electron/Chromium upstream fix, or use alternative CSP method
  // Current approach: Try webRequest with error handling, fall back to webPreferences
  if (!is.dev) {
    try {
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        // Only apply CSP to local file:// protocol responses to minimize NetworkService load
        if (details.url.startsWith('file://')) {
          callback({
            responseHeaders: {
              ...details.responseHeaders,
              'Content-Security-Policy': [
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
              ]
            }
          })
        } else {
          callback({ responseHeaders: details.responseHeaders })
        }
      })
      Logger.info('App', 'CSP enforcement enabled via webRequest')
    } catch (err) {
      Logger.error('App', 'Failed to set up CSP via webRequest - falling back to webPreferences security', {
        error: err instanceof Error ? err.message : String(err)
      })
      // Fallback security is still strong:
      // - nodeIntegration: false
      // - contextIsolation: true  
      // - webSecurity: true
      // - setPermissionRequestHandler denies all permissions
      // - setWindowOpenHandler denies new windows
    }
  }

  // Initialize settings store
  initSettingsStore(app.getPath('userData'))

  // Initialize packet buffer with persisted capacity from settings (Req 12.1, Req 20.2)
  const settings = getSettingsStore().get()
  const buffer = initPacketBuffer(settings.bufferCapacity)

  // Initialize capture engine — wire it to send anonymized packets to renderer via IPC
  // The engine will also emit 'packet' events for buffer storage
  const engine = initCaptureEngine((packets) => mainWindow?.webContents.send('packet:batch', packets))

  // Wire engine to store ParsedPackets in buffer (before anonymization)
  engine.on('packet', (parsedPacket) => {
    buffer.push(parsedPacket)
  })

  // Wire capture:status push channel — error and stopped states
  engine.on('error', (err) => {
    mainWindow?.webContents.send('capture:status', {
      state: 'error',
      message: err.message,
      platformHint: err.platformHint
    })
  })
  engine.on('stopped', () => {
    // GAP-1: send 'stopped' first so the UI can show a brief stopped state,
    // then transition to 'idle' so the status bar and Start button are correct.
    mainWindow?.webContents.send('capture:status', { state: 'stopped' })
    setTimeout(() => {
      mainWindow?.webContents.send('capture:status', { state: 'idle' })
    }, 800)
  })
  // BUGFIX-03: authoritative status pushes for active/file/simulated — from engine events only
  engine.on('started-live', (iface: string) => {
    mainWindow?.webContents.send('capture:status', {
      state: 'active',
      iface,
      startedAt: Date.now()
    })
  })
  engine.on('started-file', (filePath: string) => {
    mainWindow?.webContents.send('capture:status', {
      state: 'file',
      path: filePath
    })
  })
  engine.on('started-simulated', (filePath: string, speed) => {
    mainWindow?.webContents.send('capture:status', {
      state: 'simulated',
      path: filePath,
      speed
    })
  })

  // Wire buffer:stats push channel with 500ms spacing-based throttling (Req 12.3, Req 14.2)
  // Ensures at least 500ms between emissions, not just a window
  const statsThrottler = createBufferStatsThrottler(
    (stats: BufferStats) => mainWindow?.webContents.send('buffer:stats', stats),
    500
  )

  buffer.on('change', () => {
    statsThrottler.handleChange({
      count: buffer.size,
      capacity: buffer.capacity,
      percentage: (buffer.size / buffer.capacity) * 100
    })
  })

  // Wire buffer:overflow push channel
  buffer.on('overflow', (dropped: number) => {
    mainWindow?.webContents.send('buffer:overflow', { dropped })
  })

  // Register all IPC handlers — BUGFIX-03: pass live getter instead of snapshot
  registerIpcHandlers(() => mainWindow)

  // Cleanup throttler on quit to avoid timer leaks
  app.on('before-quit', () => {
    statsThrottler.cleanup()
  })

  electronApp.setAppUserModelId('com.netvis.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  // BUG-1: push initial buffer stats once the renderer is ready so it shows
  // the correct persisted capacity (renderer default is hardcoded 10000)
  app.once('browser-window-created', () => {
    mainWindow?.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.send('buffer:stats', {
        count: buffer.size,
        capacity: buffer.capacity,
        percentage: (buffer.size / buffer.capacity) * 100
      })
    })
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  Logger.info('App', 'All windows closed')
  mainWindow = null
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
