import { parentPort } from 'worker_threads'
import type {
  WorkerInMessage,
  WorkerOutMessage,
  RawPacket,
  ParsedPacket
} from '../../shared/capture-types'
import type { InterfaceResult } from '../../shared/ipc-types'
import { CaptureController } from './capture-controller'
import { mapError } from './errors'
import { Parser } from '../parser'

// Wrap entire worker in try-catch to capture startup errors
try {
  if (!parentPort) throw new Error('capture-worker must run as a worker thread')

  // Local type extension for messages not in the shared protocol
  type WorkerInMessageExtended = WorkerInMessage | { type: 'get-interfaces' }

  type WorkerOutMessageExtended =
    | WorkerOutMessage
    | { type: 'interfaces'; result: InterfaceResult }
    | { type: 'packet-batch'; packets: ParsedPacket[] } // Send ParsedPacket, not AnonPacket

  function send(msg: WorkerOutMessageExtended): void {
    parentPort!.postMessage(msg)
  }

  // ARCH-04: Worker sends ParsedPacket (with rawData). Anonymization happens
  // only when crossing IPC to renderer (in IpcBatcher).
  const controller = new CaptureController(
    (packet: RawPacket) => {
      const parsed = Parser.parse(packet)
      send({ type: 'packet-batch', packets: [parsed] })
    },
    (error) => {
      send({ type: 'error', error })
    },
    () => {
      send({ type: 'stopped' })
    },
    () => {
      // onStatus: no-op for now — status is communicated via error/stopped messages
    },
    // BUGFIX-04: send command-complete when file/simulated streaming ends naturally
    (requestId: string) => {
      send({ type: 'command-complete', requestId })
    }
  )

  parentPort.on('message', (msg: WorkerInMessageExtended) => {
    switch (msg.type) {
      case 'get-interfaces':
        // Interface enumeration is handled by the main process, not the capture worker.
        // This case is kept for backward compatibility but should not be called.
        send({
          type: 'interfaces',
          result: {
            ok: false,
            reason: 'LOAD_FAILED',
            error: 'Interface enumeration is handled by the main process, not the capture worker.'
          }
        })
        break

      case 'start-live':
        // Live capture is now handled on the main thread — reject if somehow called here.
        send({
          type: 'command-error',
          requestId: msg.requestId,
          error: mapError(new Error('start-live must not be sent to worker — use main thread CapSource'), 'UNKNOWN')
        })
        break

      case 'start-file': {
        const { requestId, filePath } = msg
        // Wire onStopped to send command-complete for this requestId (BUGFIX-04)
        controller.startFile(filePath, requestId).then(() => {
          send({ type: 'command-ok', requestId })
        }).catch((err: Error) => {
          send({ type: 'command-error', requestId, error: mapError(err, 'UNKNOWN') })
        })
        break
      }

      case 'start-simulated': {
        const { requestId, filePath, speed } = msg
        controller.startSimulated(filePath, speed, requestId).then(() => {
          send({ type: 'command-ok', requestId })
        }).catch((err: Error) => {
          send({ type: 'command-error', requestId, error: mapError(err, 'UNKNOWN') })
        })
        break
      }

      case 'stop': {
        const { requestId } = msg
        controller.stop().then(() => {
          send({ type: 'command-ok', requestId })
        }).catch((err: Error) => {
          send({ type: 'command-error', requestId, error: mapError(err, 'UNKNOWN') })
        })
        break
      }
    }
  })

  console.log('[Worker] Capture worker started successfully')
} catch (err) {
  console.error('[Worker] Fatal startup error:', err)
  // Log to stderr so it's captured by parent process
  process.stderr.write(`[Worker] Fatal startup error: ${err instanceof Error ? err.message : String(err)}\n`)
  process.stderr.write(`[Worker] Stack: ${err instanceof Error ? err.stack : 'N/A'}\n`)
  process.exit(1)
}
