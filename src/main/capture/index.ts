import * as path from 'path'
import { randomUUID } from 'crypto'
import { EventEmitter } from 'events'
import { execFileSync } from 'child_process'
import type { Worker } from 'worker_threads'
import type {
  AnonPacket,
  ParsedPacket,
  CaptureError,
  NetworkInterface,
  SpeedMultiplier,
  WorkerInMessage,
  WorkerOutMessage
} from '../../shared/capture-types'
import type { InterfaceResult } from '../../shared/ipc-types'
import {
  classifyInterfaceKind,
  semanticInterfaceLabel,
  withInterfaceRecommendation
} from '../../shared/interface-classification'
import { WorkerSupervisor } from './worker-supervisor'
import { IpcBatcher } from './ipc-batcher'
import { CapSource } from './cap-source'
import { Parser } from '../parser'
import { Logger } from '../logger'
import { ensureNpcapDllPath } from './npcap-path'
import { mapError } from './errors'

// Extended out-message type to handle interfaces response (not in shared protocol)
type WorkerOutMessageExtended =
  | WorkerOutMessage
  | { type: 'interfaces'; result: InterfaceResult }
  | { type: 'packet-batch'; packets: ParsedPacket[] } // Worker sends ParsedPacket

type PendingCommand = {
  resolve: () => void
  reject: (e: CaptureError) => void
  timeoutId: ReturnType<typeof setTimeout>
}

type CapDevice = {
  name: string
  description?: string
  addresses?: Array<{ addr?: string }>
}

type InterfaceEnumerator = () => CapDevice[]

type WindowsAdapter = {
  ifIndex?: number
  Name?: string
  InterfaceDescription?: string
  InterfaceGuid?: string
  Status?: string
}

type WindowsIpInterface = {
  InterfaceIndex?: number
  InterfaceMetric?: number
}

type WindowsRoute = {
  InterfaceIndex?: number
  RouteMetric?: number
}

type WindowsIpAddress = {
  InterfaceIndex?: number
  IPAddress?: string
}

type WindowsInterfaceProbe = {
  adapters?: WindowsAdapter[] | WindowsAdapter
  ipInterfaces?: WindowsIpInterface[] | WindowsIpInterface
  routes?: WindowsRoute[] | WindowsRoute
  ipAddresses?: WindowsIpAddress[] | WindowsIpAddress
}

type WindowsInterfaceMetadata = {
  ifIndex: number
  name: string
  description: string
  guid: string
  isUp: boolean
  isDefaultRoute: boolean
  hasAddress: boolean
}

function defaultInterfaceEnumerator(): CapDevice[] {
  ensureNpcapDllPath()
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const { Cap } = require('cap') as { Cap: any }
  return Cap.deviceList() as CapDevice[]
}

function asArray<T>(value: T[] | T | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function normalizeGuid(value?: string): string {
  return (value ?? '').replace(/[{}]/g, '').toLowerCase()
}

function extractGuid(value: string): string {
  const match = value.match(
    /[({]?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[)}]?/i
  )
  return normalizeGuid(match?.[1])
}

function getWindowsInterfaceMetadata(): WindowsInterfaceMetadata[] {
  if (process.platform !== 'win32' || process.env.VITEST) return []

  try {
    const script = [
      "$ErrorActionPreference='SilentlyContinue'",
      '$adapters=Get-NetAdapter | Select-Object ifIndex,Name,InterfaceDescription,InterfaceGuid,Status',
      '$ipifs=Get-NetIPInterface -AddressFamily IPv4 | Select-Object InterfaceIndex,InterfaceMetric',
      "$routes=Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' | Select-Object InterfaceIndex,RouteMetric",
      '$ips=Get-NetIPAddress -AddressFamily IPv4 | Select-Object InterfaceIndex,IPAddress',
      '[pscustomobject]@{adapters=$adapters;ipInterfaces=$ipifs;routes=$routes;ipAddresses=$ips} | ConvertTo-Json -Depth 5'
    ].join('; ')

    const raw = execFileSync('powershell.exe', ['-NoProfile', '-Command', script], {
      encoding: 'utf8',
      timeout: 1500,
      maxBuffer: 1024 * 1024,
      windowsHide: true
    })
    const parsed = JSON.parse(raw) as WindowsInterfaceProbe
    const adapters = asArray(parsed.adapters)
    const ipInterfaces = asArray(parsed.ipInterfaces)
    const routes = asArray(parsed.routes)
    const ipAddresses = asArray(parsed.ipAddresses)

    const metricsByIndex = new Map<number, number>()
    for (const ipInterface of ipInterfaces) {
      if (typeof ipInterface.InterfaceIndex === 'number') {
        metricsByIndex.set(ipInterface.InterfaceIndex, ipInterface.InterfaceMetric ?? 0)
      }
    }

    let defaultRouteIndex: number | null = null
    let defaultRouteMetric = Number.POSITIVE_INFINITY
    for (const route of routes) {
      if (typeof route.InterfaceIndex !== 'number') continue
      const totalMetric = (route.RouteMetric ?? 0) + (metricsByIndex.get(route.InterfaceIndex) ?? 0)
      if (totalMetric < defaultRouteMetric) {
        defaultRouteMetric = totalMetric
        defaultRouteIndex = route.InterfaceIndex
      }
    }

    const addressIndexes = new Set(
      ipAddresses
        .filter(
          (address) => typeof address.InterfaceIndex === 'number' && Boolean(address.IPAddress)
        )
        .map((address) => address.InterfaceIndex as number)
    )

    return adapters
      .filter((adapter) => typeof adapter.ifIndex === 'number')
      .map((adapter) => ({
        ifIndex: adapter.ifIndex as number,
        name: adapter.Name ?? '',
        description: adapter.InterfaceDescription ?? '',
        guid: normalizeGuid(adapter.InterfaceGuid),
        isUp: adapter.Status === 'Up',
        isDefaultRoute: adapter.ifIndex === defaultRouteIndex,
        hasAddress: addressIndexes.has(adapter.ifIndex as number)
      }))
  } catch (err) {
    Logger.debug('CaptureEngine', 'Windows interface metadata unavailable', {
      error: err instanceof Error ? err.message : String(err)
    })
    return []
  }
}

function findWindowsMetadata(
  device: CapDevice,
  metadata: WindowsInterfaceMetadata[]
): WindowsInterfaceMetadata | undefined {
  const deviceGuid = extractGuid(device.name)
  const description = (device.description ?? '').trim().toLowerCase()

  return metadata.find((item) => {
    if (deviceGuid && item.guid === deviceGuid) return true
    if (description && item.description.toLowerCase() === description) return true
    return false
  })
}

function buildNetworkInterface(
  device: CapDevice,
  metadata: WindowsInterfaceMetadata[]
): NetworkInterface {
  const windowsMetadata = findWindowsMetadata(device, metadata)
  const displayName = device.description?.trim() || windowsMetadata?.description || device.name
  const base = {
    name: device.name,
    displayName
  }
  const kind = classifyInterfaceKind(base)
  const hasAddress =
    windowsMetadata?.hasAddress ??
    Boolean(device.addresses?.some((address) => Boolean(address.addr)))

  return {
    ...base,
    isUp: windowsMetadata?.isUp ?? true,
    kind,
    semanticLabel: semanticInterfaceLabel(kind),
    isDefaultRoute: windowsMetadata?.isDefaultRoute ?? false,
    hasAddress,
    isCaptureCapable: true
  }
}

export class CaptureEngine extends EventEmitter {
  private static readonly COMMAND_TIMEOUT_MS = 30_000
  private supervisor: WorkerSupervisor
  private batcher: IpcBatcher
  private worker: Worker | null = null
  private boundWorker: Worker | null = null
  private boundMessageHandler: ((msg: WorkerOutMessageExtended) => void) | null = null
  private started = false
  private suppressRendererPackets = false
  // Live capture runs on the main thread — cap native addon is not safe in worker_threads on Windows
  private liveSource: CapSource | null = null
  // BUGFIX-01: pending command promises keyed by requestId
  private pendingCommands = new Map<string, PendingCommand>()

  // Stable handler for supervisor 'worker' events
  private readonly handleWorkerReplacement = (worker: Worker): void => {
    this.rebindWorker(worker)
  }

  constructor(
    sendToRenderer: (packets: AnonPacket[]) => void,
    private readonly enumerateInterfaces: InterfaceEnumerator = defaultInterfaceEnumerator
  ) {
    super()
    const workerPath = path.join(__dirname, 'capture-worker.js')
    this.supervisor = new WorkerSupervisor(workerPath)
    this.batcher = new IpcBatcher(sendToRenderer) // Batcher anonymizes before sending to renderer
  }

  private rejectPendingCommands(reason: string): void {
    // Check if an import is in progress (any key starting with 'complete:')
    // importFile() manages suppressRendererPackets via try/finally; resetting it here
    // during a worker crash mid-import would allow packets from the restarted worker
    // to reach the renderer before the import caller handles the rejection.
    const importInProgress = Array.from(this.pendingCommands.keys()).some((k) =>
      k.startsWith('complete:')
    )
    for (const [key, pending] of this.pendingCommands.entries()) {
      clearTimeout(pending.timeoutId)
      pending.reject({
        code: 'UNKNOWN',
        message: reason
      } satisfies CaptureError)
      this.pendingCommands.delete(key)
    }
    // Only reset suppress after all commands are rejected, and only if no import was running
    if (!importInProgress) {
      this.suppressRendererPackets = false
    }
  }

  private rejectPendingCommandsOnWorkerLoss(): void {
    this.rejectPendingCommands('Worker restarted before command completed')
  }

  private setPendingCommand(
    key: string,
    commandType: WorkerInMessage['type'],
    requestId: string,
    resolve: () => void,
    reject: (e: CaptureError) => void
  ): void {
    const timeoutId = setTimeout(() => {
      const pending = this.pendingCommands.get(key)
      if (!pending) return
      this.pendingCommands.delete(key)
      pending.reject({
        code: 'UNKNOWN',
        message: `Capture command "${commandType}" timed out after ${CaptureEngine.COMMAND_TIMEOUT_MS}ms (requestId: ${requestId}).`
      } satisfies CaptureError)
    }, CaptureEngine.COMMAND_TIMEOUT_MS)

    this.pendingCommands.set(key, { resolve, reject, timeoutId })
  }

  private clearPendingCommand(key: string): PendingCommand | undefined {
    const pending = this.pendingCommands.get(key)
    if (!pending) return undefined
    clearTimeout(pending.timeoutId)
    this.pendingCommands.delete(key)
    return pending
  }

  private rejectPendingCommandsWithPrefix(prefix: string, error: CaptureError): void {
    const matchingKeys = Array.from(this.pendingCommands.keys()).filter((key) =>
      key.startsWith(prefix)
    )
    for (const key of matchingKeys) {
      const pending = this.clearPendingCommand(key)
      pending?.reject(error)
    }
  }

  private rebindWorker(worker: Worker): void {
    // Step 1: unbind old handler
    if (this.boundWorker && this.boundMessageHandler) {
      this.boundWorker.off('message', this.boundMessageHandler)
    }
    // Step 2: reject all pending commands from the dead worker
    this.rejectPendingCommandsOnWorkerLoss()
    // Step 3: bind new worker
    this.boundWorker = worker
    this.worker = worker
    this.boundMessageHandler = (msg: WorkerOutMessageExtended) => this.handleWorkerMessage(msg)
    worker.on('message', this.boundMessageHandler)
    Logger.info('CaptureEngine', 'Bound to new worker')
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.batcher.start()
    this.supervisor.on('worker', this.handleWorkerReplacement)
    this.supervisor.start()
  }

  stop(): void {
    if (this.boundWorker && this.boundMessageHandler) {
      this.boundWorker.off('message', this.boundMessageHandler)
    }
    this.rejectPendingCommands('Capture engine stopped before command completed')
    this.supervisor.off('worker', this.handleWorkerReplacement)
    this.supervisor.stop()
    this.batcher.stop()
    // Stop live source if running
    if (this.liveSource) {
      void this.liveSource.stop().catch(() => {})
      this.liveSource = null
    }
    this.worker = null
    this.boundWorker = null
    this.boundMessageHandler = null
    this.started = false
  }

  async getInterfaces(): Promise<InterfaceResult> {
    // Run Cap.deviceList() directly on the main thread — never in the worker.
    // The cap native addon's pcap_dispatch background thread is not safe in worker_threads
    // on Windows with Npcap; running it on the main thread avoids the env assertion crash.
    try {
      const devices = this.enumerateInterfaces()
      const windowsMetadata = getWindowsInterfaceMetadata()
      const interfaces = withInterfaceRecommendation(
        devices.map((device) => buildNetworkInterface(device, windowsMetadata))
      ).sort((a, b) => {
        if (a.isRecommended !== b.isRecommended) return a.isRecommended ? -1 : 1
        return (b.recommendationScore ?? 0) - (a.recommendationScore ?? 0)
      })
      return {
        ok: true,
        interfaces
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      const mapped = mapError(error, 'LIBRARY_UNAVAILABLE')
      return {
        ok: false,
        error: mapped.message,
        platformHint: mapped.platformHint,
        diagnostic: error.stack ?? error.message
      }
    }
  }

  // Live capture runs entirely on the main thread — cap native addon crashes in worker_threads
  // on Windows with Npcap due to pcap_dispatch background thread / Node.js env lifetime mismatch.
  async startCapture(iface: string): Promise<void> {
    if (this.liveSource) {
      throw mapError(new Error('Live capture already running'), 'UNKNOWN')
    }

    const source = new CapSource(iface)

    source.onPacket((raw) => {
      const parsed = Parser.parse(raw)
      this.emit('packet', parsed)
      if (!this.suppressRendererPackets) {
        this.batcher.push(parsed)
        // Yield to the event loop so the IpcBatcher's setInterval flush can fire.
        // cap's packet callbacks on Windows can fire in a tight synchronous loop,
        // starving the event loop and preventing the 50ms interval from running.
        // setImmediate schedules the flush check after the current I/O event completes.
        setImmediate(() => this.batcher.flushIfPending())
      }
    })

    source.onError((err) => {
      this.emit('error', err)
    })

    source.onStopped(() => {
      this.liveSource = null
      this.emit('stopped')
    })

    // Throws on startup failure (BUGFIX-02)
    await source.start()
    this.liveSource = source
    this.emit('started-live', iface)
  }

  async stopCapture(): Promise<void> {
    if (this.liveSource) {
      // Live capture — stop the main-thread source directly
      await this.liveSource.stop()
      this.liveSource = null
      return
    }
    // File/simulated capture — stop via worker
    return this.postCommandOnOk({ type: 'stop', requestId: '' })
  }

  // BUGFIX-01: startFile resolves on command-ok (startup confirmed)
  async startFile(filePath: string): Promise<void> {
    await this.postCommandOnOk({ type: 'start-file', filePath, requestId: '' })
    this.emit('started-file', filePath)
  }

  // BUGFIX-04: importFile resolves on command-complete (file streaming fully done)
  // Used by pcap:import to know when all packets have been processed
  async importFile(filePath: string): Promise<void> {
    this.suppressRendererPackets = true
    this.batcher.discardPending()

    try {
      await this.postCommand({ type: 'start-file', filePath, requestId: '' })
    } finally {
      this.suppressRendererPackets = false
    }
  }

  async startSimulated(pcapPath: string, speedMultiplier: SpeedMultiplier): Promise<void> {
    await this.postCommandOnOk({
      type: 'start-simulated',
      filePath: pcapPath,
      speed: speedMultiplier,
      requestId: ''
    })
    this.emit('started-simulated', pcapPath, speedMultiplier)
  }

  on(event: 'packet', handler: (p: ParsedPacket) => void): this
  on(event: 'error', handler: (e: CaptureError) => void): this
  on(event: 'stopped', handler: () => void): this
  on(event: 'capture-error', handler: (e: CaptureError) => void): this
  on(event: 'started-live', handler: (iface: string) => void): this
  on(event: 'started-file', handler: (filePath: string) => void): this
  on(event: 'started-simulated', handler: (filePath: string, speed: SpeedMultiplier) => void): this
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, handler: (...args: any[]) => void): this {
    return super.on(event, handler)
  }

  once(event: 'packet', handler: (p: ParsedPacket) => void): this
  once(event: 'error', handler: (e: CaptureError) => void): this
  once(event: 'capture-error', handler: (e: CaptureError) => void): this
  once(event: 'stopped', handler: () => void): this
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  once(event: string, handler: (...args: any[]) => void): this {
    return super.once(event, handler)
  }

  // BUGFIX-01: generate requestId, store pending promise, post message
  // Resolves on command-complete (for long-running file streaming operations)
  private postCommand(msg: WorkerInMessage): Promise<void> {
    const requestId = randomUUID()
    const msgWithId = { ...msg, requestId }
    return new Promise<void>((resolve, reject) => {
      if (!this.worker) {
        reject({ code: 'UNKNOWN', message: 'Worker not running' } satisfies CaptureError)
        return
      }
      // Store with a flag so command-complete resolves it (not command-ok)
      this.setPendingCommand(`complete:${requestId}`, msg.type, requestId, resolve, reject)
      // Also store for command-ok (startup confirmation) — but we don't resolve on it here
      this.worker.postMessage(msgWithId)
    })
  }

  // Resolves on command-ok (startup confirmed), ignores command-complete
  private postCommandOnOk(msg: WorkerInMessage): Promise<void> {
    const requestId = randomUUID()
    const msgWithId = { ...msg, requestId }
    return new Promise<void>((resolve, reject) => {
      if (!this.worker) {
        reject({ code: 'UNKNOWN', message: 'Worker not running' } satisfies CaptureError)
        return
      }
      this.setPendingCommand(requestId, msg.type, requestId, resolve, reject)
      this.worker.postMessage(msgWithId)
    })
  }

  private handleWorkerMessage(msg: WorkerOutMessageExtended): void {
    switch (msg.type) {
      case 'packet-batch':
        // Emit ParsedPacket to handler (for buffer storage), then push to batcher (for IPC)
        for (const p of (msg as { type: 'packet-batch'; packets: ParsedPacket[] }).packets) {
          this.emit('packet', p) // Store in buffer
          if (!this.suppressRendererPackets) {
            this.batcher.push(p) // Anonymize and send to renderer
          }
        }
        break
      case 'error':
        {
          const error = (msg as { type: 'error'; error: CaptureError }).error
          this.emit('capture-error', error)
          if (this.listenerCount('error') > 0) {
            this.emit('error', error)
          }
        }
        // Runtime source errors do not carry requestId.
        // If an import is waiting on command-complete, fail it immediately to avoid UI hangs.
        this.rejectPendingCommandsWithPrefix(
          'complete:',
          (msg as { type: 'error'; error: CaptureError }).error
        )
        break
      case 'stopped':
        this.emit('stopped')
        break
      // BUGFIX-01: resolve/reject pending command promises
      case 'command-ok': {
        const pending = this.clearPendingCommand(msg.requestId)
        if (pending) {
          pending.resolve()
        }
        break
      }
      case 'command-error': {
        // Reject both ok-keyed and complete-keyed pending entries
        const pending =
          this.clearPendingCommand(msg.requestId) ??
          this.clearPendingCommand(`complete:${msg.requestId}`)
        if (pending) {
          pending.reject(msg.error)
        }
        break
      }
      // BUGFIX-04: command-complete signals end of long-running file streaming
      case 'command-complete': {
        const pending = this.clearPendingCommand(`complete:${msg.requestId}`)
        if (pending) {
          pending.resolve()
        }
        break
      }
      // 'interfaces' and 'metrics' are handled elsewhere or ignored here
    }
  }
}

// ─── Singleton accessor (mirrors SettingsStore / PacketBuffer pattern) ────────

let _engine: CaptureEngine | null = null

/**
 * Initialize the singleton CaptureEngine. Called once in main/index.ts.
 * @param sendToRenderer - Callback to send anonymized packets to renderer via IPC
 */
export function initCaptureEngine(sendToRenderer: (packets: AnonPacket[]) => void): CaptureEngine {
  _engine = new CaptureEngine(sendToRenderer)
  _engine.start()
  return _engine
}

/**
 * Get the singleton CaptureEngine instance.
 * Throws if called before initCaptureEngine().
 */
export function getCaptureEngine(): CaptureEngine {
  if (!_engine) {
    throw new Error('CaptureEngine not initialized. Call initCaptureEngine() first.')
  }
  return _engine
}
