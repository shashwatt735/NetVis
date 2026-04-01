/**
 * Shared capture types — imported by main process, worker thread, and renderer.
 * No Node.js-specific imports here so this file is safe to import anywhere.
 */

// ─── Protocol ────────────────────────────────────────────────────────────────

export type ProtocolName = 'TCP' | 'UDP' | 'ICMP' | 'DNS' | 'ARP' | 'IPv4' | 'IPv6' | 'OTHER'

export type SpeedMultiplier = 0.5 | 1 | 2 | 5

// ─── Raw packet (out of PacketSource, into Parser) ───────────────────────────

/**
 * A raw, unprocessed packet from either cap (live) or pcap-parser (file).
 * Contains NO protocol interpretation — that is entirely the Parser's job.
 * INVARIANT: data is always a copy. Never a reference to a shared buffer.
 */
export interface RawPacket {
  /** Unix timestamp in ms with sub-ms precision where available. */
  timestamp: number
  /** Interface name (live) or filename only — not full path (file). Display only. */
  sourceId: string
  /** Whether this packet came from a live interface or a file. */
  captureMode: 'live' | 'file'
  /** Raw frame bytes — always a fresh copy. */
  data: Uint8Array
  /** Original wire length in bytes. May differ from data.length if snaplen < frame. */
  length: number
  /**
   * libpcap link-layer type. Tells the Parser how to begin decoding.
   * 1 = LINKTYPE_ETHERNET (most common), 0 = LINKTYPE_NULL, 113 = LINKTYPE_LINUX_SLL
   */
  linkType: number
}

// ─── Parsed packet (main process only, never crosses IPC) ────────────────────

export interface ParsedField {
  name: string
  label: string
  value: string | number
  byteOffset: number
  byteLength: number
}

export interface ParsedLayer {
  protocol: ProtocolName
  fields: ParsedField[]
  error?: string // set if layer is malformed
  rawByteOffset: number
  rawByteLength: number
}

export interface ParsedPacket {
  id: string // uuid v4
  timestamp: number
  sourceId: string
  captureMode: 'live' | 'file'
  wireLength: number
  layers: ParsedLayer[]
  /** Raw frame bytes — populated by Parser.parse(), used by Parser.print(). Never crosses IPC. */
  rawData?: Uint8Array
}

// ─── Anonymized packet (crosses IPC boundary to renderer) ────────────────────

export interface AnonPacket {
  id: string
  timestamp: number
  sourceId: string
  captureMode: 'live' | 'file'
  wireLength: number
  layers: ParsedLayer[] // payload bytes replaced with pseudonym token
  // Top-level convenience fields for Packet_List display
  srcAddress: string
  dstAddress: string
  protocol: ProtocolName
  length: number
}

// ─── Network interface ────────────────────────────────────────────────────────

export interface NetworkInterface {
  name: string
  displayName: string
  isUp: boolean
}

// ─── Capture status ───────────────────────────────────────────────────────────

export type CaptureStatus =
  | { state: 'idle' }
  | { state: 'active'; iface: string; startedAt: number; pps: number }
  | { state: 'file'; path: string; pps: number }
  | { state: 'simulated'; path: string; speed: SpeedMultiplier; pps: number }
  | { state: 'error'; message: string; platformHint?: string }
  | { state: 'stopped' }

// ─── Capture errors ───────────────────────────────────────────────────────────

export type CaptureErrorCode =
  | 'PERMISSION_DENIED' // no admin/root privileges
  | 'INTERFACE_NOT_FOUND' // named interface does not exist
  | 'INTERFACE_LOST' // interface disappeared during active capture
  | 'FILE_NOT_FOUND' // file path does not exist
  | 'FILE_INVALID_FORMAT' // not a valid PCAP or PCAPNG file
  | 'LIBRARY_UNAVAILABLE' // cap failed to load
  | 'DRAIN_TIMEOUT' // stop drain exceeded 500 ms
  | 'UNKNOWN'

export interface CaptureError {
  code: CaptureErrorCode
  message: string // plain-English, shown directly in UI
  platformHint?: string // OS-specific fix instructions
  cause?: Error // original error — logged, never shown to user
}

// ─── PacketSource adapter interface ──────────────────────────────────────────

/**
 * Uniform interface for any packet source — live or file.
 * CaptureController only talks to PacketSource — never to cap or pcap-parser directly.
 */
export interface PacketSource {
  /** Begin emitting packets. Idempotent if already started. */
  start(): Promise<void>
  /** Stop emitting packets and release resources. Safe to call multiple times. Resolves within 500 ms. */
  stop(): Promise<void>
  onPacket(handler: (packet: RawPacket) => void): void
  onError(handler: (err: CaptureError) => void): void
  onStopped(handler: () => void): void
}

// ─── Buffer stats ─────────────────────────────────────────────────────────────

export interface BufferStats {
  count: number
  capacity: number
  percentage: number
}

// ─── Import / Export results ──────────────────────────────────────────────────

export interface ImportResult {
  ok: boolean
  packetCount?: number
  fileSizeBytes?: number
  error?: string
}

export interface ExportResult {
  ok: boolean
  error?: string
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface Settings {
  bufferCapacity: number // 1000–100000, default 10000
  theme: 'light' | 'dark' | 'system'
  welcomeSeen: boolean
  completedChallenges: string[]
  reducedMotion: boolean // mirrors OS preference; user can override
}

export const DEFAULT_SETTINGS: Settings = {
  bufferCapacity: 10000,
  theme: 'system',
  welcomeSeen: false,
  completedChallenges: [],
  reducedMotion: false
}

// ─── Worker message protocol ──────────────────────────────────────────────────

export type WorkerInMessage =
  | { type: 'start-live'; iface: string }
  | { type: 'start-file'; filePath: string }
  | { type: 'start-simulated'; filePath: string; speed: SpeedMultiplier }
  | { type: 'stop' }

export type WorkerOutMessage =
  | { type: 'packet-batch'; packets: AnonPacket[] }
  | { type: 'stopped' }
  | { type: 'error'; error: CaptureError }
  | { type: 'metrics'; truncatedDropCount: number }
