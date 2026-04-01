import * as path from 'path'
import type { Worker } from 'worker_threads'
import type {
  AnonPacket,
  CaptureError,
  NetworkInterface,
  SpeedMultiplier,
  WorkerInMessage,
  WorkerOutMessage
} from '../../shared/capture-types'
import { WorkerSupervisor } from './worker-supervisor'
import { IpcBatcher } from './ipc-batcher'

// Extended out-message type to handle interfaces response (not in shared protocol)
type WorkerOutMessageExtended =
  | WorkerOutMessage
  | { type: 'interfaces'; interfaces: NetworkInterface[] }

export class CaptureEngine {
  private supervisor: WorkerSupervisor
  private batcher: IpcBatcher
  private worker: Worker | null = null

  private packetHandler: (p: AnonPacket) => void = () => {}
  private errorHandler: (e: CaptureError) => void = () => {}
  private stoppedHandler: () => void = () => {}

  constructor(send: (packets: AnonPacket[]) => void) {
    const workerPath = path.join(__dirname, 'capture-worker.js')
    this.supervisor = new WorkerSupervisor(workerPath)
    this.batcher = new IpcBatcher(send)
  }

  start(): void {
    this.worker = this.supervisor.start()
    this.batcher.start()
    this.worker.on('message', (msg: WorkerOutMessageExtended) => this.handleWorkerMessage(msg))
  }

  stop(): void {
    this.supervisor.stop()
    this.batcher.stop()
    this.worker = null
  }

  async getInterfaces(): Promise<NetworkInterface[]> {
    return new Promise((resolve) => {
      const handler = (msg: WorkerOutMessageExtended): void => {
        if (msg.type === 'interfaces') {
          this.worker?.off('message', handler)
          resolve((msg as { type: 'interfaces'; interfaces: NetworkInterface[] }).interfaces ?? [])
        }
      }
      this.worker?.on('message', handler)
      this.worker?.postMessage({ type: 'get-interfaces' })
    })
  }

  async startCapture(iface: string): Promise<void> {
    this.worker?.postMessage({ type: 'start-live', iface } satisfies WorkerInMessage)
  }

  async stopCapture(): Promise<void> {
    this.worker?.postMessage({ type: 'stop' } satisfies WorkerInMessage)
  }

  async startFile(filePath: string): Promise<void> {
    this.worker?.postMessage({ type: 'start-file', filePath } satisfies WorkerInMessage)
  }

  async startSimulated(pcapPath: string, speedMultiplier: SpeedMultiplier): Promise<void> {
    this.worker?.postMessage({
      type: 'start-simulated',
      filePath: pcapPath,
      speed: speedMultiplier
    } satisfies WorkerInMessage)
  }

  on(event: 'packet', handler: (p: AnonPacket) => void): void
  on(event: 'error', handler: (e: CaptureError) => void): void
  on(event: 'stopped', handler: () => void): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, handler: (arg?: any) => void): void {
    if (event === 'packet') this.packetHandler = handler as (p: AnonPacket) => void
    else if (event === 'error') this.errorHandler = handler as (e: CaptureError) => void
    else if (event === 'stopped') this.stoppedHandler = handler as () => void
  }

  private handleWorkerMessage(msg: WorkerOutMessageExtended): void {
    switch (msg.type) {
      case 'packet-batch':
        // Push packets to batcher only — batcher handles IPC sends
        for (const p of (msg as { type: 'packet-batch'; packets: AnonPacket[] }).packets) {
          this.batcher.push(p)
        }
        break
      case 'error':
        this.errorHandler((msg as { type: 'error'; error: CaptureError }).error)
        break
      case 'stopped':
        this.stoppedHandler()
        break
      // 'interfaces' and 'metrics' are handled elsewhere or ignored here
    }
  }
}
