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
import { ensureNpcapDllPath } from './npcap-path'

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

  function mapInterfaceEnumerationError(err: unknown): Extract<InterfaceResult, { ok: false }> {
    const error = err instanceof Error ? err : new Error(String(err))
    const msg = error.message.toLowerCase()
    const code =
      (error as NodeJS.ErrnoException).code === 'EACCES' ||
      msg.includes('permission') ||
      msg.includes('access denied') ||
      msg.includes('npcap users') ||
      msg.includes('administrator')
        ? 'PERMISSION_DENIED'
        : msg.includes('cannot find module') ||
            msg.includes('module not found') ||
            msg.includes('npcap') ||
            msg.includes('libpcap')
          ? 'LIBRARY_UNAVAILABLE'
          : 'LIBRARY_UNAVAILABLE'
    const mapped = mapError(error, code)

    return {
      ok: false,
      error: mapped.message,
      platformHint: mapped.platformHint,
      diagnostic: error.stack ?? error.message
    }
  }

  function getInterfaces(): InterfaceResult {
    try {
      ensureNpcapDllPath()
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
      const { Cap } = require('cap') as { Cap: any }
      // Cap.deviceList() is a static method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const devices = Cap.deviceList() as Array<{
        name: string
        description?: string
        flags?: number
        addresses?: Array<{ addr?: string }>
      }>
      return {
        ok: true,
        interfaces: devices.map((d) => ({
          name: d.name,
          displayName: (() => {
            const base = d.description?.trim() || d.name
            const ipv4Hints = (d.addresses ?? [])
              .map((a) => a.addr)
              .filter(
                (addr): addr is string =>
                  typeof addr === 'string' &&
                  /^\d{1,3}(\.\d{1,3}){3}$/.test(addr) &&
                  !addr.startsWith('169.254.')
              )
              .slice(0, 2)
            return ipv4Hints.length > 0 ? `${base} (${ipv4Hints.join(', ')})` : base
          })(),
          isUp: true // cap doesn't expose up/down; default to true
        }))
      }
    } catch (err) {
      const result = mapInterfaceEnumerationError(err)
      console.error('[Worker] Failed to enumerate interfaces:', result.error)
      return result
    }
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
        // getInterfaces is now handled on the main thread — this case is kept
        // for backward compatibility but should not be called in normal operation.
        send({ type: 'interfaces', result: getInterfaces() })
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
