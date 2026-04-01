/**
 * IPC Handlers — all ipcMain.handle() and ipcMain.on() registrations.
 * Task 11: Full channel implementation with zod validation (IPC-SEC-01).
 *
 * Requirements: ARCH-01, ARCH-05, Req 1.1, Req 2.1, Req 2.2, Req 12.3, Req 13.4, Req 15.1
 */

import { ipcMain, dialog, shell, app } from 'electron'
import { Logger } from './logger'
import { getSettingsStore } from './settings-store'
import {
  validateOrThrow,
  CaptureStartSchema,
  CaptureStartSimulatedSchema,
  PcapStartFileSchema,
  BufferSetCapacitySchema,
  SettingsPatchSchema
} from './ipc-schemas'
import type {
  NetworkInterface,
  AnonPacket,
  ImportResult,
  ExportResult,
  Settings
} from '../shared/capture-types'

/**
 * Register all IPC handlers. Called once during app initialization.
 * IPC-SEC-01: all payloads are validated with zod before processing.
 */
export function registerIpcHandlers(): void {
  Logger.info('IPC', 'Registering IPC handlers')

  // ─── Capture control ────────────────────────────────────────────────────────

  ipcMain.handle('capture:getInterfaces', async (): Promise<NetworkInterface[]> => {
    try {
      Logger.debug('IPC', 'capture:getInterfaces invoked')
      // TODO: implement in CaptureEngine (Task 5)
      // For now, return empty array as placeholder
      return []
    } catch (err) {
      Logger.error('IPC', 'capture:getInterfaces failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  })

  ipcMain.handle('capture:start', async (_event, iface: string): Promise<void> => {
    try {
      validateOrThrow(CaptureStartSchema, { iface })
      Logger.info('IPC', 'capture:start invoked', { iface })
      // TODO: implement in CaptureEngine (Task 5)
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
      // TODO: implement in CaptureEngine (Task 5)
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
        // TODO: implement in CaptureEngine (Task 5)
      } catch (err) {
        Logger.error('IPC', 'capture:startSimulated failed', {
          error: err instanceof Error ? err.message : String(err)
        })
        throw err
      }
    }
  )

  // ─── PCAP import/export ─────────────────────────────────────────────────────

  ipcMain.handle('pcap:import', async (): Promise<ImportResult> => {
    try {
      Logger.debug('IPC', 'pcap:import invoked')

      const result = await dialog.showOpenDialog({
        title: 'Import PCAP File',
        filters: [
          { name: 'PCAP Files', extensions: ['pcap', 'pcapng'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, error: 'User canceled' }
      }

      const filePath = result.filePaths[0]
      Logger.info('IPC', 'pcap:import file selected', { path: filePath })

      // TODO: implement file parsing and buffer population (Task 22)
      // For now, return placeholder
      return { ok: false, error: 'Not yet implemented' }
    } catch (err) {
      Logger.error('IPC', 'pcap:import failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  })

  ipcMain.handle('pcap:startFile', async (_event, path: string): Promise<void> => {
    try {
      validateOrThrow(PcapStartFileSchema, { path })
      Logger.info('IPC', 'pcap:startFile invoked', { path })
      // TODO: implement file streaming through pipeline (Task 22)
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

      const result = await dialog.showSaveDialog({
        title: 'Export PCAP File',
        defaultPath: `netvis-capture-${Date.now()}.pcap`,
        filters: [{ name: 'PCAP Files', extensions: ['pcap'] }]
      })

      if (result.canceled || !result.filePath) {
        return { ok: false, error: 'User canceled' }
      }

      const filePath = result.filePath
      Logger.info('IPC', 'pcap:export file selected', { path: filePath })

      // TODO: implement buffer export via Parser.print() (Task 22)
      return { ok: false, error: 'Not yet implemented' }
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
      // TODO: implement in Packet_Buffer (Task 8)
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
      // TODO: implement in Packet_Buffer (Task 8)
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
      // TODO: implement in Packet_Buffer (Task 8)
      // For now, return empty array as placeholder
      return []
    } catch (err) {
      Logger.error('IPC', 'buffer:getAll failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  })

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
