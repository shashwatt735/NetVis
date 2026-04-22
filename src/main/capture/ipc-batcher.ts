import type { ParsedPacket, AnonPacket } from '../../shared/capture-types'
import { Anonymizer } from '../anonymizer'

/**
 * IpcBatcher — accumulates ParsedPacket objects and flushes them as anonymized
 * AnonPacket batches to the renderer via IPC.
 *
 * ARCH-04: Anonymization happens here, at the IPC boundary, not in the worker.
 * Flush policy: every 50 ms OR when batch reaches 100 packets — whichever first.
 */
export class IpcBatcher {
  private static readonly FLUSH_INTERVAL_MS = 50
  private static readonly MAX_BATCH_SIZE = 100
  private batch: ParsedPacket[] = []
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(private readonly send: (packets: AnonPacket[]) => void) {}

  start(): void {
    this.timer = setInterval(() => this.flush(), IpcBatcher.FLUSH_INTERVAL_MS)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.flush()
  }

  push(packet: ParsedPacket): void {
    this.batch.push(packet)
    if (this.batch.length >= IpcBatcher.MAX_BATCH_SIZE) this.flush()
  }

  /**
   * Flush if there are pending packets. Called from the live-capture packet
   * handler via setImmediate to yield to the event loop between cap callbacks.
   * Does not affect the interval timer.
   */
  flushIfPending(): void {
    if (this.batch.length > 0) this.flush()
  }

  /**
   * Drops any queued packets that have not crossed the IPC boundary yet.
   * Used when an operation switches to a different authoritative renderer sync path.
   */
  discardPending(): void {
    this.batch = []
  }

  private flush(): void {
    if (this.batch.length === 0) return
    // ARCH-04: Anonymize at IPC boundary
    const anonPackets = this.batch.map((p) => Anonymizer.anonymize(p))
    this.send(anonPackets)
    this.batch = []
  }
}
