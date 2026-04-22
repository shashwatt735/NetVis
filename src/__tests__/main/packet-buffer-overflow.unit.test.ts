/**
 * PacketBuffer overflow semantics — main-process unit tests.
 * Feature: netvis-core, Task 21.6.11
 *
 * Scope: PacketBuffer only. No renderer store, no IPC.
 *
 * Covers:
 *   - Overflow fires on push-past-capacity, not on reaching capacity
 *   - Overflow fires once per dropped packet
 *   - Overflow fires before change on the same push
 *   - setCapacity shrink does NOT fire overflow
 *   - IPC forwarding contract: buffer overflow event → mockSend payload shape
 *
 * Renderer-side overflow behavior (notifyBufferOverflow, UI notice) lives in:
 *   src/__tests__/renderer/store.unit.test.ts
 *   src/__tests__/renderer/status-bar-overflow-notice.test.ts
 */

import { describe, it, expect, vi } from 'vitest'
import { PacketBuffer } from '../../main/packet-buffer'
import type { ParsedPacket } from '../../shared/capture-types'

function makePacket(id: string): ParsedPacket {
  return {
    id,
    timestamp: Date.now(),
    sourceId: 'test',
    captureMode: 'live',
    wireLength: 64,
    layers: [],
    rawData: new Uint8Array([0x01])
  }
}

// ─── Overflow trigger semantics ───────────────────────────────────────────────

describe('PacketBuffer — overflow trigger semantics', () => {
  it('does NOT emit overflow when filling to exactly capacity', () => {
    const buf = new PacketBuffer(3)
    const onOverflow = vi.fn()
    buf.on('overflow', onOverflow)

    buf.push(makePacket('1'))
    buf.push(makePacket('2'))
    buf.push(makePacket('3'))

    expect(onOverflow).not.toHaveBeenCalled()
    expect(buf.size).toBe(3)
    expect(buf.capacity).toBe(3)
  })

  it('emits overflow on the first push past capacity', () => {
    const buf = new PacketBuffer(3)
    const onOverflow = vi.fn()
    buf.on('overflow', onOverflow)

    buf.push(makePacket('1'))
    buf.push(makePacket('2'))
    buf.push(makePacket('3'))
    buf.push(makePacket('4'))

    expect(onOverflow).toHaveBeenCalledTimes(1)
    expect(onOverflow).toHaveBeenCalledWith(1)
  })

  it('emits overflow once per push past capacity', () => {
    const buf = new PacketBuffer(3)
    const onOverflow = vi.fn()
    buf.on('overflow', onOverflow)

    for (let i = 1; i <= 3; i++) buf.push(makePacket(`fill${i}`))
    buf.push(makePacket('o1'))
    buf.push(makePacket('o2'))
    buf.push(makePacket('o3'))

    expect(onOverflow).toHaveBeenCalledTimes(3)
    expect(onOverflow).toHaveBeenNthCalledWith(1, 1)
    expect(onOverflow).toHaveBeenNthCalledWith(2, 1)
    expect(onOverflow).toHaveBeenNthCalledWith(3, 1)
  })
})

// ─── Event ordering ───────────────────────────────────────────────────────────

describe('PacketBuffer — overflow fires before change on the same push', () => {
  it('overflow event precedes change event', () => {
    const buf = new PacketBuffer(2)
    const events: string[] = []

    buf.on('overflow', () => events.push('overflow'))
    buf.on('change', () => events.push('change'))

    buf.push(makePacket('1'))
    buf.push(makePacket('2'))
    events.length = 0 // clear fill events

    buf.push(makePacket('3'))

    expect(events).toEqual(['overflow', 'change'])
  })
})

// ─── setCapacity does not trigger overflow ────────────────────────────────────

describe('PacketBuffer — setCapacity shrink does not emit overflow', () => {
  it('shrinking a full buffer keeps most recent packets without overflow event', () => {
    const buf = new PacketBuffer(5)
    const onOverflow = vi.fn()
    buf.on('overflow', onOverflow)

    for (let i = 1; i <= 5; i++) buf.push(makePacket(`p${i}`))

    buf.setCapacity(3)

    expect(onOverflow).not.toHaveBeenCalled()
    expect(buf.size).toBe(3)
    expect(buf.capacity).toBe(3)
  })

  it('after shrink, subsequent push-past-capacity still emits overflow', () => {
    const buf = new PacketBuffer(5)
    const onOverflow = vi.fn()
    buf.on('overflow', onOverflow)

    for (let i = 1; i <= 5; i++) buf.push(makePacket(`p${i}`))
    buf.setCapacity(3)
    expect(onOverflow).not.toHaveBeenCalled()

    buf.push(makePacket('extra'))
    expect(onOverflow).toHaveBeenCalledTimes(1)
  })
})

// ─── IPC forwarding contract ──────────────────────────────────────────────────
//
// Verifies the shape of the payload that main/index.ts sends to the renderer
// when it wires: buffer.on('overflow', dropped => send('buffer:overflow', { dropped }))
//
// This is a contract test for the IPC message shape, not a test of real Electron IPC.

describe('PacketBuffer — IPC forwarding contract', () => {
  it('overflow listener receives dropped count and forwards correct payload', () => {
    const buf = new PacketBuffer(2)
    const mockSend = vi.fn()

    buf.on('overflow', (dropped: number) => {
      mockSend('buffer:overflow', { dropped })
    })

    buf.push(makePacket('1'))
    buf.push(makePacket('2'))
    buf.push(makePacket('3'))

    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(mockSend).toHaveBeenCalledWith('buffer:overflow', { dropped: 1 })
  })

  it('each overflow push produces one IPC send with dropped=1', () => {
    const buf = new PacketBuffer(2)
    const mockSend = vi.fn()

    buf.on('overflow', (dropped: number) => {
      mockSend('buffer:overflow', { dropped })
    })

    buf.push(makePacket('1'))
    buf.push(makePacket('2'))
    buf.push(makePacket('3'))
    buf.push(makePacket('4'))
    buf.push(makePacket('5'))

    expect(mockSend).toHaveBeenCalledTimes(3)
    for (const call of mockSend.mock.calls) {
      expect(call[0]).toBe('buffer:overflow')
      expect(call[1]).toEqual({ dropped: 1 })
    }
  })
})
