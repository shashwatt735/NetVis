import type { RawPacket, CaptureError, PacketSource } from '../../shared/capture-types'
import { mapError } from './errors'

// Must run inside a worker_threads Worker — never on the main thread

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CapInstance = any

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
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      capModule = require('cap')
    } catch (err) {
      this.errorHandler(mapError(err as Error, 'LIBRARY_UNAVAILABLE'))
      return
    }

    try {
      const { Cap, decoders } = capModule
      this.cap = new Cap()
      const linkType = this.cap.open(this.iface, '', 65535, this.buffer)
      // decoders.PROTOCOL.ETHERNET === 1 in most builds; fall back to raw numeric value
      const linkTypeNum: number =
        decoders?.PROTOCOL?.ETHERNET === linkType ? 1 : (linkType as number)

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
      this.errorHandler(mapError(e, code, this.iface))
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
