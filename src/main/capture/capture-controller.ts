import type {
  RawPacket,
  CaptureError,
  SpeedMultiplier,
  PacketSource
} from '../../shared/capture-types'
import { mapError } from './errors'
import { CapSource } from './cap-source'
import { PcapFileSource } from './pcap-file-source'
import { SimulatedReplaySource } from './simulated-replay-source'

export type ControllerState = 'idle' | 'live' | 'file' | 'simulated'

export class CaptureController {
  private source: PacketSource | null = null
  private state: ControllerState = 'idle'

  constructor(
    private readonly onPacket: (p: RawPacket) => void,
    private readonly onError: (e: CaptureError) => void,
    private readonly onStopped: () => void,
    private readonly onStatus: (s: ControllerState) => void,
    // BUGFIX-04: callback to signal command-complete for a specific requestId
    private readonly onComplete?: (requestId: string) => void
  ) {}

  async startLive(iface: string): Promise<void> {
    this.guardIdle('startLive')
    const source = new CapSource(iface)
    this.source = source
    this.wireSource(source)
    // BUGFIX-02: throw on startup failure instead of calling errorHandler
    await source.start()
    this.state = 'live'
    this.onStatus('live')
  }

  // BUGFIX-04: requestId passed so onComplete can signal command-complete when streaming ends
  async startFile(filePath: string, requestId?: string): Promise<void> {
    this.guardIdle('startFile')
    const source = new PcapFileSource(filePath)
    this.source = source
    this.wireSource(source, requestId)
    // BUGFIX-02: throw on startup failure
    await source.start()
    this.state = 'file'
    this.onStatus('file')
  }

  async startSimulated(filePath: string, speed: SpeedMultiplier, requestId?: string): Promise<void> {
    this.guardIdle('startSimulated')
    const source = new SimulatedReplaySource(filePath, speed)
    this.source = source
    this.wireSource(source, requestId)
    // BUGFIX-02: throw on startup failure
    await source.start()
    this.state = 'simulated'
    this.onStatus('simulated')
  }

  async stop(): Promise<void> {
    if (this.state === 'idle') return
    await this.source?.stop()
    this.source = null
    this.state = 'idle'
    this.onStatus('idle')
  }

  get currentState(): ControllerState {
    return this.state
  }

  private wireSource(source: PacketSource, requestId?: string): void {
    source.onPacket(this.onPacket)
    source.onError(this.onError)
    source.onStopped(() => {
      this.state = 'idle'
      this.source = null
      this.onStopped()
      // BUGFIX-04: signal command-complete for file/simulated streaming end
      if (requestId && this.onComplete) {
        this.onComplete(requestId)
      }
    })
  }

  private guardIdle(caller: string): void {
    if (this.state !== 'idle') {
      throw mapError(new Error(`Cannot call ${caller} while state is "${this.state}"`), 'UNKNOWN')
    }
  }
}
