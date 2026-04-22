import type { RawPacket, CaptureError, PacketSource } from '../../shared/capture-types'
import { mapError } from './errors'
import { ensureNpcapDllPath } from './npcap-path'
import { Logger } from '../logger'

// Must run inside a worker_threads Worker — never on the main thread

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CapInstance = any

// ─── Link-type normalization ──────────────────────────────────────────────────

/**
 * Narrow, explicit mapping from cap's string link-type names to libpcap numeric
 * constants. Only types the parser actually handles are listed.
 *
 * cap.open() returns a string (e.g. 'ETHERNET'), not a number.
 * decoders.PROTOCOL.ETHERNET is an EtherType *object*, never equal to that string,
 * so the old comparison `decoders?.PROTOCOL?.ETHERNET === linkType` always fell
 * through to `(linkType as number)` — leaving the string 'ETHERNET' at runtime
 * and causing the parser to classify every live packet as OTHER.
 */
const LINK_TYPE_MAP: Record<string, number> = {
  ETHERNET: 1,      // LINKTYPE_ETHERNET — standard Ethernet II frames
  NULL: 0,          // LINKTYPE_NULL — BSD loopback encapsulation
  LOOP: 12,         // LINKTYPE_LOOP — OpenBSD loopback
  PPP: 9,           // LINKTYPE_PPP
  PPP_SERIAL: 50,   // LINKTYPE_PPP_HDLC
  RAW: 101,         // LINKTYPE_RAW — raw IPv4/IPv6
  LINUX_SLL: 113,   // LINKTYPE_LINUX_SLL — Linux cooked capture
  IEEE802_11: 105,  // LINKTYPE_IEEE802_11 — Wi-Fi
}

/** Tracks link types already warned about so we only log each unknown type once. */
const warnedLinkTypes = new Set<unknown>()

/**
 * Convert cap's runtime link-type value to the numeric libpcap constant the
 * parser expects. Accepts both the string names cap returns and raw numbers.
 *
 * Returns -1 for any unrecognised value and emits a one-time warning so
 * unexpected capture environments are visible in the log without crashing.
 */
function normalizeLinkType(value: unknown): number {
  // Already a finite number — pass through directly (e.g. future cap versions)
  if (typeof value === 'number' && Number.isFinite(value)) return value

  // String name — look up in the explicit map (case-insensitive for safety)
  if (typeof value === 'string') {
    const mapped = LINK_TYPE_MAP[value.toUpperCase()]
    if (mapped !== undefined) return mapped
  }

  // Unknown — warn once, return sentinel so the parser produces an OTHER layer
  if (!warnedLinkTypes.has(value)) {
    warnedLinkTypes.add(value)
    Logger.warn(
      'CapSource',
      'Unknown link type from cap.open() — packets will be classified as OTHER',
      {
        linkType: String(value),
        typeofLinkType: typeof value
      }
    )
  }

  return -1
}

// ─── CapSource ────────────────────────────────────────────────────────────────

export class CapSource implements PacketSource {
  private cap: CapInstance | null = null
  private buffer = Buffer.alloc(65535) // max Ethernet frame size
  private droppedTruncatedCount = 0

  private packetHandler: (packet: RawPacket) => void = () => {}
  private errorHandler: (err: CaptureError) => void = () => {}
  private stoppedHandler: () => void = () => {}

  constructor(private readonly iface: string) {}

  async start(): Promise<void> {
    if (this.cap) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let capModule: any

    try {
      ensureNpcapDllPath()
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      capModule = require('cap')
    } catch (err) {
      // BUGFIX-02: throw on startup failure instead of calling errorHandler
      throw mapError(err as Error, 'LIBRARY_UNAVAILABLE')
    }

    try {
      const { Cap } = capModule
      this.cap = new Cap()
      // cap.open() returns a string like 'ETHERNET' — normalize to numeric libpcap constant
      const rawLinkType: unknown = this.cap.open(this.iface, '', 65535, this.buffer)
      const linkTypeNum = normalizeLinkType(rawLinkType)

      this.cap.on('packet', (nbytes: number, truncated: boolean) => {
        if (truncated) {
          this.droppedTruncatedCount++
          return
        }

        // CRITICAL: copy bytes immediately — cap reuses the shared buffer
        const data = new Uint8Array(this.buffer.buffer, this.buffer.byteOffset, nbytes).slice()

        const packet: RawPacket = {
          timestamp: Date.now(),
          sourceId: this.iface,
          captureMode: 'live',
          data,
          length: nbytes,
          linkType: linkTypeNum
        }

        this.packetHandler(packet)
      })

      this.cap.on('error', (err: Error) => {
        // Runtime error (post-startup) — use errorHandler, not throw
        const code = (err.message ?? '').toLowerCase().includes('permission')
          ? 'PERMISSION_DENIED'
          : 'UNKNOWN'
        this.errorHandler(mapError(err, code, this.iface))
      })
    } catch (err) {
      const e = err as Error & { code?: string }
      const code =
        e.code === 'ENODEV' || (e.message ?? '').toLowerCase().includes('not found')
          ? 'INTERFACE_NOT_FOUND'
          : e.code === 'EACCES' || (e.message ?? '').toLowerCase().includes('permission')
            ? 'PERMISSION_DENIED'
            : 'UNKNOWN'
      // BUGFIX-02: throw on startup failure
      throw mapError(e, code, this.iface)
    }
  }

  async stop(): Promise<void> {
    if (!this.cap) return
    try {
      this.cap.close()
    } catch {
      // ignore close errors
    }
    this.cap = null
    this.stoppedHandler()
  }

  onPacket(handler: (packet: RawPacket) => void): void {
    this.packetHandler = handler
  }

  onError(handler: (err: CaptureError) => void): void {
    this.errorHandler = handler
  }

  onStopped(handler: () => void): void {
    this.stoppedHandler = handler
  }
}
