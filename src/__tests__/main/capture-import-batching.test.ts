import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'events'
import type { Worker } from 'worker_threads'
import type { AnonPacket, ParsedPacket, CaptureError } from '../../shared/capture-types'

interface MockWorker extends EventEmitter {
  postMessage: ReturnType<typeof vi.fn>
  terminate: ReturnType<typeof vi.fn>
}

interface MockBatcher {
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  push: ReturnType<typeof vi.fn>
  discardPending: ReturnType<typeof vi.fn>
}

vi.mock('worker_threads', () => ({
  Worker: vi.fn()
}))

vi.mock('../../main/capture/worker-supervisor', () => {
  const { EventEmitter } = require('events')

  class MockWorkerSupervisor extends EventEmitter {
    _mockWorker: MockWorker | null = null

    start(): MockWorker {
      const mockWorker = new EventEmitter() as MockWorker
      mockWorker.postMessage = vi.fn()
      mockWorker.terminate = vi.fn()
      this._mockWorker = mockWorker

      setImmediate(() => {
        this.emit('worker', mockWorker)
      })

      return mockWorker
    }

    stop(): void {}

    getWorker(): Worker | null {
      return this._mockWorker as unknown as Worker | null
    }
  }

  return {
    WorkerSupervisor: MockWorkerSupervisor
  }
})

vi.mock('../../main/capture/ipc-batcher', () => ({
  IpcBatcher: vi.fn(function mockIpcBatcher(this: MockBatcher) {
    this.start = vi.fn()
    this.stop = vi.fn()
    this.push = vi.fn()
    this.discardPending = vi.fn()
  })
}))

vi.mock('../../main/logger', () => ({
  Logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

import { CaptureEngine } from '../../main/capture'

describe('CaptureEngine import batching', () => {
  let engine: CaptureEngine
  let mockWorker: MockWorker
  let mockBatcher: MockBatcher

  type EngineInternals = {
    supervisor: { _mockWorker: MockWorker }
    batcher: MockBatcher
  }

  beforeEach(async () => {
    engine = new CaptureEngine(vi.fn() as (packets: AnonPacket[]) => void)
    engine.start()

    await new Promise((resolve) => setImmediate(resolve))
    const internals = engine as unknown as EngineInternals
    mockWorker = internals.supervisor._mockWorker
    mockBatcher = internals.batcher
  })

  afterEach(() => {
    engine.stop()
    vi.clearAllMocks()
  })

  it('suppresses renderer packet batching during import while still emitting packets for buffer storage', async () => {
    const packetListener = vi.fn()
    const parsedPacket: ParsedPacket = {
      id: 'import-packet-1',
      timestamp: 1_700_000_000_000,
      sourceId: 'capture.pcap',
      captureMode: 'file',
      wireLength: 64,
      layers: []
    }

    engine.on('packet', packetListener)

    const importPromise = engine.importFile('/test/import.pcap')
    const startFileCall = mockWorker.postMessage.mock.calls.find(
      ([message]) => message.type === 'start-file'
    )
    const requestId = startFileCall?.[0]?.requestId as string
    const messageHandler = mockWorker.listeners('message')[0] as (message: unknown) => void

    expect(mockBatcher.discardPending).toHaveBeenCalledTimes(1)

    messageHandler({ type: 'packet-batch', packets: [parsedPacket] })

    expect(packetListener).toHaveBeenCalledWith(parsedPacket)
    expect(mockBatcher.push).not.toHaveBeenCalled()

    messageHandler({ type: 'command-complete', requestId })

    await expect(importPromise).resolves.toBeUndefined()
  })

  it('continues to forward streaming file packets through the IPC batcher', async () => {
    const parsedPacket: ParsedPacket = {
      id: 'stream-packet-1',
      timestamp: 1_700_000_000_001,
      sourceId: 'capture.pcap',
      captureMode: 'file',
      wireLength: 128,
      layers: []
    }

    const startFilePromise = engine.startFile('/test/stream.pcap')
    const startFileCall = mockWorker.postMessage.mock.calls.find(
      ([message]) => message.type === 'start-file'
    )
    const requestId = startFileCall?.[0]?.requestId as string
    const messageHandler = mockWorker.listeners('message')[0] as (message: unknown) => void

    messageHandler({ type: 'packet-batch', packets: [parsedPacket] })
    messageHandler({ type: 'command-ok', requestId })

    await expect(startFilePromise).resolves.toBeUndefined()
    expect(mockBatcher.push).toHaveBeenCalledWith(parsedPacket)
  })

  it('rejects pending import immediately when worker emits a runtime error', async () => {
    const runtimeError: CaptureError = {
      code: 'FILE_INVALID_FORMAT',
      message: 'Invalid PCAP payload'
    }

    const importPromise = engine.importFile('/test/bad-file.pcap')
    const messageHandler = mockWorker.listeners('message')[0] as (message: unknown) => void

    messageHandler({ type: 'error', error: runtimeError })

    await expect(importPromise).rejects.toMatchObject({
      code: 'FILE_INVALID_FORMAT',
      message: 'Invalid PCAP payload'
    })
  })
})
