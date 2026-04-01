// Feature: netvis-core, Property 2: Ring-buffer capacity invariant
// Validates: Requirements 2.5, 12.1, 12.2

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { PacketBuffer } from '../../main/packet-buffer/index'
import type { AnonPacket } from '../../shared/capture-types'

function makePacket(id: string): AnonPacket {
  return {
    id,
    timestamp: Date.now(),
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

describe('PacketBuffer — ring-buffer capacity invariant (P2)', () => {
  // Property 2a: size never exceeds capacity (Req 12.1, 12.2)
  it('size never exceeds capacity regardless of how many packets are pushed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500 }), // capacity
        fc.integer({ min: 0, max: 1000 }), // packets to push
        (capacity, pushCount) => {
          const buf = new PacketBuffer(capacity)
          for (let i = 0; i < pushCount; i++) {
            buf.push(makePacket(`p${i}`))
          }
          expect(buf.size).toBeLessThanOrEqual(buf.capacity)
          expect(buf.size).toBe(Math.min(pushCount, capacity))
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 2b: overflow evicts oldest packet — ring semantics (Req 2.5, 12.2)
  it('when at capacity, pushing a new packet evicts the oldest one', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }), // capacity
        fc.integer({ min: 1, max: 100 }), // extra packets beyond capacity
        (capacity, extra) => {
          const buf = new PacketBuffer(capacity)
          // Fill to capacity
          for (let i = 0; i < capacity; i++) {
            buf.push(makePacket(`fill-${i}`))
          }
          // Push extra packets — each should evict the oldest
          for (let i = 0; i < extra; i++) {
            buf.push(makePacket(`extra-${i}`))
          }
          // Size must still equal capacity
          expect(buf.size).toBe(capacity)
          // The oldest surviving packet should be fill-(extra) or extra-0
          const all = buf.getAll()
          expect(all).toHaveLength(capacity)
          // The very first packet pushed (fill-0) must no longer be present
          if (extra > 0) {
            expect(all.find((p) => p.id === 'fill-0')).toBeUndefined()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 2c: overflow event fires when capacity is exceeded (Req 2.5)
  it('emits overflow event exactly once per packet dropped', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }), // capacity
        fc.integer({ min: 1, max: 50 }), // overflow count
        (capacity, overflowCount) => {
          const buf = new PacketBuffer(capacity)
          let overflowFired = 0
          buf.on('overflow', () => overflowFired++)

          // Fill to capacity — no overflow yet
          for (let i = 0; i < capacity; i++) buf.push(makePacket(`f${i}`))
          expect(overflowFired).toBe(0)

          // Push overflowCount more — each should trigger overflow
          for (let i = 0; i < overflowCount; i++) buf.push(makePacket(`o${i}`))
          expect(overflowFired).toBe(overflowCount)
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 2d: getAll returns packets in insertion order (oldest first)
  it('getAll returns packets in FIFO order', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 100 }),
        fc.integer({ min: 2, max: 200 }),
        (capacity, pushCount) => {
          const buf = new PacketBuffer(capacity)
          const ids: string[] = []
          for (let i = 0; i < pushCount; i++) {
            const id = `p${i}`
            ids.push(id)
            buf.push(makePacket(id))
          }
          const all = buf.getAll()
          // Should be the last `capacity` packets in order
          const expected = ids.slice(-capacity)
          expect(all.map((p) => p.id)).toEqual(expected)
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 2e: configurable capacity range 1–100,000 (Req 12.1)
  it('accepts any capacity in the valid range 1–100000', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100000 }), (capacity) => {
        const buf = new PacketBuffer(capacity)
        expect(buf.capacity).toBe(capacity)
        expect(buf.size).toBe(0)
      }),
      { numRuns: 100 }
    )
  })
})
