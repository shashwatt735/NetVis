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
    private readonly onStatus: (s: ControllerState) => void
  ) {}

  async startLive(iface: string): Promise<void> {
    this.guardIdle('startLive')
    this.source = new CapSource(iface)
    this.wireSource()
    await this.source.start()
    this.state = 'live'
    this.onStatus('live')
  }

  async startFile(filePath: string): Promise<void> {
    this.guardIdle('startFile')
    this.source = new PcapFileSource(filePath)
    this.wireSource()
    await this.source.start()
    this.state = 'file'
    this.onStatus('file')
  }

  async startSimulated(filePath: string, speed: SpeedMultiplier): Promise<void> {
    this.guardIdle('startSimulated')
    this.source = new SimulatedReplaySource(filePath, speed)
    this.wireSource()
    await this.source.start()
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

  private wireSource(): void {
    this.source!.onPacket(this.onPacket)
    this.source!.onError(this.onError)
    this.source!.onStopped(() => {
      this.state = 'idle'
      this.source = null
      this.onStopped()
    })
  }

  private guardIdle(caller: string): void {
    if (this.state !== 'idle') {
      throw mapError(new Error(`Cannot call ${caller} while state is "${this.state}"`), 'UNKNOWN')
    }
  }
}
