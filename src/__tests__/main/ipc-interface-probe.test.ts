import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { registeredHandlers, ipcMainHandle, loggerMock, workerInstances, WorkerMock } = vi.hoisted(
  () => {
    const registeredHandlers = new Map<string, (...args: unknown[]) => unknown>()

    class MockProbeWorker {
      private listeners = new Map<string, Set<(...args: unknown[]) => void>>()

      postMessage = vi.fn()
      terminate = vi.fn().mockResolvedValue(0)

      on(event: string, listener: (...args: unknown[]) => void): this {
        const listeners = this.listeners.get(event) ?? new Set<(...args: unknown[]) => void>()
        listeners.add(listener)
        this.listeners.set(event, listeners)
        return this
      }

      off(event: string, listener: (...args: unknown[]) => void): this {
        this.listeners.get(event)?.delete(listener)
        return this
      }

      emit(event: string, payload?: unknown): void {
        for (const listener of this.listeners.get(event) ?? []) {
          listener(payload)
        }
      }
    }

    const workerInstances: MockProbeWorker[] = []
    const WorkerMock = vi.fn(function MockWorker(_workerPath: string) {
      const worker = new MockProbeWorker()
      workerInstances.push(worker)
      return worker
    })

    return {
      registeredHandlers,
      ipcMainHandle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        registeredHandlers.set(channel, handler)
      }),
      loggerMock: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      },
      workerInstances,
      WorkerMock
    }
  }
)

vi.mock('electron', () => ({
  app: {},
  dialog: {},
  ipcMain: { handle: ipcMainHandle },
  shell: {}
}))

vi.mock('worker_threads', () => ({
  Worker: WorkerMock
}))

vi.mock('../../main/logger', () => ({
  Logger: loggerMock
}))

vi.mock('../../main/settings-store', () => ({
  getSettingsStore: vi.fn()
}))

vi.mock('../../main/packet-buffer', () => ({
  getPacketBuffer: vi.fn()
}))

vi.mock('../../main/capture', () => ({
  getCaptureEngine: vi.fn()
}))

vi.mock('../../main/parser', () => ({
  Parser: { print: vi.fn() }
}))

vi.mock('../../main/anonymizer', () => ({
  Anonymizer: { anonymize: vi.fn((packet) => packet) }
}))

vi.mock('../../main/filter-engine', () => ({
  evaluate: vi.fn(),
  parse: vi.fn()
}))

import { registerIpcHandlers } from '../../main/ipc-handlers'

describe('capture:getInterfaces probe worker handler', () => {
  beforeEach(() => {
    registeredHandlers.clear()
    workerInstances.length = 0
    ipcMainHandle.mockClear()
    loggerMock.info.mockClear()
    loggerMock.debug.mockClear()
    loggerMock.warn.mockClear()
    loggerMock.error.mockClear()
    WorkerMock.mockClear()
    vi.useRealTimers()

    registerIpcHandlers(() => null)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function invokeHandler(): Promise<unknown> {
    const handler = registeredHandlers.get('capture:getInterfaces')
    expect(handler).toBeDefined()
    // TypeScript assertion after runtime check
    return (handler as () => Promise<unknown>)()
  }

  it('uses a short-lived probe worker and returns successful interface results', async () => {
    const resultPromise = invokeHandler()

    expect(WorkerMock).toHaveBeenCalledWith(expect.stringContaining('capture-worker.js'))
    expect(workerInstances).toHaveLength(1)
    expect(workerInstances[0]!.postMessage).toHaveBeenCalledWith({ type: 'get-interfaces' })

    workerInstances[0]!.emit('message', {
      type: 'interfaces',
      result: {
        ok: true,
        interfaces: [{ name: 'eth0', displayName: 'Ethernet', isUp: true }]
      }
    })

    await expect(resultPromise).resolves.toEqual({
      ok: true,
      interfaces: [{ name: 'eth0', displayName: 'Ethernet', isUp: true }]
    })
    expect(workerInstances[0]!.terminate).toHaveBeenCalledTimes(1)
  })

  it('returns a structured failure when the probe worker times out', async () => {
    vi.useFakeTimers()

    const resultPromise = invokeHandler()

    await vi.advanceTimersByTimeAsync(3000)

    await expect(resultPromise).resolves.toMatchObject({
      ok: false,
      error: 'The packet capture library could not be loaded. Live capture is unavailable.'
    })
    expect(workerInstances[0]!.terminate).toHaveBeenCalledTimes(1)
  })
})
