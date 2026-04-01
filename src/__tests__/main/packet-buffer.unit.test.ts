// Feature: netvis-core — PacketBuffer boundary condition unit tests
// Validates: Requirements 12.1, 12.2

import { describe, it, expect, vi } from 'vitest'
import { PacketBuffer } from '../../main/packet-buffer/index'
import type { AnonPacket } from '../../shared/capture-types'

function makePacket(id: string, timestamp = 0): AnonPacket {
  return {
    id,
    timestamp,
    sourceId: 'test',
    captureMode: 'live',
    wireLength: 64,
    layers: [],
    srcAddress: '0.0.0.0',
    dstAddress: '0.0.0.0',
    protocol: 'OTHER',
    length: 64
  }
}

// ─── Empty buffer ─────────────────────────────────────────────────────────────

describe('PacketBuffer — empty state', () => {
  it('size is 0 and capacity matches constructor arg', () => {
    const buf = new PacketBuffer(10)
    expect(buf.size).toBe(0)
    expect(buf.capacity).toBe(10)
  })

  it('getAll() returns empty array', () => {
    const buf = new PacketBuffer(5)
    expect(buf.getAll()).toEqual([])
  })

  it('getRange() returns empty array', () => {
    const buf = new PacketBuffer(5)
    expect(buf.getRange(0, 5)).toEqual([])
  })

  it('clear() on empty buffer does not throw and size stays 0', () => {
    const buf = new PacketBuffer(5)
    expect(() => buf.clear()).not.toThrow()
    expect(buf.size).toBe(0)
  })

  it('clear() on empty buffer still emits change event', () => {
    const buf = new PacketBuffer(5)
    const onChange = vi.fn()
    buf.on('change', onChange)
    buf.clear()
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

// ─── One-below-capacity ───────────────────────────────────────────────────────

describe('PacketBuffer — one-below-capacity state', () => {
  const CAPACITY = 5

  function fillToOneBelowCapacity(): PacketBuffer {
    const buf = new PacketBuffer(CAPACITY)
    for (let i = 0; i < CAPACITY - 1; i++) {
      buf.push(makePacket(`p${i}`, i))
    }
    return buf
  }

  it('size equals capacity - 1', () => {
    const buf = fillToOneBelowCapacity()
    expect(buf.size).toBe(CAPACITY - 1)
  })

  it('getAll() returns all packets in insertion order', () => {
    const buf = fillToOneBelowCapacity()
    const all = buf.getAll()
    expect(all).toHaveLength(CAPACITY - 1)
    expect(all.map((p) => p.id)).toEqual(['p0', 'p1', 'p2', 'p3'])
  })

  it('no overflow event has fired', () => {
    const buf = new PacketBuffer(CAPACITY)
    const onOverflow = vi.fn()
    buf.on('overflow', onOverflow)
    for (let i = 0; i < CAPACITY - 1; i++) buf.push(makePacket(`p${i}`))
    expect(onOverflow).not.toHaveBeenCalled()
  })

  it('pushing one more brings size to capacity without overflow', () => {
    const buf = fillToOneBelowCapacity()
    const onOverflow = vi.fn()
    buf.on('overflow', onOverflow)
    buf.push(makePacket('last'))
    expect(buf.size).toBe(CAPACITY)
    expect(onOverflow).not.toHaveBeenCalled()
  })
})

// ─── At-capacity ──────────────────────────────────────────────────────────────

describe('PacketBuffer — at-capacity state', () => {
  const CAPACITY = 4

  function fillToCapacity(): PacketBuffer {
    const buf = new PacketBuffer(CAPACITY)
    for (let i = 0; i < CAPACITY; i++) {
      buf.push(makePacket(`p${i}`, i))
    }
    return buf
  }

  it('size equals capacity', () => {
    const buf = fillToCapacity()
    expect(buf.size).toBe(CAPACITY)
  })

  it('getAll() returns all packets in insertion order', () => {
    const buf = fillToCapacity()
    expect(buf.getAll().map((p) => p.id)).toEqual(['p0', 'p1', 'p2', 'p3'])
  })

  it('no overflow event has fired yet', () => {
    const buf = new PacketBuffer(CAPACITY)
    const onOverflow = vi.fn()
    buf.on('overflow', onOverflow)
    for (let i = 0; i < CAPACITY; i++) buf.push(makePacket(`p${i}`))
    expect(onOverflow).not.toHaveBeenCalled()
  })

  it('pushing one more triggers overflow event', () => {
    const buf = fillToCapacity()
    const onOverflow = vi.fn()
    buf.on('overflow', onOverflow)
    buf.push(makePacket('extra'))
    expect(onOverflow).toHaveBeenCalledTimes(1)
  })
})

// ─── Overflow ─────────────────────────────────────────────────────────────────

describe('PacketBuffer — overflow state', () => {
  const CAPACITY = 3

  it('size stays at capacity after overflow', () => {
    const buf = new PacketBuffer(CAPACITY)
    for (let i = 0; i < CAPACITY + 5; i++) buf.push(makePacket(`p${i}`))
    expect(buf.size).toBe(CAPACITY)
  })

  it('overflow event fires once per dropped packet', () => {
    const buf = new PacketBuffer(CAPACITY)
    const onOverflow = vi.fn()
    buf.on('overflow', onOverflow)
    for (let i = 0; i < CAPACITY; i++) buf.push(makePacket(`fill${i}`))
    expect(onOverflow).not.toHaveBeenCalled()
    buf.push(makePacket('o0'))
    buf.push(makePacket('o1'))
    buf.push(makePacket('o2'))
    expect(onOverflow).toHaveBeenCalledTimes(3)
  })

  it('oldest packets are evicted (FIFO ring semantics)', () => {
    const buf = new PacketBuffer(CAPACITY)
    // Push capacity + 2 packets; first 2 should be evicted
    for (let i = 0; i < CAPACITY + 2; i++) buf.push(makePacket(`p${i}`))
    const ids = buf.getAll().map((p) => p.id)
    expect(ids).not.toContain('p0')
    expect(ids).not.toContain('p1')
  })

  it('getAll() returns the most recent capacity packets in order', () => {
    const buf = new PacketBuffer(CAPACITY)
    for (let i = 0; i < CAPACITY + 2; i++) buf.push(makePacket(`p${i}`))
    // pushed p0..p4, capacity=3 → should retain p2, p3, p4
    expect(buf.getAll().map((p) => p.id)).toEqual(['p2', 'p3', 'p4'])
  })

  it('change event fires on every push including overflow pushes', () => {
    const buf = new PacketBuffer(CAPACITY)
    const onChange = vi.fn()
    buf.on('change', onChange)
    const total = CAPACITY + 3
    for (let i = 0; i < total; i++) buf.push(makePacket(`p${i}`))
    expect(onChange).toHaveBeenCalledTimes(total)
  })
})

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('PacketBuffer — edge cases', () => {
  it('capacity of 1: push 1 packet reaches capacity without overflow', () => {
    const buf = new PacketBuffer(1)
    const onOverflow = vi.fn()
    buf.on('overflow', onOverflow)
    buf.push(makePacket('first'))
    expect(buf.size).toBe(1)
    expect(onOverflow).not.toHaveBeenCalled()
    expect(buf.getAll().map((p) => p.id)).toEqual(['first'])
  })

  it('capacity of 1: push second packet triggers overflow and only latest remains', () => {
    const buf = new PacketBuffer(1)
    const onOverflow = vi.fn()
    buf.on('overflow', onOverflow)
    buf.push(makePacket('first'))
    buf.push(makePacket('second'))
    expect(buf.size).toBe(1)
    expect(onOverflow).toHaveBeenCalledTimes(1)
    expect(buf.getAll().map((p) => p.id)).toEqual(['second'])
  })

  it('getRange(0, 2) on a buffer with 3 packets returns first 2', () => {
    const buf = new PacketBuffer(5)
    buf.push(makePacket('a'))
    buf.push(makePacket('b'))
    buf.push(makePacket('c'))
    expect(buf.getRange(0, 2).map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('throws RangeError for capacity 0', () => {
    expect(() => new PacketBuffer(0)).toThrow(RangeError)
  })

  it('throws RangeError for negative capacity', () => {
    expect(() => new PacketBuffer(-1)).toThrow(RangeError)
  })

  it('throws RangeError for non-integer capacity', () => {
    expect(() => new PacketBuffer(2.5)).toThrow(RangeError)
  })
})
