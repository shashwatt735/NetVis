import { app, shell, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initLogger, installUncaughtExceptionHandler, Logger } from './logger'
import { initSettingsStore } from './settings-store'
import { registerIpcHandlers } from './ipc-handlers'

// Register uncaughtException handler as early as possible — before app is ready.
// Requirement: Req 13.2 — log exception type, message, and stack trace.
installUncaughtExceptionHandler()

function createWindow(): void {
  Logger.debug('App', 'Creating main window')

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
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
    mainWindow.show()
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

  // Initialize settings store
  initSettingsStore(app.getPath('userData'))

  // Register all IPC handlers
  registerIpcHandlers()

  electronApp.setAppUserModelId('com.netvis.app')

  // APP-SEC-01: enforce CSP via session header for all renderer responses
  // In dev, allow Vite HMR websocket; in production lock down connect-src to 'none'
  const scriptSrc = is.dev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self'"
  const connectSrc = is.dev
    ? "connect-src 'self' ws://localhost:5173 http://localhost:5173"
    : "connect-src 'none'"
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; ${connectSrc}`
        ]
      }
    })
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  Logger.info('App', 'All windows closed')
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
