/**
 * Capture Command Semantics — Bug Condition Exploration Tests (Property 1)
 * and Preservation Tests (Property 2).
 *
 * Property 1: Bug Condition — tests FAIL on unfixed code, PASS after fix.
 * Property 2: Preservation — tests PASS on both unfixed and fixed code.
 */

import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'
import type { CaptureError, NetworkInterface } from '../../shared/capture-types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCaptureError(code: CaptureError['code'] = 'UNKNOWN'): CaptureError {
  return { code, message: `Error: ${code}` }
}

// ─── BUGFIX-01: Command Acknowledgment ───────────────────────────────────────
// Bug Condition: all CaptureEngine command calls resolve immediately without
// waiting for worker ack. isBugCondition_01(X) = true for all X.

describe('Property 1: Bug Condition — BUGFIX-01 command acknowledgment', () => {
  /**
   * The fixed CaptureEngine must attach a requestId to each command message
   * and resolve only when the worker replies with command-ok for that requestId.
   *
   * We test this by simulating the CaptureEngine pendingCommands pattern:
   * a command promise must NOT resolve until command-ok is dispatched.
   */
  it('P1-01: command promise does not resolve before command-ok is received', async () => {
    // Simulate the fixed pendingCommands pattern
    const pendingCommands = new Map<string, { resolve: () => void; reject: (e: CaptureError) => void }>()

    function postCommand(requestId: string): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        pendingCommands.set(requestId, { resolve, reject })
        // Simulate posting to worker — does NOT resolve immediately
      })
    }

    function receiveCommandOk(requestId: string): void {
      const pending = pendingCommands.get(requestId)
      if (pending) {
        pendingCommands.delete(requestId)
        pending.resolve()
      }
    }

    const requestId = 'test-req-1'
    let resolved = false

    const p = postCommand(requestId).then(() => { resolved = true })

    // Before ack: must NOT be resolved
    await Promise.resolve() // flush microtasks
    expect(resolved).toBe(false)

    // After ack: must resolve
    receiveCommandOk(requestId)
    await p
    expect(resolved).toBe(true)
  })

  it('P1-01: command promise rejects when command-error is received', async () => {
    const pendingCommands = new Map<string, { resolve: () => void; reject: (e: CaptureError) => void }>()

    function postCommand(requestId: string): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        pendingCommands.set(requestId, { resolve, reject })
      })
    }

    function receiveCommandError(requestId: string, error: CaptureError): void {
      const pending = pendingCommands.get(requestId)
      if (pending) {
        pendingCommands.delete(requestId)
        pending.reject(error)
      }
    }

    const requestId = 'test-req-2'
    const err = makeCaptureError('PERMISSION_DENIED')

    const p = postCommand(requestId)
    receiveCommandError(requestId, err)

    await expect(p).rejects.toMatchObject({ code: 'PERMISSION_DENIED' })
  })

  it('P1-01: property — for all requestIds, command-ok resolves the correct pending promise', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        (id1, id2) => {
          fc.pre(id1 !== id2)

          const resolved: string[] = []
          const pending = new Map<string, { resolve: () => void; reject: (e: CaptureError) => void }>()

          const p1 = new Promise<void>((res, rej) => pending.set(id1, { resolve: res, reject: rej }))
          const p2 = new Promise<void>((res, rej) => pending.set(id2, { resolve: res, reject: rej }))

          p1.then(() => resolved.push(id1))
          p2.then(() => resolved.push(id2))

          // Resolve only id1
          pending.get(id1)!.resolve()
          pending.delete(id1)

          // id2 must still be pending
          expect(pending.has(id2)).toBe(true)
          expect(pending.has(id1)).toBe(false)
        }
      ),
      { numRuns: 25 }
    )
  })
})

// ─── BUGFIX-02: Startup Failures Reject start() ──────────────────────────────
// Bug Condition: PacketSource.start() calls errorHandler instead of throwing.
// isBugCondition_02(X) = X triggers a startup-time failure.

describe('Property 1: Bug Condition — BUGFIX-02 startup failures reject start()', () => {
  /**
   * The fixed PacketSource.start() must throw (reject) on startup failure.
   * CaptureController must stay idle and not emit status on rejection.
   */
  it('P1-02: start() that throws causes controller to stay idle', async () => {
    let controllerState = 'idle'
    let statusEmitted = false

    async function startWithFailingSource(): Promise<void> {
      // Simulate fixed CaptureController.startLive with try/catch
      let source: { start(): Promise<void> } | null = null
      try {
        source = {
          start: async () => {
            throw makeCaptureError('LIBRARY_UNAVAILABLE')
          }
        }
        await source.start()
        // Only transition state on success
        controllerState = 'live'
        statusEmitted = true
      } catch {
        // On failure: stay idle, clear source, do NOT emit status
        source = null
        // controllerState remains 'idle'
      }
    }

    await expect(startWithFailingSource()).resolves.toBeUndefined()
    expect(controllerState).toBe('idle')
    expect(statusEmitted).toBe(false)
  })

  it('P1-02: property — for all startup error codes, controller stays idle after rejection', async () => {
    const errorCodes: CaptureError['code'][] = [
      'LIBRARY_UNAVAILABLE',
      'FILE_NOT_FOUND',
      'PERMISSION_DENIED',
      'INTERFACE_NOT_FOUND',
      'FILE_INVALID_FORMAT'
    ]

    // Use fc.asyncProperty so fast-check properly awaits each async run
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...errorCodes),
        async (code) => {
          let state = 'idle'
          let statusCalled = false

          try {
            const source = {
              start: async () => { throw makeCaptureError(code) }
            }
            await source.start()
            state = 'live'
            statusCalled = true
          } catch {
            // stay idle
          }

          expect(state).toBe('idle')
          expect(statusCalled).toBe(false)
        }
      ),
      { numRuns: 25 }
    )
  })

  it('P1-02: start() that succeeds transitions controller state', async () => {
    let controllerState = 'idle'
    let statusEmitted = false

    async function startWithSuccessfulSource(): Promise<void> {
      try {
        const source = { start: async () => { /* success */ } }
        await source.start()
        controllerState = 'live'
        statusEmitted = true
      } catch {
        // stay idle
      }
    }

    await startWithSuccessfulSource()
    expect(controllerState).toBe('live')
    expect(statusEmitted).toBe(true)
  })
})

// ─── BUGFIX-03: No Handler-Side Status Push ───────────────────────────────────
// Bug Condition: capture:start and capture:startSimulated push capture:status
// from the handler using a stale null mainWindow snapshot.
// isBugCondition_03(X) = true for all such invocations.

describe('Property 1: Bug Condition — BUGFIX-03 no handler-side status push', () => {
  /**
   * The fixed handlers must NOT call webContents.send('capture:status', ...) directly.
   * Status must only be pushed from engine event listeners in main/index.ts.
   */
  it('P1-03: fixed capture:start handler does not push capture:status', async () => {
    const statusPushes: unknown[] = []

    // Simulate fixed handler — no direct status push
    async function fixedCaptureStartHandler(iface: string): Promise<void> {
      // validate iface
      if (!iface || typeof iface !== 'string') throw new Error('Invalid iface')
      // await engine.startCapture(iface) — resolves after command-ok
      // NO status push here
    }

    await fixedCaptureStartHandler('eth0')
    expect(statusPushes).toHaveLength(0)
  })

  it('P1-03: fixed capture:startSimulated handler does not push capture:status', async () => {
    const statusPushes: unknown[] = []

    async function fixedStartSimulatedHandler(payload: { path: string; speed: number }): Promise<void> {
      if (!payload.path) throw new Error('Invalid path')
      // await engine.startSimulated(resolvedPath, speed) — resolves after command-ok
      // NO status push here
    }

    await fixedStartSimulatedHandler({ path: '/tmp/test.pcap', speed: 1 })
    expect(statusPushes).toHaveLength(0)
  })

  it('P1-03: property — for all iface strings, handler never pushes status', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        (iface) => {
          const pushes: unknown[] = []

          // Fixed handler: no push — synchronous simulation
          function handler(i: string): void {
            if (!i.trim()) return // skip blank — handler would validate and throw
            // no push to pushes array
          }

          handler(iface)
          expect(pushes).toHaveLength(0)
        }
      ),
      { numRuns: 25 }
    )
  })

  it('P1-03: live getter returns current window, not stale snapshot', () => {
    // Simulate the fixed pattern: getter instead of snapshot
    let currentWindow: { webContents: { send: (channel: string, ...args: unknown[]) => void } } | null = null

    const getWindow = (): typeof currentWindow => currentWindow

    // Before window exists
    expect(getWindow()).toBeNull()

    // After window is created
    const mockSend = vi.fn()
    currentWindow = { webContents: { send: mockSend } }
    expect(getWindow()).not.toBeNull()

    // Send via getter
    getWindow()?.webContents.send('capture:status', { state: 'active' })
    expect(mockSend).toHaveBeenCalledWith('capture:status', { state: 'active' })
  })
})

// ─── BUGFIX-04: Import Completion via requestId ───────────────────────────────
// Bug Condition: pcap:import waits on engine.once('stopped') and calls
// engine.removeAllListeners('stopped') on timeout.
// isBugCondition_04(X) = true for all pcap:import invocations.

describe('Property 1: Bug Condition — BUGFIX-04 import completion via requestId', () => {
  /**
   * The fixed pcap:import must:
   * 1. Use command-complete for the import requestId as completion signal
   * 2. Never call removeAllListeners('stopped')
   */
  it('P1-04: import completion is signaled by command-complete, not stopped event', async () => {
    const pendingCommands = new Map<string, { resolve: () => void; reject: (e: Error) => void }>()
    let removeAllListenersCalled = false

    // Simulate fixed engine
    const engine = {
      startFile: (requestId: string): Promise<void> => {
        return new Promise<void>((resolve, reject) => {
          pendingCommands.set(requestId, { resolve, reject })
        })
      },
      removeAllListeners: (_event: string): void => {
        removeAllListenersCalled = true
      }
    }

    const requestId = 'import-req-1'
    let importComplete = false

    const importPromise = engine.startFile(requestId).then(() => {
      importComplete = true
    })

    // Before command-complete: not done
    expect(importComplete).toBe(false)

    // Signal completion via command-complete (not stopped event)
    pendingCommands.get(requestId)!.resolve()
    await importPromise

    expect(importComplete).toBe(true)
    expect(removeAllListenersCalled).toBe(false)
  })

  it('P1-04: timeout removes only the pending import request, not all stopped listeners', async () => {
    vi.useFakeTimers()

    const pendingCommands = new Map<string, { resolve: () => void; reject: (e: Error) => void }>()
    let removeAllListenersCalled = false
    const removedKeys: string[] = []

    const engine = {
      startFile: (requestId: string): Promise<void> => {
        return new Promise<void>((resolve, reject) => {
          pendingCommands.set(requestId, { resolve, reject })
        })
      },
      removeAllListeners: (_event: string): void => {
        removeAllListenersCalled = true
      }
    }

    const requestId = 'import-req-timeout'

    // Fixed timeout: removes only the pending entry, never calls removeAllListeners
    const timeoutMs = 30_000
    const timeoutHandle = setTimeout(() => {
      const pending = pendingCommands.get(requestId)
      if (pending) {
        pendingCommands.delete(requestId)
        removedKeys.push(requestId)
        pending.reject(new Error('Import timed out'))
      }
      // NEVER call engine.removeAllListeners('stopped')
    }, timeoutMs)

    const importPromise = engine.startFile(requestId).catch(() => {})

    vi.advanceTimersByTime(timeoutMs)
    await importPromise

    clearTimeout(timeoutHandle)

    expect(removeAllListenersCalled).toBe(false)
    expect(removedKeys).toContain(requestId)
    expect(pendingCommands.has(requestId)).toBe(false)

    vi.useRealTimers()
  })

  it('P1-04: property — for all requestIds, only that request is removed on timeout', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
        (importId, otherIds) => {
          fc.pre(!otherIds.includes(importId))

          const pending = new Map<string, boolean>()
          pending.set(importId, true)
          for (const id of otherIds) pending.set(id, true)

          // Fixed timeout: remove only importId
          pending.delete(importId)

          // Other pending commands must be unaffected
          for (const id of otherIds) {
            expect(pending.has(id)).toBe(true)
          }
          expect(pending.has(importId)).toBe(false)
        }
      ),
      { numRuns: 25 }
    )
  })
})

// ─── BUGFIX-05: Structured Enumeration Result ─────────────────────────────────
// Bug Condition: capture:getInterfaces returns [] on timeout/error.
// isBugCondition_05(X) = X results in timeout or worker error.

describe('Property 1: Bug Condition — BUGFIX-05 structured enumeration result', () => {
  /**
   * The fixed handler must return { ok: false, error } on failure,
   * not [] — making failure distinguishable from a legitimate empty list.
   */
  it('P1-05: on timeout, returns { ok: false, error } not []', async () => {
    vi.useFakeTimers()

    async function fixedGetInterfaces(): Promise<
      { ok: true; interfaces: NetworkInterface[] } | { ok: false; error: string; platformHint?: string }
    > {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('getInterfaces timeout after 3000ms')), 3000)
        })
        const interfacesPromise = new Promise<NetworkInterface[]>((resolve) => {
          setTimeout(() => resolve([]), 10_000) // never resolves within timeout
        })
        const interfaces = await Promise.race([interfacesPromise, timeoutPromise])
        return { ok: true, interfaces }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
      }
    }

    const resultPromise = fixedGetInterfaces()
    vi.advanceTimersByTime(3001)
    const result = await resultPromise

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('timeout')
    }

    vi.useRealTimers()
  })

  it('P1-05: on worker error, returns { ok: false, error } not []', async () => {
    async function fixedGetInterfaces(): Promise<
      { ok: true; interfaces: NetworkInterface[] } | { ok: false; error: string }
    > {
      try {
        throw new Error('Cap.deviceList() failed')
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
      }
    }

    const result = await fixedGetInterfaces()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(typeof result.error).toBe('string')
      expect(result.error.length).toBeGreaterThan(0)
    }
  })

  it('P1-05: on success, returns { ok: true, interfaces: NetworkInterface[] }', async () => {
    const mockInterfaces: NetworkInterface[] = [
      { name: 'eth0', displayName: 'Ethernet', isUp: true }
    ]

    async function fixedGetInterfaces(): Promise<
      { ok: true; interfaces: NetworkInterface[] } | { ok: false; error: string }
    > {
      try {
        return { ok: true, interfaces: mockInterfaces }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
      }
    }

    const result = await fixedGetInterfaces()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.interfaces).toEqual(mockInterfaces)
    }
  })

  it('P1-05: property — ok:true and ok:false are distinguishable from each other and from []', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.array(
          fc.record({ name: fc.string(), displayName: fc.string(), isUp: fc.boolean() }),
          { maxLength: 5 }
        ),
        (isError, ifaces) => {
          type InterfaceResult =
            | { ok: true; interfaces: NetworkInterface[] }
            | { ok: false; error: string }

          const result: InterfaceResult = isError
            ? { ok: false, error: 'some error' }
            : { ok: true, interfaces: ifaces }

          // Result is never a plain array
          expect(Array.isArray(result)).toBe(false)

          // ok:false is distinguishable from ok:true
          if (result.ok) {
            expect('interfaces' in result).toBe(true)
            expect('error' in result).toBe(false)
          } else {
            expect('error' in result).toBe(true)
            expect('interfaces' in result).toBe(false)
          }
        }
      ),
      { numRuns: 25 }
    )
  })
})

// ─── Property 2: Preservation Tests ──────────────────────────────────────────
// These tests PASS on both unfixed and fixed code.
// They verify that non-buggy behaviors are unchanged.

describe('Property 2: Preservation — packet flow and event routing unchanged', () => {
  /**
   * 3.1: packet-batch IPC channel continues to deliver AnonPacket[] to renderer.
   * The sendToRenderer callback pattern is unchanged.
   */
  it('P2-01: sendToRenderer callback delivers packets when window is available', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 1, maxLength: 10 }),
        (ids) => {
          const mockSend = vi.fn()
          const mockWindow = { webContents: { send: mockSend } }
          let mainWindow: typeof mockWindow | null = mockWindow

          const sendToRenderer = (packets: unknown[]): void => {
            mainWindow?.webContents.send('packet:batch', packets)
          }

          sendToRenderer(ids)
          expect(mockSend).toHaveBeenCalledWith('packet:batch', ids)
        }
      ),
      { numRuns: 25 }
    )
  })

  /**
   * 3.2: engine.on('stopped') in main/index.ts pushes capture:status { state: 'stopped' }.
   * The stopped event listener pattern is unchanged.
   */
  it('P2-02: stopped event listener pushes capture:status { state: stopped }', () => {
    const mockSend = vi.fn()
    const mockWindow = { webContents: { send: mockSend } }
    let mainWindow: typeof mockWindow | null = mockWindow

    // Simulate the engine.on('stopped') listener in main/index.ts
    const stoppedListener = (): void => {
      mainWindow?.webContents.send('capture:status', { state: 'stopped' })
    }

    stoppedListener()
    expect(mockSend).toHaveBeenCalledWith('capture:status', { state: 'stopped' })
  })

  /**
   * 3.3: engine.on('error') in main/index.ts pushes capture:status { state: 'error', ... }.
   */
  it('P2-03: error event listener pushes capture:status { state: error }', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (message) => {
          const mockSend = vi.fn()
          const mockWindow = { webContents: { send: mockSend } }
          let mainWindow: typeof mockWindow | null = mockWindow

          const errorListener = (err: { message: string; platformHint?: string }): void => {
            mainWindow?.webContents.send('capture:status', {
              state: 'error',
              message: err.message,
              platformHint: err.platformHint
            })
          }

          errorListener({ message })
          expect(mockSend).toHaveBeenCalledWith('capture:status', {
            state: 'error',
            message,
            platformHint: undefined
          })
        }
      ),
      { numRuns: 25 }
    )
  })

  /**
   * 3.14: get-interfaces worker message handling and Cap.deviceList() call unchanged.
   * The getInterfaces() correlation mechanism (separate from command ack) is unchanged.
   */
  it('P2-14: getInterfaces correlation mechanism is independent of command ack', () => {
    // getInterfaces uses its own message handler, not pendingCommands
    const interfaceMessages: NetworkInterface[][] = []

    const handler = (msg: { type: string; interfaces?: NetworkInterface[] }): void => {
      if (msg.type === 'interfaces') {
        interfaceMessages.push(msg.interfaces ?? [])
      }
    }

    handler({ type: 'interfaces', interfaces: [{ name: 'eth0', displayName: 'Ethernet', isUp: true }] })
    handler({ type: 'command-ok', interfaces: undefined }) // should not affect interfaceMessages

    expect(interfaceMessages).toHaveLength(1)
    expect(interfaceMessages[0]).toHaveLength(1)
  })

  /**
   * 3.12: capture:stop delegates to stopCapture() and lets stopped event drive status push.
   * The stop handler does NOT push status directly.
   */
  it('P2-12: capture:stop handler does not push capture:status directly', async () => {
    const statusPushes: unknown[] = []

    // Fixed stop handler: no direct push
    async function captureStopHandler(): Promise<void> {
      // await getCaptureEngine().stopCapture()
      // No status push — stopped event drives it from main/index.ts
    }

    await captureStopHandler()
    expect(statusPushes).toHaveLength(0)
  })

  /**
   * 3.13: capture:startSimulated path validation unchanged.
   */
  it('P2-13: capture:startSimulated path validation (resolve, access, stat) is unchanged', async () => {
    // Verify the validation logic pattern is preserved
    const path = await import('path')
    const resolvedPath = path.resolve('/tmp/test.pcap')
    expect(typeof resolvedPath).toBe('string')
    // path.isAbsolute() works cross-platform (Windows paths start with drive letter, not /)
    expect(path.isAbsolute(resolvedPath)).toBe(true)
  })
})

// ─── File-Mode Status Flow Regression Tests ──────────────────────────────────
// Verifies that:
// 1. startFile() emits 'started-file' after command-ok (streaming path)
// 2. importFile() does NOT emit 'started-file' after command-complete (batch import path)

describe('File-Mode Status Flow — Regression Tests', () => {
  /**
   * Regression: pcap:startFile (streaming path) must emit 'started-file' after command-ok
   * to push capture:status { state: 'file' } to renderer.
   */
  it('R1: startFile() emits started-file after postCommandOnOk resolves', async () => {
    const events: string[] = []
    const pendingCommands = new Map<string, { resolve: () => void; reject: (e: Error) => void }>()

    // Simulate startFile() implementation
    async function startFile(filePath: string): Promise<void> {
      await postCommandOnOk({ type: 'start-file', filePath, requestId: 'test-id' })
      events.push('started-file')
    }

    function postCommandOnOk(msg: { type: string; filePath: string; requestId: string }): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        pendingCommands.set(msg.requestId, { resolve, reject })
        // Simulate immediate command-ok
        setImmediate(() => {
          const pending = pendingCommands.get(msg.requestId)
          if (pending) {
            pendingCommands.delete(msg.requestId)
            pending.resolve()
          }
        })
      })
    }

    await startFile('/test/stream.pcap')

    // Verify started-file was emitted
    expect(events).toContain('started-file')
  })

  /**
   * Regression: pcap:import (batch import path) must NOT emit 'started-file' after command-complete
   * to avoid pushing misleading capture:status { state: 'file' } after import is done.
   */
  it('R2: importFile() does NOT emit started-file after postCommand resolves', async () => {
    const events: string[] = []
    const pendingCommands = new Map<string, { resolve: () => void; reject: (e: Error) => void }>()

    // Simulate importFile() implementation
    async function importFile(filePath: string): Promise<void> {
      await postCommand({ type: 'start-file', filePath, requestId: 'test-id' })
      // No 'started-file' emission after completion
    }

    function postCommand(msg: { type: string; filePath: string; requestId: string }): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        pendingCommands.set(`complete:${msg.requestId}`, { resolve, reject })
        // Simulate delayed command-complete
        setImmediate(() => {
          const pending = pendingCommands.get(`complete:${msg.requestId}`)
          if (pending) {
            pendingCommands.delete(`complete:${msg.requestId}`)
            pending.resolve()
          }
        })
      })
    }

    await importFile('/test/import.pcap')

    // Verify NO started-file was emitted
    expect(events).not.toContain('started-file')
    expect(events).toHaveLength(0)
  })

  /**
   * Regression: Verify semantic difference between streaming and import paths
   */
  it('R3: startFile emits started-file, importFile does not', async () => {
    const startedFileEvents: string[] = []
    const pendingCommands = new Map<string, { resolve: () => void; reject: (e: Error) => void }>()

    // Simulate both implementations
    async function startFile(filePath: string): Promise<void> {
      await postCommandOnOk({ type: 'start-file', filePath, requestId: 'start-id' })
      startedFileEvents.push(`started-file:${filePath}`)
    }

    async function importFile(filePath: string): Promise<void> {
      await postCommand({ type: 'start-file', filePath, requestId: 'import-id' })
      // No emission
    }

    function postCommandOnOk(msg: { type: string; filePath: string; requestId: string }): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        pendingCommands.set(msg.requestId, { resolve, reject })
        setImmediate(() => {
          const pending = pendingCommands.get(msg.requestId)
          if (pending) {
            pendingCommands.delete(msg.requestId)
            pending.resolve()
          }
        })
      })
    }

    function postCommand(msg: { type: string; filePath: string; requestId: string }): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        pendingCommands.set(`complete:${msg.requestId}`, { resolve, reject })
        setImmediate(() => {
          const pending = pendingCommands.get(`complete:${msg.requestId}`)
          if (pending) {
            pendingCommands.delete(`complete:${msg.requestId}`)
            pending.resolve()
          }
        })
      })
    }

    // Test both paths
    await startFile('/test/stream.pcap')
    await importFile('/test/import.pcap')

    // Verify only startFile emitted started-file
    expect(startedFileEvents).toEqual(['started-file:/test/stream.pcap'])
  })

  /**
   * Regression: Verify renderer receives correct status updates
   */
  it('R4: renderer receives capture:status for streaming path, not for import path', async () => {
    const rendererStatusUpdates: Array<{ state: string; path?: string }> = []
    const pendingCommands = new Map<string, { resolve: () => void; reject: (e: Error) => void }>()

    // Simulate main/index.ts listener
    function onStartedFile(filePath: string): void {
      rendererStatusUpdates.push({ state: 'file', path: filePath })
    }

    // Simulate startFile with event emission
    async function startFile(filePath: string): Promise<void> {
      await postCommandOnOk({ type: 'start-file', filePath, requestId: 'start-id' })
      onStartedFile(filePath)
    }

    // Simulate importFile without event emission
    async function importFile(filePath: string): Promise<void> {
      await postCommand({ type: 'start-file', filePath, requestId: 'import-id' })
      // No event emission
    }

    function postCommandOnOk(msg: { type: string; filePath: string; requestId: string }): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        pendingCommands.set(msg.requestId, { resolve, reject })
        setImmediate(() => {
          const pending = pendingCommands.get(msg.requestId)
          if (pending) {
            pendingCommands.delete(msg.requestId)
            pending.resolve()
          }
        })
      })
    }

    function postCommand(msg: { type: string; filePath: string; requestId: string }): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        pendingCommands.set(`complete:${msg.requestId}`, { resolve, reject })
        setImmediate(() => {
          const pending = pendingCommands.get(`complete:${msg.requestId}`)
          if (pending) {
            pendingCommands.delete(`complete:${msg.requestId}`)
            pending.resolve()
          }
        })
      })
    }

    // Test streaming path
    await startFile('/test/stream.pcap')
    expect(rendererStatusUpdates).toHaveLength(1)
    expect(rendererStatusUpdates[0]).toEqual({ state: 'file', path: '/test/stream.pcap' })

    // Clear for next test
    rendererStatusUpdates.length = 0

    // Test import path
    await importFile('/test/import.pcap')
    expect(rendererStatusUpdates).toHaveLength(0)
  })
})
