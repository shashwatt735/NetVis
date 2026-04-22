import { Worker } from 'worker_threads'
import { EventEmitter } from 'events'
import { Logger } from '../logger'

export class WorkerSupervisor extends EventEmitter {
  private worker: Worker | null = null
  private intentional = false
  private restartTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly workerPath: string) {
    super()
  }

  start(): Worker {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
    this.intentional = false
    this.worker = new Worker(this.workerPath, {
      stderr: true, // Enable stderr capture
      stdout: true  // Enable stdout capture
    })
    
    // Capture stderr output (where worker logs fatal errors)
    this.worker.stderr?.on('data', (data) => {
      const message = data.toString()
      Logger.error('WorkerSupervisor', 'Worker stderr', { message })
      console.error('[WorkerSupervisor] Worker stderr:', message)
    })
    
    // Capture stdout output
    this.worker.stdout?.on('data', (data) => {
      const message = data.toString()
      Logger.debug('WorkerSupervisor', 'Worker stdout', { message })
      console.log('[WorkerSupervisor] Worker stdout:', message)
    })
    
    // Capture worker errors before exit
    this.worker.on('error', (err) => {
      Logger.error('WorkerSupervisor', 'Worker error event', {
        error: err.message,
        stack: err.stack ?? 'N/A',
        name: err.name
      })
      console.error('[WorkerSupervisor] Worker error:', err)
    })
    
    // Capture messages from worker (including startup errors)
    this.worker.on('messageerror', (err) => {
      Logger.error('WorkerSupervisor', 'Worker message error', {
        error: String(err)
      })
      console.error('[WorkerSupervisor] Worker message error:', err)
    })
    
    this.worker.on('exit', (code) => {
      if (this.intentional) return
      Logger.warn('WorkerSupervisor', `Worker exited unexpectedly (code ${code})`)
      console.warn(
        `[WorkerSupervisor] Worker exited unexpectedly (code ${code}), restarting in 500ms`
      )
      this.restartTimer = setTimeout(() => {
        this.restartTimer = null
        this.start() // start() already emits 'worker' event
      }, 500)
    })
    
    this.emit('worker', this.worker)
    return this.worker
  }

  stop(): void {
    this.intentional = true
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
    this.worker?.terminate()
    this.worker = null
  }

  getWorker(): Worker | null {
    return this.worker
  }
}
