// Shared IPC type contract — imported by both preload and renderer.
// Full types are populated in Task 11.

import type {
  AnonPacket,
  NetworkInterface,
  CaptureStatus,
  BufferStats,
  ImportResult,
  ExportResult,
  ResolvedTheme,
  Settings,
  SpeedMultiplier
} from './capture-types'

export type Unsubscribe = () => void

// Structured reason for native capture unavailability — lets the renderer
// show precise messages instead of generic failure text.
export type NativeCaptureUnavailableReason =
  | 'CAP_NOT_INSTALLED'
  | 'NPCAP_MISSING'
  | 'LOAD_FAILED'
  | 'PERMISSION_DENIED'
  | 'NO_INTERFACES'

// BUGFIX-05: structured result distinguishes enumeration failure from empty list
export type InterfaceResult =
  | { ok: true; interfaces: NetworkInterface[] }
  | { ok: false; reason?: NativeCaptureUnavailableReason; error: string; platformHint?: string; diagnostic?: string }

/**
 * ElectronAPI — the complete IPC contract exposed to the renderer via contextBridge.
 * All invoke channels return promises; all on channels accept handlers and return unsubscribe functions.
 */
export interface ElectronAPI {
  // ─── Capture control (invoke) ───────────────────────────────────────────────
  getInterfaces(): Promise<InterfaceResult>
  startCapture(iface: string): Promise<void>
  stopCapture(): Promise<void>
  startSimulated(path: string, speed: SpeedMultiplier): Promise<void>

  // ─── PCAP import/export (invoke) ────────────────────────────────────────────
  selectPcapFile(): Promise<{ ok: true; path: string } | { ok: false }>
  importPcap(): Promise<ImportResult>
  importPcapFromPath(path: string): Promise<ImportResult>
  startFile(path: string): Promise<void>
  exportPcap(): Promise<ExportResult>

  // ─── Buffer management (invoke) ─────────────────────────────────────────────
  clearBuffer(): Promise<void>
  setBufferCapacity(capacity: number): Promise<void>
  getAllPackets(): Promise<AnonPacket[]>

  // ─── Filter (invoke) ────────────────────────────────────────────────────────
  applyFilter(expression: string): Promise<{ packets: AnonPacket[]; error: string | null }>

  // ─── Settings (invoke) ──────────────────────────────────────────────────────
  getSettings(): Promise<Settings>
  setSettings(patch: Partial<Settings>): Promise<Settings>
  setTitleBarTheme(theme: ResolvedTheme): Promise<void>

  // ─── Logging (invoke) ───────────────────────────────────────────────────────
  openLogFolder(): Promise<void>

  // ─── Push channels (main → renderer) ────────────────────────────────────────
  onPacketBatch(handler: (packets: AnonPacket[]) => void): Unsubscribe
  onCaptureStatus(handler: (status: CaptureStatus) => void): Unsubscribe
  onBufferOverflow(handler: (info: { dropped: number }) => void): Unsubscribe
  onBufferStats(handler: (stats: BufferStats) => void): Unsubscribe
}
