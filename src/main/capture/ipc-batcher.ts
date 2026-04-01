import type { AnonPacket } from '../../shared/capture-types'

export class IpcBatcher {
  private static readonly FLUSH_INTERVAL_MS = 50
  private static readonly MAX_BATCH_SIZE = 100
  private batch: AnonPacket[] = []
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

  push(packet: AnonPacket): void {
    this.batch.push(packet)
    if (this.batch.length >= IpcBatcher.MAX_BATCH_SIZE) this.flush()
  }

  private flush(): void {
    if (this.batch.length === 0) return
    this.send(this.batch.splice(0))
  }
}
