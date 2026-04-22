/**
 * IPC Handlers — all ipcMain.handle() and ipcMain.on() registrations.
 * Task 11: Full channel implementation with zod validation (IPC-SEC-01).
 *
 * Requirements: ARCH-01, ARCH-05, Req 1.1, Req 2.1, Req 2.2, Req 12.3, Req 13.4, Req 15.1
 */

import { ipcMain, dialog, shell, app, type BrowserWindow, type OpenDialogOptions } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { Logger } from './logger'
import { getSettingsStore } from './settings-store'
import { getPacketBuffer } from './packet-buffer'
import { getCaptureEngine } from './capture'
import { Parser } from './parser'
import { Anonymizer } from './anonymizer'
import {
  validateOrThrow,
  CaptureStartSchema,
  CaptureStartSimulatedSchema,
  PcapStartFileSchema,
  BufferSetCapacitySchema,
  SettingsPatchSchema,
  FilterApplySchema
} from './ipc-schemas'
import type {
  AnonPacket,
  ImportResult,
  ExportResult,
  Settings
} from '../shared/capture-types'
import type { InterfaceResult } from '../shared/ipc-types'
import { parse, evaluate } from './filter-engine'

const PCAP_OPEN_DIALOG_FILTERS: Array<{ name: string; extensions: string[] }> = [
  { name: 'PCAP Files', extensions: ['pcap', 'pcapng'] },
  { name: 'All Files', extensions: ['*'] }
]
const PARENTED_DIALOG_TIMEOUT_MS = 8000

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage))
    }, timeoutMs)

    promise.then(
      (value) => {
        clearTimeout(timeoutId)
        resolve(value)
      },
      (error) => {
        clearTimeout(timeoutId)
        reject(error)
      }
    )
  })
}

function buildPcapOpenDialogOptions(title: string): OpenDialogOptions {
  return {
    title,
    filters: [...PCAP_OPEN_DIALOG_FILTERS],
    properties: ['openFile']
  }
}

function canAttachDialogToWindow(win: BrowserWindow | null): win is BrowserWindow {
  return Boolean(win && !win.isDestroyed() && win.isVisible())
}

async function showPcapOpenDialog(
  getWindow: () => BrowserWindow | null,
  title: string
): Promise<Electron.OpenDialogReturnValue> {
  const options = buildPcapOpenDialogOptions(title)
  const win = getWindow()

  // Windows can intermittently leave parented dialogs unresolved in some setups.
  // Use detached dialogs there and retain parented dialogs on other platforms.
  if (process.platform === 'win32' || !canAttachDialogToWindow(win)) {
    return dialog.showOpenDialog(options)
  }

  try {
    return await withTimeout(
      dialog.showOpenDialog(win, options),
      PARENTED_DIALOG_TIMEOUT_MS,
      `Parented open dialog timed out after ${PARENTED_DIALOG_TIMEOUT_MS}ms`
    )
  } catch (err) {
    Logger.warn('IPC', 'Parented open dialog failed; retrying detached dialog', {
      title,
      error: err instanceof Error ? err.message : String(err)
    })
    return dialog.showOpenDialog(options)
  }
}

async function importPcapFromResolvedPath(filePath: string): Promise<ImportResult> {
  const resolvedPath = path.resolve(filePath)

  try {
    await fs.promises.access(resolvedPath, fs.constants.R_OK)
  } catch {
    return { ok: false, error: 'File not accessible or does not exist' }
  }

  const stats = await fs.promises.stat(resolvedPath)
  if (!stats.isFile()) {
    return { ok: false, error: 'Path is not a file' }
  }

  const engine = getCaptureEngine()
  const buffer = getPacketBuffer()

  // Import replaces the current buffer with the selected capture.
  buffer.clear()
  await engine.importFile(resolvedPath)

  return {
    ok: true,
    packetCount: buffer.size,
    fileSizeBytes: stats.size
  }
}

/**
 * Register all IPC handlers. Called once during app initialization.
 * IPC-SEC-01: all payloads are validated with zod before processing.
 * BUGFIX-03: accepts a live getter () => BrowserWindow | null instead of a snapshot.
 * @param getWindow - Live getter for the main BrowserWindow, passed to all dialog calls so they appear attached to the app window.
 */
export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  Logger.info('IPC', 'Registering IPC handlers')

  // ─── Capture control ────────────────────────────────────────────────────────

  ipcMain.handle('capture:getInterfaces', async (): Promise<InterfaceResult> => {
    try {
      Logger.debug('IPC', 'capture:getInterfaces invoked')
      const result = await getCaptureEngine().getInterfaces()
      if (result.ok) {
        Logger.info('IPC', 'capture:getInterfaces succeeded', {
          count: result.interfaces.length
        })
      } else {
        Logger.warn('IPC', 'capture:getInterfaces failed', {
          error: result.error,
          diagnostic: result.diagnostic ?? 'n/a'
        })
      }
      return result
    } catch (err) {
      Logger.error('IPC', 'capture:getInterfaces failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to enumerate interfaces'
      }
    }
  })

  ipcMain.handle('capture:start', async (_event, iface: string): Promise<void> => {
    try {
      validateOrThrow(CaptureStartSchema, { iface })
      Logger.info('IPC', 'capture:start invoked', { iface })

      await getCaptureEngine().startCapture(iface)

      Logger.info('IPC', 'capture:start succeeded', { iface })
      // BUGFIX-03: NO handler-side status push — status is pushed exclusively from
      // engine event listeners in main/index.ts
    } catch (err) {
      Logger.error('IPC', 'capture:start failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  })

  ipcMain.handle('capture:stop', async (): Promise<void> => {
    try {
      Logger.info('IPC', 'capture:stop invoked')

      await getCaptureEngine().stopCapture()

      Logger.info('IPC', 'capture:stop succeeded')
      // 'stopped' state is pushed via engine.on('stopped') in main/index.ts
    } catch (err) {
      Logger.error('IPC', 'capture:stop failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  })

  ipcMain.handle(
    'capture:startSimulated',
    async (_event, payload: { path: string; speed: number }): Promise<void> => {
      try {
        const validated = validateOrThrow(CaptureStartSimulatedSchema, payload)
        Logger.info('IPC', 'capture:startSimulated invoked', {
          path: validated.path,
          speed: validated.speed
        })

        // FILE-SEC-01: validate path
        const resolvedPath = path.resolve(validated.path)

        // Check file exists and is accessible
        try {
          await fs.promises.access(resolvedPath, fs.constants.R_OK)
        } catch {
          throw new Error('File not accessible or does not exist')
        }

        // Get file stats and verify it's a file (not directory)
        const stats = await fs.promises.stat(resolvedPath)
        if (!stats.isFile()) {
          throw new Error('Path is not a file')
        }

        // Call CaptureEngine.startSimulated with validated path and speed
        await getCaptureEngine().startSimulated(resolvedPath, validated.speed)

        Logger.info('IPC', 'capture:startSimulated succeeded', {
          path: resolvedPath,
          speed: validated.speed
        })
        // BUGFIX-03: NO handler-side status push — status is pushed exclusively from
        // engine event listeners in main/index.ts
      } catch (err) {
        Logger.error('IPC', 'capture:startSimulated failed', {
          error: err instanceof Error ? err.message : String(err)
        })
        throw err
      }
    }
  )

  // ─── PCAP import/export ─────────────────────────────────────────────────────

  ipcMain.handle(
    'pcap:selectFile',
    async (): Promise<{ ok: true; path: string } | { ok: false }> => {
      try {
        Logger.debug('IPC', 'pcap:selectFile invoked')

        const result = await showPcapOpenDialog(getWindow, 'Select PCAP File')

        if (result.canceled || result.filePaths.length === 0) {
          Logger.debug('IPC', 'pcap:selectFile cancelled by user')
          return { ok: false }
        }

        const filePath = result.filePaths[0]!
        Logger.info('IPC', 'pcap:selectFile succeeded', { path: filePath })

        // Return path only - don't load or stream file
        // FILE-SEC-01 validation happens in capture:startSimulated
        return { ok: true, path: filePath }
      } catch (err) {
        Logger.error('IPC', 'pcap:selectFile failed', {
          error: err instanceof Error ? err.message : String(err)
        })
        return { ok: false }
      }
    }
  )

  ipcMain.handle('pcap:import', async (): Promise<ImportResult> => {
    try {
      Logger.debug('IPC', 'pcap:import invoked')

      const result = await showPcapOpenDialog(getWindow, 'Import PCAP File')

      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, error: 'User canceled' }
      }

      const filePath = result.filePaths[0]!
      Logger.info('IPC', 'pcap:import file selected', { path: filePath })

      const importResult = await importPcapFromResolvedPath(filePath)
      if (importResult.ok) {
        Logger.info('IPC', 'pcap:import complete', {
          packetCount: importResult.packetCount ?? 0,
          fileSizeBytes: importResult.fileSizeBytes ?? 0
        })
      }
      return importResult
    } catch (err) {
      Logger.error('IPC', 'pcap:import failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  })

  ipcMain.handle('pcap:importFromPath', async (_event, filePath: string): Promise<ImportResult> => {
    try {
      const validated = validateOrThrow(PcapStartFileSchema, { path: filePath })
      Logger.info('IPC', 'pcap:importFromPath invoked', { path: validated.path })

      const importResult = await importPcapFromResolvedPath(validated.path)
      if (importResult.ok) {
        Logger.info('IPC', 'pcap:importFromPath complete', {
          packetCount: importResult.packetCount ?? 0,
          fileSizeBytes: importResult.fileSizeBytes ?? 0
        })
      }
      return importResult
    } catch (err) {
      Logger.error('IPC', 'pcap:importFromPath failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  })
  ipcMain.handle('pcap:startFile', async (_event, filePath: string): Promise<void> => {
    try {
      validateOrThrow(PcapStartFileSchema, { path: filePath })
      Logger.info('IPC', 'pcap:startFile invoked', { path: filePath })

      // FILE-SEC-01: Path hardening
      const resolvedPath = path.resolve(filePath)
      
      // Check file exists
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`File not found: ${filePath}`)
      }
      
      // Check it's a file, not a directory
      const stats = fs.statSync(resolvedPath)
      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${filePath}`)
      }
      
      // Check file is readable
      try {
        fs.accessSync(resolvedPath, fs.constants.R_OK)
      } catch {
        throw new Error(`File is not readable: ${filePath}`)
      }

      const engine = getCaptureEngine()
      await engine.startFile(resolvedPath)
    } catch (err) {
      Logger.error('IPC', 'pcap:startFile failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  })

  ipcMain.handle('pcap:export', async (): Promise<ExportResult> => {
    try {
      Logger.debug('IPC', 'pcap:export invoked')

      const win = getWindow()
      const result = await (win
        ? dialog.showSaveDialog(win, {
            title: 'Export PCAP File',
            defaultPath: `netvis-capture-${Date.now()}.pcap`,
            filters: [{ name: 'PCAP Files', extensions: ['pcap'] }]
          })
        : dialog.showSaveDialog({
            title: 'Export PCAP File',
            defaultPath: `netvis-capture-${Date.now()}.pcap`,
            filters: [{ name: 'PCAP Files', extensions: ['pcap'] }]
          }))

      if (result.canceled || !result.filePath) {
        return { ok: false, error: 'User canceled' }
      }

      const filePath = result.filePath
      Logger.info('IPC', 'pcap:export file selected', { path: filePath })

      // Write to temp file first, then atomic rename on success (Req 8.3)
      const tempPath = `${filePath}.tmp`
      const buffer = getPacketBuffer()
      const packets = buffer.getAll()

      if (packets.length === 0) {
        return { ok: false, error: 'No packets to export' }
      }

      try {
        // Write PCAP global header (24 bytes, little-endian)
        const globalHeader = Buffer.allocUnsafe(24)
        globalHeader.writeUInt32LE(0xa1b2c3d4, 0) // magic number
        globalHeader.writeUInt16LE(2, 4) // version major
        globalHeader.writeUInt16LE(4, 6) // version minor
        globalHeader.writeInt32LE(0, 8) // thiszone (GMT)
        globalHeader.writeUInt32LE(0, 12) // sigfigs
        globalHeader.writeUInt32LE(65535, 16) // snaplen
        globalHeader.writeUInt32LE(1, 20) // network (LINKTYPE_ETHERNET)

        await fs.promises.writeFile(tempPath, globalHeader)

        // Write each packet record via Parser.print()
        for (const parsedPacket of packets) {
          if (!parsedPacket.rawData) {
            Logger.warn('IPC', 'pcap:export skipping packet with no rawData', {
              id: parsedPacket.id
            })
            continue
          }
          const record = Parser.print(parsedPacket)
          await fs.promises.appendFile(tempPath, record)
        }

        // Atomic rename on success
        await fs.promises.rename(tempPath, filePath)

        Logger.info('IPC', 'pcap:export complete', { path: filePath, packetCount: packets.length })
        return { ok: true }
      } catch (writeErr) {
        // Clean up temp file on failure
        try {
          await fs.promises.unlink(tempPath)
        } catch {
          // Ignore cleanup errors
        }
        throw writeErr
      }
    } catch (err) {
      Logger.error('IPC', 'pcap:export failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  })

  // ─── Buffer management ──────────────────────────────────────────────────────

  ipcMain.handle('buffer:clear', async (): Promise<void> => {
    try {
      Logger.info('IPC', 'buffer:clear invoked')

      getPacketBuffer().clear()

      Logger.info('IPC', 'buffer:clear succeeded')
      // PacketBuffer.clear() already emits 'change' event
    } catch (err) {
      Logger.error('IPC', 'buffer:clear failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  })

  ipcMain.handle('buffer:setCapacity', async (_event, capacity: number): Promise<void> => {
    try {
      validateOrThrow(BufferSetCapacitySchema, { capacity })
      Logger.info('IPC', 'buffer:setCapacity invoked', { capacity })

      getPacketBuffer().setCapacity(capacity)

      Logger.info('IPC', 'buffer:setCapacity succeeded', { capacity })
      // PacketBuffer.setCapacity() emits 'change' event
    } catch (err) {
      Logger.error('IPC', 'buffer:setCapacity failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  })

  ipcMain.handle('buffer:getAll', async (): Promise<AnonPacket[]> => {
    try {
      Logger.debug('IPC', 'buffer:getAll invoked')
      const buffer = getPacketBuffer()
      const allParsed = buffer.getAll()
      // Anonymize before sending to renderer (ARCH-04)
      const allAnon = allParsed.map((p) => Anonymizer.anonymize(p))
      return allAnon
    } catch (err) {
      Logger.error('IPC', 'buffer:getAll failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  })

  // ─── Filter ─────────────────────────────────────────────────────────────────

  ipcMain.handle(
    'filter:apply',
    async (
      _event,
      payload: { expression: string }
    ): Promise<{ packets: AnonPacket[]; error: string | null }> => {
      try {
        const { expression } = validateOrThrow(FilterApplySchema, payload)
        Logger.debug('IPC', 'filter:apply invoked', { expression })

        // Empty expression — return all packets (anonymized)
        if (!expression.trim()) {
          const buffer = getPacketBuffer()
          const allParsed = buffer.getAll()
          const allAnon = allParsed.map((p) => Anonymizer.anonymize(p))
          return { packets: allAnon, error: null }
        }

        const result = parse(expression)
        if (!result.ok) {
          Logger.debug('IPC', 'filter:apply parse error', { error: result.error })
          return { packets: [], error: result.error }
        }

        const buffer = getPacketBuffer()
        const allParsed = buffer.getAll()

        // Anonymize once upfront
        const allAnon = allParsed.map((p) => Anonymizer.anonymize(p))

        // Filter AnonPacket[] - evaluate against already-anonymized packets
        const matched = allAnon.filter((anon) => evaluate(result.ast, anon))

        Logger.debug('IPC', 'filter:apply complete', {
          total: allParsed.length,
          matched: matched.length
        })

        // Return matched directly (already anonymized)
        return { packets: matched, error: null }
      } catch (err) {
        Logger.error('IPC', 'filter:apply failed', {
          error: err instanceof Error ? err.message : String(err)
        })
        return { packets: [], error: err instanceof Error ? err.message : 'Filter error' }
      }
    }
  )

  // ─── Settings ───────────────────────────────────────────────────────────────

  ipcMain.handle('settings:get', async (): Promise<Settings> => {
    try {
      Logger.debug('IPC', 'settings:get invoked')
      const store = getSettingsStore()
      return store.get()
    } catch (err) {
      Logger.error('IPC', 'settings:get failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  })

  ipcMain.handle('settings:set', async (_event, patch: Partial<Settings>): Promise<Settings> => {
    try {
      const validated = validateOrThrow(SettingsPatchSchema, patch)
      Logger.info('IPC', 'settings:set invoked', { fields: Object.keys(validated).join(', ') })
      const store = getSettingsStore()
      store.set(validated)
      return store.get()
    } catch (err) {
      Logger.error('IPC', 'settings:set failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  })

  // ─── Logging ────────────────────────────────────────────────────────────────

  ipcMain.handle('log:openFolder', async (): Promise<void> => {
    try {
      Logger.info('IPC', 'log:openFolder invoked')
      const logDir = app.getPath('userData')
      await shell.openPath(logDir)
    } catch (err) {
      Logger.error('IPC', 'log:openFolder failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  })

  Logger.info('IPC', 'All IPC handlers registered successfully')
}
