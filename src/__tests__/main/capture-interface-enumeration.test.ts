import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'events'
import type { Worker } from 'worker_threads'
import type { AnonPacket } from '../../shared/capture-types'

type TestCapDevice = {
  name: string
  description?: string
  addresses?: Array<{ addr?: string }>
}

interface MockWorker extends EventEmitter {
  postMessage: ReturnType<typeof vi.fn>
  terminate: ReturnType<typeof vi.fn>
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
  IpcBatcher: vi.fn(function mockIpcBatcher(this: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; push: ReturnType<typeof vi.fn>; discardPending: ReturnType<typeof vi.fn> }) {
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

describe('CaptureEngine interface enumeration', () => {
  let engine: CaptureEngine
  let enumerateInterfaces: ReturnType<typeof vi.fn<() => TestCapDevice[]>>

  beforeEach(async () => {
    enumerateInterfaces = vi.fn().mockReturnValue([
      {
        name: 'eth0',
        description: 'Ethernet 0',
        addresses: [{ addr: '192.168.1.10' }]
      }
    ])

    engine = new CaptureEngine(
      vi.fn() as (packets: AnonPacket[]) => void,
      enumerateInterfaces
    )
    engine.start()

    await new Promise((resolve) => setImmediate(resolve))
  })

  afterEach(() => {
    engine.stop()
    vi.clearAllMocks()
  })

  it('returns interfaces on successful worker enumeration', async () => {
    await expect(engine.getInterfaces()).resolves.toEqual({
      ok: true,
      interfaces: [{ name: 'eth0', displayName: 'Ethernet 0', isUp: true }]
    })
  })

  it('surfaces cap enumeration failures instead of collapsing them into an empty list', async () => {
    enumerateInterfaces.mockImplementation(() => {
      throw new Error('Npcap unavailable')
    })

    await expect(engine.getInterfaces()).resolves.toMatchObject({
      ok: false,
      error: expect.any(String),
      platformHint: expect.any(String)
    })
  })
})
