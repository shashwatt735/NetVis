import { parentPort } from 'worker_threads'
import type {
  WorkerInMessage,
  WorkerOutMessage,
  NetworkInterface,
  RawPacket
} from '../../shared/capture-types'
import { CaptureController } from './capture-controller'
import { mapError } from './errors'
import { Parser } from '../parser'
import { Anonymizer } from '../anonymizer'

if (!parentPort) throw new Error('capture-worker must run as a worker thread')

// Local type extension for messages not in the shared protocol
type WorkerInMessageExtended = WorkerInMessage | { type: 'get-interfaces' }

type WorkerOutMessageExtended =
  | WorkerOutMessage
  | { type: 'interfaces'; interfaces: NetworkInterface[] }

function send(msg: WorkerOutMessageExtended): void {
  parentPort!.postMessage(msg)
}

function getInterfaces(): NetworkInterface[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Cap } = require('cap') as {
      Cap: { deviceList(): Array<{ name: string; description?: string; flags?: number }> }
    }
    const devices = Cap.deviceList()
    return devices.map((d) => ({
      name: d.name,
      displayName: d.description || d.name,
      isUp: true // cap doesn't expose up/down; default to true
    }))
  } catch {
    return []
  }
}

// Remove toAnonPacket() and extractConvenienceFields() — Anonymizer handles this now

const controller = new CaptureController(
  (packet: RawPacket) => {
    const parsed = Parser.parse(packet)
    const anon = Anonymizer.anonymize(parsed) // Use Anonymizer (ARCH-04)
    send({ type: 'packet-batch', packets: [anon] })
  },
  (error) => {
    send({ type: 'error', error })
  },
  () => {
    send({ type: 'stopped' })
  },
  () => {
    // onStatus: no-op for now — status is communicated via error/stopped messages
  }
)

parentPort.on('message', (msg: WorkerInMessageExtended) => {
  switch (msg.type) {
    case 'get-interfaces':
      send({ type: 'interfaces', interfaces: getInterfaces() })
      break

    case 'start-live':
      controller.startLive(msg.iface).catch((err: Error) => {
        send({ type: 'error', error: mapError(err, 'UNKNOWN') })
      })
      break

    case 'start-file':
      controller.startFile(msg.filePath).catch((err: Error) => {
        send({ type: 'error', error: mapError(err, 'UNKNOWN') })
      })
      break

    case 'start-simulated':
      controller.startSimulated(msg.filePath, msg.speed).catch((err: Error) => {
        send({ type: 'error', error: mapError(err, 'UNKNOWN') })
      })
      break

    case 'stop':
      controller.stop().catch((err: Error) => {
        send({ type: 'error', error: mapError(err, 'UNKNOWN') })
      })
      break
  }
})
