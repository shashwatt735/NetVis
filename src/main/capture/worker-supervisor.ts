import { Worker } from 'worker_threads'

export class WorkerSupervisor {
  private worker: Worker | null = null
  private intentional = false

  constructor(private readonly workerPath: string) {}

  start(): Worker {
    this.intentional = false
    this.worker = new Worker(this.workerPath)
    this.worker.on('exit', (code) => {
      if (this.intentional) return
      console.warn(
        `[WorkerSupervisor] Worker exited unexpectedly (code ${code}), restarting in 500ms`
      )
      setTimeout(() => this.start(), 500)
    })
    return this.worker
  }

  stop(): void {
    this.intentional = true
    this.worker?.terminate()
    this.worker = null
  }
}
