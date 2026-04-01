import * as fs from 'fs'
import * as path from 'path'
import type {
  RawPacket,
  CaptureError,
  PacketSource,
  SpeedMultiplier
} from '../../shared/capture-types'
import { mapError } from './errors'

const MAX_FRAME_SIZE = 65535 // FILE-SEC-01
const MAX_DELAY_MS = 2000

export class SimulatedReplaySource implements PacketSource {
  private stream: fs.ReadStream | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private stopped = false
  private prevTimestamp: number | null = null

  private packetHandler: (packet: RawPacket) => void = () => {}
  private errorHandler: (err: CaptureError) => void = () => {}
  private stoppedHandler: () => void = () => {}

  constructor(
    private readonly filePath: string,
    private readonly speed: SpeedMultiplier = 1
  ) {}

  async start(): Promise<void> {
    if (this.stopped) return

    // Check file exists
    if (!fs.existsSync(this.filePath)) {
      this.errorHandler(
        mapError(new Error(`File not found: ${this.filePath}`), 'FILE_NOT_FOUND', this.filePath)
      )
      return
    }

    let parse: (stream: fs.ReadStream) => NodeJS.EventEmitter & { pause(): void; resume(): void }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pcapParser = require('pcap-parser') as {
        parse: (stream: fs.ReadStream) => NodeJS.EventEmitter & { pause(): void; resume(): void }
      }
      parse = pcapParser.parse
    } catch (err) {
      this.errorHandler(mapError(err as Error, 'LIBRARY_UNAVAILABLE'))
      return
    }

    try {
      this.stream = fs.createReadStream(this.filePath)
      const parser = parse(this.stream)
      const sourceId = path.basename(this.filePath)
      const speed = this.speed

      // Streaming mode — at most 2 packets in memory at once
      parser.on(
        'packet',
        (pkt: {
          header: {
            timestampSeconds: number
            timestampMicroseconds: number
            capturedLength: number
            originalLength: number
          }
          data: Buffer
          linkType?: number
        }) => {
          if (this.stopped) return

          // Pause immediately after receiving a packet
          parser.pause()

          // FILE-SEC-01: skip oversized packets
          if (pkt.data.length > MAX_FRAME_SIZE) {
            parser.resume()
            return
          }

          const timestamp =
            pkt.header.timestampSeconds * 1000 + Math.floor(pkt.header.timestampMicroseconds / 1000)

          const raw: RawPacket = {
            timestamp,
            sourceId,
            captureMode: 'file',
            data: new Uint8Array(pkt.data),
            length: pkt.header.originalLength ?? pkt.data.length,
            linkType: pkt.linkType ?? 1
          }

          const prev = this.prevTimestamp
          this.prevTimestamp = timestamp

          const delay =
            prev === null ? 0 : Math.min(Math.max((raw.timestamp - prev) / speed, 0), MAX_DELAY_MS)

          this.timer = setTimeout(() => {
            if (this.stopped) return
            this.packetHandler(raw)
            parser.resume()
          }, delay)
        }
      )

      parser.on('end', () => {
        if (!this.stopped) {
          this.stopped = true
          this.stoppedHandler()
        }
      })

      parser.on('error', (err: Error) => {
        this.errorHandler(mapError(err, 'FILE_INVALID_FORMAT'))
      })

      this.stream.on('error', (err: Error) => {
        this.errorHandler(mapError(err, 'FILE_INVALID_FORMAT'))
      })
    } catch (err) {
      this.errorHandler(mapError(err as Error, 'FILE_INVALID_FORMAT'))
    }
  }

  async stop(): Promise<void> {
    if (this.stopped) return
    this.stopped = true
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.stream) {
      this.stream.destroy()
      this.stream = null
    }
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
