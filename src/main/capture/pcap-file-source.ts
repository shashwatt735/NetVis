import * as fs from 'fs'
import * as path from 'path'
import type { RawPacket, CaptureError, PacketSource } from '../../shared/capture-types'
import { mapError } from './errors'

const MAX_FRAME_SIZE = 65535 // FILE-SEC-01

export class PcapFileSource implements PacketSource {
  private stream: fs.ReadStream | null = null
  private stopped = false

  private packetHandler: (packet: RawPacket) => void = () => {}
  private errorHandler: (err: CaptureError) => void = () => {}
  private stoppedHandler: () => void = () => {}

  constructor(private readonly filePath: string) {}

  async start(): Promise<void> {
    if (this.stopped) return

    // Check file exists
    if (!fs.existsSync(this.filePath)) {
      this.errorHandler(
        mapError(new Error(`File not found: ${this.filePath}`), 'FILE_NOT_FOUND', this.filePath)
      )
      return
    }

    let parse: (stream: fs.ReadStream) => NodeJS.EventEmitter

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pcapParser = require('pcap-parser') as {
        parse: (stream: fs.ReadStream) => NodeJS.EventEmitter
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

          // FILE-SEC-01: skip oversized packets
          if (pkt.data.length > MAX_FRAME_SIZE) return

          const timestamp =
            pkt.header.timestampSeconds * 1000 + Math.floor(pkt.header.timestampMicroseconds / 1000)

          const packet: RawPacket = {
            timestamp,
            sourceId,
            captureMode: 'file',
            data: new Uint8Array(pkt.data),
            length: pkt.header.originalLength ?? pkt.data.length,
            linkType: pkt.linkType ?? 1
          }

          this.packetHandler(packet)
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
