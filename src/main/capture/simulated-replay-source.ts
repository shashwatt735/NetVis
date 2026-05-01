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
const STREAM_PAUSE_QUEUE_DEPTH = 2

export class SimulatedReplaySource implements PacketSource {
  private stream: fs.ReadStream | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private stopped = false
  private prevTimestamp: number | null = null
  private parserEnded = false
  private processingQueue = false
  private packetQueue: RawPacket[] = []

  private packetHandler: (packet: RawPacket) => void = () => {}
  private errorHandler: (err: CaptureError) => void = () => {}
  private stoppedHandler: () => void = () => {}

  constructor(
    private readonly filePath: string,
    private readonly speed: SpeedMultiplier = 1
  ) {}

  private enqueuePacket(packet: RawPacket): void {
    this.packetQueue.push(packet)
    if (this.packetQueue.length >= STREAM_PAUSE_QUEUE_DEPTH) {
      this.stream?.pause()
    }
    this.scheduleNextPacket()
  }

  private scheduleNextPacket(): void {
    if (this.stopped || this.processingQueue) return

    const raw = this.packetQueue.shift()
    if (!raw) {
      if (this.parserEnded) this.finish()
      return
    }

    const prev = this.prevTimestamp
    const delay =
      prev === null ? 0 : Math.min(Math.max((raw.timestamp - prev) / this.speed, 0), MAX_DELAY_MS)

    this.processingQueue = true
    this.timer = setTimeout(() => {
      this.timer = null
      if (this.stopped) return

      this.packetHandler(raw)
      this.prevTimestamp = raw.timestamp
      this.processingQueue = false

      if (!this.parserEnded && this.stream?.isPaused() && this.packetQueue.length < STREAM_PAUSE_QUEUE_DEPTH) {
        this.stream.resume()
      }

      this.scheduleNextPacket()
    }, delay)
  }

  private finish(): void {
    if (this.stopped) return
    this.stopped = true
    this.stoppedHandler()
  }

  async start(): Promise<void> {
    if (this.stopped) return

    // Check file exists — BUGFIX-02: throw instead of calling errorHandler
    if (!fs.existsSync(this.filePath)) {
      throw mapError(
        new Error(`File not found: ${this.filePath}`),
        'FILE_NOT_FOUND',
        this.filePath
      )
    }

    let parse: (stream: fs.ReadStream) => NodeJS.EventEmitter

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pcapParser = require('pcap-parser') as {
        parse: (stream: fs.ReadStream) => NodeJS.EventEmitter
      }
      parse = pcapParser.parse
    } catch (err) {
      // BUGFIX-02: throw on startup failure
      throw mapError(err as Error, 'LIBRARY_UNAVAILABLE')
    }

    try {
      this.stream = fs.createReadStream(this.filePath)
      const parser = parse(this.stream)
      const sourceId = path.basename(this.filePath)

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

          // FILE-SEC-01: skip oversized packets
          if (pkt.data.length > MAX_FRAME_SIZE) return

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

          this.enqueuePacket(raw)
        }
      )

      parser.on('end', () => {
        if (this.stopped) return
        this.parserEnded = true
        this.scheduleNextPacket()
      })

      // Runtime errors (post-startup) — use errorHandler, not throw
      parser.on('error', (err: Error) => {
        this.errorHandler(mapError(err, 'FILE_INVALID_FORMAT'))
      })

      this.stream.on('error', (err: Error) => {
        this.errorHandler(mapError(err, 'FILE_INVALID_FORMAT'))
      })
    } catch (err) {
      // BUGFIX-02: throw on startup failure (stream/parser creation error)
      throw mapError(err as Error, 'FILE_INVALID_FORMAT')
    }
  }

  async stop(): Promise<void> {
    if (this.stopped) return
    this.stopped = true
    this.packetQueue = []
    this.processingQueue = false
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
