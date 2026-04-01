import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI, Unsubscribe } from '../shared/ipc-types'
import type {
  AnonPacket,
  CaptureStatus,
  BufferStats,
  Settings,
  SpeedMultiplier
} from '../shared/capture-types'

// ARCH-01: only explicitly declared functions are exposed to the renderer.
// Full ElectronAPI implementation — Task 11.

const electronAPI: ElectronAPI = {
  // ─── Capture control (invoke) ───────────────────────────────────────────────
  getInterfaces: () => ipcRenderer.invoke('capture:getInterfaces'),
  startCapture: (iface: string) => ipcRenderer.invoke('capture:start', iface),
  stopCapture: () => ipcRenderer.invoke('capture:stop'),
  startSimulated: (path: string, speed: SpeedMultiplier) =>
    ipcRenderer.invoke('capture:startSimulated', { path, speed }),

  // ─── PCAP import/export (invoke) ────────────────────────────────────────────
  importPcap: () => ipcRenderer.invoke('pcap:import'),
  startFile: (path: string) => ipcRenderer.invoke('pcap:startFile', path),
  exportPcap: () => ipcRenderer.invoke('pcap:export'),

  // ─── Buffer management (invoke) ─────────────────────────────────────────────
  clearBuffer: () => ipcRenderer.invoke('buffer:clear'),
  setBufferCapacity: (capacity: number) => ipcRenderer.invoke('buffer:setCapacity', capacity),
  getAllPackets: () => ipcRenderer.invoke('buffer:getAll'),

  // ─── Settings (invoke) ──────────────────────────────────────────────────────
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<Settings>) => ipcRenderer.invoke('settings:set', patch),

  // ─── Logging (invoke) ───────────────────────────────────────────────────────
  openLogFolder: () => ipcRenderer.invoke('log:openFolder'),

  // ─── Push channels (main → renderer) ────────────────────────────────────────
  onPacketBatch: (handler: (packets: AnonPacket[]) => void): Unsubscribe => {
    const listener = (_event: Electron.IpcRendererEvent, packets: AnonPacket[]): void =>
      handler(packets)
    ipcRenderer.on('packet:batch', listener)
    return () => ipcRenderer.removeListener('packet:batch', listener)
  },

  onCaptureStatus: (handler: (status: CaptureStatus) => void): Unsubscribe => {
    const listener = (_event: Electron.IpcRendererEvent, status: CaptureStatus): void =>
      handler(status)
    ipcRenderer.on('capture:status', listener)
    return () => ipcRenderer.removeListener('capture:status', listener)
  },

  onBufferOverflow: (handler: (info: { dropped: number }) => void): Unsubscribe => {
    const listener = (_event: Electron.IpcRendererEvent, info: { dropped: number }): void =>
      handler(info)
    ipcRenderer.on('buffer:overflow', listener)
    return () => ipcRenderer.removeListener('buffer:overflow', listener)
  },

  onBufferStats: (handler: (stats: BufferStats) => void): Unsubscribe => {
    const listener = (_event: Electron.IpcRendererEvent, stats: BufferStats): void => handler(stats)
    ipcRenderer.on('buffer:stats', listener)
    return () => ipcRenderer.removeListener('buffer:stats', listener)
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
