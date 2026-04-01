// Shared IPC type contract — imported by both preload and renderer.
// Full types are populated in Task 11.

import type {
  AnonPacket,
  NetworkInterface,
  CaptureStatus,
  BufferStats,
  ImportResult,
  ExportResult,
  Settings,
  SpeedMultiplier
} from './capture-types'

export type Unsubscribe = () => void

/**
 * ElectronAPI — the complete IPC contract exposed to the renderer via contextBridge.
 * All invoke channels return promises; all on channels accept handlers and return unsubscribe functions.
 */
export interface ElectronAPI {
  // ─── Capture control (invoke) ───────────────────────────────────────────────
  getInterfaces(): Promise<NetworkInterface[]>
  startCapture(iface: string): Promise<void>
  stopCapture(): Promise<void>
  startSimulated(path: string, speed: SpeedMultiplier): Promise<void>

  // ─── PCAP import/export (invoke) ────────────────────────────────────────────
  importPcap(): Promise<ImportResult>
  startFile(path: string): Promise<void>
  exportPcap(): Promise<ExportResult>

  // ─── Buffer management (invoke) ─────────────────────────────────────────────
  clearBuffer(): Promise<void>
  setBufferCapacity(capacity: number): Promise<void>
  getAllPackets(): Promise<AnonPacket[]>

  // ─── Settings (invoke) ──────────────────────────────────────────────────────
  getSettings(): Promise<Settings>
  setSettings(patch: Partial<Settings>): Promise<Settings>

  // ─── Logging (invoke) ───────────────────────────────────────────────────────
  openLogFolder(): Promise<void>

  // ─── Push channels (main → renderer) ────────────────────────────────────────
  onPacketBatch(handler: (packets: AnonPacket[]) => void): Unsubscribe
  onCaptureStatus(handler: (status: CaptureStatus) => void): Unsubscribe
  onBufferOverflow(handler: (info: { dropped: number }) => void): Unsubscribe
  onBufferStats(handler: (stats: BufferStats) => void): Unsubscribe
}
