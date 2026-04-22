/**
 * File-Mode Status Flow Regression Tests
 * 
 * Tests the REAL CaptureEngine implementation with mocked WorkerSupervisor and IpcBatcher.
 * 
 * Verifies that:
 * 1. startFile() emits 'started-file' after command-ok (streaming path)
 * 2. importFile() does NOT emit 'started-file' after command-complete (batch import path)
 * 
 * This is a true regression test against src/main/capture/index.ts.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'events'
import type { Worker } from 'worker_threads'
import type { AnonPacket } from '../../shared/capture-types'

// Typed mock worker used throughout this test file
interface MockWorker extends EventEmitter {
  postMessage: ReturnType<typeof vi.fn>
  terminate: ReturnType<typeof vi.fn>
}

/**
 * Find the postMessage call for a given message type and assert it exists.
 * Returns the call arguments with a non-null guarantee.
 */
function findPostMessageCall(
  mockWorker: MockWorker,
  type: string,
  filePath?: string
): [{ type: string; requestId: string; filePath?: string; [k: string]: unknown }] {
  const call = (mockWorker.postMessage.mock.calls as Array<[{ type: string; filePath?: string; requestId: string }]>).find(
    ([msg]) => msg.type === type && (filePath === undefined || msg.filePath === filePath)
  )
  if (!call) throw new Error(`No postMessage call found for type="${type}" filePath="${filePath}"`)
  return call
}

// Mock worker_threads before importing CaptureEngine
vi.mock('worker_threads', () => ({
  Worker: vi.fn()
}))

// Mock WorkerSupervisor
vi.mock('../../main/capture/worker-supervisor', () => {
  const { EventEmitter } = require('events')
  
  class MockWorkerSupervisor extends EventEmitter {
    _mockWorker: any = null
    
    start() {
      // Create a mock worker
      const mockWorker = new EventEmitter() as any
      mockWorker.postMessage = vi.fn()
      mockWorker.terminate = vi.fn()
      mockWorker.removeAllListeners = vi.fn()
      
      this._mockWorker = mockWorker
      
      // Emit 'worker' event immediately
      setImmediate(() => {
        this.emit('worker', mockWorker)
      })
      
      return mockWorker
    }
    
    stop() {}
    
    getWorker() {
      return this._mockWorker
    }
  }
  
  return {
    WorkerSupervisor: MockWorkerSupervisor
  }
})

// Mock IpcBatcher
vi.mock('../../main/capture/ipc-batcher', () => ({
  IpcBatcher: vi.fn(function(this: any) {
    this.start = vi.fn()
    this.stop = vi.fn()
    this.push = vi.fn()
    this.discardPending = vi.fn()
  })
}))

// Mock Logger
vi.mock('../../main/logger', () => ({
  Logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

// Now import CaptureEngine after mocks are set up
import { CaptureEngine } from '../../main/capture'
import { WorkerSupervisor } from '../../main/capture/worker-supervisor'

describe('File-Mode Status Flow - Real CaptureEngine', () => {
  let engine: CaptureEngine
  let mockWorker: MockWorker
  let sendToRenderer: (packets: AnonPacket[]) => void

  beforeEach(async () => {
    vi.clearAllMocks()
    sendToRenderer = vi.fn() as (packets: AnonPacket[]) => void
    
    // Create real CaptureEngine instance
    engine = new CaptureEngine(sendToRenderer)
    engine.start()
    
    // Wait for worker to be bound
    await new Promise(resolve => setImmediate(resolve))
    
    // Get the mock worker from the supervisor
    // The supervisor is a MockWorkerSupervisor instance
    mockWorker = (engine as any).supervisor._mockWorker as MockWorker
    
    expect(mockWorker).toBeDefined()
  })

  afterEach(() => {
    if (engine) {
      engine.stop()
    }
  })

  describe('startFile() - streaming path', () => {
    it('emits started-file event after command-ok is received', async () => {
      const testPath = '/test/streaming.pcap'
      const startedFileEvents: string[] = []

      // Listen for started-file event
      engine.on('started-file', (path: string) => {
        startedFileEvents.push(path)
      })

      // Start the file operation
      const promise = engine.startFile(testPath)

      // Wait for postMessage to be called
      await new Promise(resolve => setImmediate(resolve))
      
      // Find the message handler
      const messageHandler = mockWorker.listeners('message')[0]
      expect(messageHandler).toBeDefined()
      
      // Get the requestId from the postMessage call
      const [{ requestId }] = findPostMessageCall(mockWorker, 'start-file')
      expect(requestId).toBeDefined()
      
      // Send command-ok from worker
      messageHandler({ type: 'command-ok', requestId })
      
      await promise

      // Verify started-file was emitted
      expect(startedFileEvents).toHaveLength(1)
      expect(startedFileEvents[0]).toBe(testPath)
    })

    it('emits started-file AFTER postCommandOnOk resolves', async () => {
      const testPath = '/test/order.pcap'
      const timeline: string[] = []

      engine.on('started-file', () => {
        timeline.push('started-file-emitted')
      })

      // Start the operation
      const promise = engine.startFile(testPath).then(() => {
        timeline.push('startFile-resolved')
      })

      // Simulate worker response
      await new Promise(resolve => setImmediate(resolve))
      
      const messageHandler = mockWorker.listeners('message')[0]
      const [{ requestId }] = findPostMessageCall(mockWorker, 'start-file')
      
      messageHandler({ type: 'command-ok', requestId })
      
      await promise

      // Verify: started-file is emitted synchronously after await, before .then() callback
      // This is correct - the event fires immediately after the promise resolves
      expect(timeline).toEqual([
        'started-file-emitted',
        'startFile-resolved'
      ])
    })

    it('uses postCommandOnOk which resolves on command-ok', async () => {
      const testPath = '/test/command-ok.pcap'

      const promise = engine.startFile(testPath)

      await new Promise(resolve => setImmediate(resolve))
      
      const messageHandler = mockWorker.listeners('message')[0]
      const [{ requestId }] = findPostMessageCall(mockWorker, 'start-file')
      
      // Send command-ok (not command-complete)
      messageHandler({ type: 'command-ok', requestId })
      
      // Should resolve
      await expect(promise).resolves.toBeUndefined()
    })
  })

  describe('importFile() - batch import path', () => {
    it('does NOT emit started-file event after command-complete', async () => {
      const testPath = '/test/import.pcap'
      const startedFileEvents: string[] = []

      // Listen for started-file event
      engine.on('started-file', (path: string) => {
        startedFileEvents.push(path)
      })

      // Start the import operation
      const promise = engine.importFile(testPath)

      // Wait for postMessage to be called
      await new Promise(resolve => setImmediate(resolve))
      
      const messageHandler = mockWorker.listeners('message')[0]
      const [{ requestId }] = findPostMessageCall(mockWorker, 'start-file')
      
      // Send command-complete (not command-ok)
      messageHandler({ type: 'command-complete', requestId })
      
      await promise

      // Wait a bit to ensure no delayed emissions
      await new Promise(resolve => setTimeout(resolve, 50))

      // Verify NO started-file was emitted
      expect(startedFileEvents).toHaveLength(0)
    })

    it('resolves after command-complete without emitting started-file', async () => {
      const testPath = '/test/batch.pcap'
      const timeline: string[] = []

      engine.on('started-file', () => {
        timeline.push('started-file-emitted')
      })

      // Start the operation
      const promise = engine.importFile(testPath).then(() => {
        timeline.push('importFile-resolved')
      })

      // Simulate worker response
      await new Promise(resolve => setImmediate(resolve))
      
      const messageHandler = mockWorker.listeners('message')[0]
      const [{ requestId }] = findPostMessageCall(mockWorker, 'start-file')
      messageHandler({ type: 'command-complete', requestId })
      
      await promise

      // Wait to ensure no delayed emissions
      await new Promise(resolve => setTimeout(resolve, 50))

      // Verify only importFile resolved, no started-file emission
      expect(timeline).toEqual(['importFile-resolved'])
    })

    it('uses postCommand which resolves on command-complete', async () => {
      const testPath = '/test/command-complete.pcap'

      const promise = engine.importFile(testPath)

      await new Promise(resolve => setImmediate(resolve))
      
      const messageHandler = mockWorker.listeners('message')[0]
      const [{ requestId }] = findPostMessageCall(mockWorker, 'start-file')
      
      // Send command-complete (not command-ok)
      messageHandler({ type: 'command-complete', requestId })
      
      // Should resolve
      await expect(promise).resolves.toBeUndefined()
    })
  })

  describe('Comparison: startFile vs importFile', () => {
    it('startFile emits started-file, importFile does not', async () => {
      const startedFileEvents: string[] = []

      engine.on('started-file', (path: string) => {
        startedFileEvents.push(path)
      })

      // Test startFile
      const startFilePromise = engine.startFile('/test/stream.pcap')
      await new Promise(resolve => setImmediate(resolve))
      
      let messageHandler = mockWorker.listeners('message')[0]
      let postMessageCall = mockWorker.postMessage.mock.calls.find(
        (call: any[]) => call[0]?.type === 'start-file' && call[0]?.filePath === '/test/stream.pcap'
      )
      
      messageHandler({ type: 'command-ok', requestId: postMessageCall![0]!.requestId })
      await startFilePromise

      // Clear mock calls for next test
      mockWorker.postMessage.mockClear()

      // Test importFile
      const importFilePromise = engine.importFile('/test/import.pcap')
      await new Promise(resolve => setImmediate(resolve))
      
      postMessageCall = mockWorker.postMessage.mock.calls.find(
        (call: any[]) => call[0]?.type === 'start-file' && call[0]?.filePath === '/test/import.pcap'
      )
      
      messageHandler({ type: 'command-complete', requestId: postMessageCall![0]!.requestId })
      await importFilePromise

      // Wait to ensure no delayed emissions
      await new Promise(resolve => setTimeout(resolve, 50))

      // Verify only startFile emitted started-file
      expect(startedFileEvents).toEqual(['/test/stream.pcap'])
    })

    it('both send start-file command to worker, but resolve on different responses', async () => {
      // startFile
      const startFilePromise = engine.startFile('/test/a.pcap')
      await new Promise(resolve => setImmediate(resolve))
      
      let postMessageCall = mockWorker.postMessage.mock.calls.find(
        (call: any[]) => call[0]?.filePath === '/test/a.pcap'
      )
      expect(postMessageCall![0]!.type).toBe('start-file')
      
      const messageHandler = mockWorker.listeners('message')[0]
      messageHandler({ type: 'command-ok', requestId: postMessageCall![0]!.requestId })
      await startFilePromise

      mockWorker.postMessage.mockClear()

      // importFile
      const importFilePromise = engine.importFile('/test/b.pcap')
      await new Promise(resolve => setImmediate(resolve))
      
      postMessageCall = mockWorker.postMessage.mock.calls.find(
        (call: any[]) => call[0]?.filePath === '/test/b.pcap'
      )
      expect(postMessageCall![0]!.type).toBe('start-file')
      
      // importFile resolves on command-complete, not command-ok
      messageHandler({ type: 'command-complete', requestId: postMessageCall![0]!.requestId })
      await importFilePromise

      // Both sent the same command type, but resolved on different responses
      expect(true).toBe(true)
    })
  })

  describe('Integration with main/index.ts listener', () => {
    it('started-file event can be used to push capture:status to renderer', async () => {
      const rendererStatusUpdates: Array<{ state: string; path: string }> = []

      // Simulate main/index.ts listener
      engine.on('started-file', (filePath: string) => {
        rendererStatusUpdates.push({ state: 'file', path: filePath })
      })

      // Test streaming path
      const promise = engine.startFile('/test/stream.pcap')
      await new Promise(resolve => setImmediate(resolve))
      
      const messageHandler = mockWorker.listeners('message')[0]
      const postMessageCall = mockWorker.postMessage.mock.calls.find(
        (call: any[]) => call[0]?.filePath === '/test/stream.pcap'
      )
      
      messageHandler({ type: 'command-ok', requestId: postMessageCall![0]!.requestId })
      await promise

      // Verify renderer receives status update
      expect(rendererStatusUpdates).toHaveLength(1)
      expect(rendererStatusUpdates[0]).toEqual({
        state: 'file',
        path: '/test/stream.pcap'
      })
    })

    it('import path does NOT push misleading capture:status to renderer', async () => {
      const rendererStatusUpdates: Array<{ state: string; path?: string }> = []

      // Simulate main/index.ts listener
      engine.on('started-file', (filePath: string) => {
        rendererStatusUpdates.push({ state: 'file', path: filePath })
      })

      // Test import path
      const promise = engine.importFile('/test/import.pcap')
      await new Promise(resolve => setImmediate(resolve))
      
      const messageHandler = mockWorker.listeners('message')[0]
      const postMessageCall = mockWorker.postMessage.mock.calls.find(
        (call: any[]) => call[0]?.filePath === '/test/import.pcap'
      )
      
      messageHandler({ type: 'command-complete', requestId: postMessageCall![0]!.requestId })
      await promise

      // Wait to ensure no delayed emissions
      await new Promise(resolve => setTimeout(resolve, 50))

      // Verify NO renderer status update
      expect(rendererStatusUpdates).toHaveLength(0)
    })
  })

  describe('Semantic Correctness', () => {
    it('startFile is for streaming (resolves on startup, emits event)', async () => {
      const events: string[] = []

      engine.on('started-file', () => {
        events.push('started-file')
      })

      const promise = engine.startFile('/test/semantic-stream.pcap').then(() => {
        events.push('resolved')
      })

      await new Promise(resolve => setImmediate(resolve))
      
      const messageHandler = mockWorker.listeners('message')[0]
      const postMessageCall = mockWorker.postMessage.mock.calls.find(
        (call: any[]) => call[0]?.filePath === '/test/semantic-stream.pcap'
      )
      
      // Resolves on command-ok (startup confirmed)
      messageHandler({ type: 'command-ok', requestId: postMessageCall![0]!.requestId })
      await promise

      // Event emits synchronously after await, before .then() callback
      expect(events).toEqual(['started-file', 'resolved'])
    })

    it('importFile is for batch import (resolves on completion, no event)', async () => {
      const events: string[] = []

      engine.on('started-file', () => {
        events.push('started-file')
      })

      const promise = engine.importFile('/test/semantic-import.pcap').then(() => {
        events.push('resolved')
      })

      await new Promise(resolve => setImmediate(resolve))
      
      const messageHandler = mockWorker.listeners('message')[0]
      const postMessageCall = mockWorker.postMessage.mock.calls.find(
        (call: any[]) => call[0]?.filePath === '/test/semantic-import.pcap'
      )
      
      // Resolves on command-complete (entire file done)
      messageHandler({ type: 'command-complete', requestId: postMessageCall![0]!.requestId })
      await promise

      // Wait to ensure no delayed emissions
      await new Promise(resolve => setTimeout(resolve, 50))

      // No event emission
      expect(events).toEqual(['resolved'])
    })
  })
})
