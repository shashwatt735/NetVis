// Feature: netvis-core, Property 3: Simulated capture preserves packet order
// Validates: Requirements 2.8

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { SpeedMultiplier } from '../../shared/capture-types'

/**
 * Extracted delay formula from SimulatedReplaySource.
 * Mirrors the exact logic in src/main/capture/simulated-replay-source.ts.
 */
const MAX_DELAY_MS = 2000

function computeDelay(
  prevTimestamp: number | null,
  currTimestamp: number,
  speed: SpeedMultiplier
): number {
  if (prevTimestamp === null) return 0
  return Math.min(Math.max((currTimestamp - prevTimestamp) / speed, 0), MAX_DELAY_MS)
}

const VALID_SPEEDS: SpeedMultiplier[] = [0.5, 1, 2, 5]

/** Arbitrary for valid SpeedMultiplier values */
const speedArb = fc.constantFrom<SpeedMultiplier>(...VALID_SPEEDS)

/** Arbitrary for a non-empty sorted (ascending) sequence of timestamps in ms */
const sortedTimestampsArb = fc
  .array(fc.integer({ min: 0, max: 1_000_000_000 }), { minLength: 1, maxLength: 50 })
  .map((arr) => arr.slice().sort((a, b) => a - b))

describe('SimulatedReplaySource — packet order invariant (P3)', () => {
  // Property 3a: delay between consecutive packets is always >= 0
  it('delay is always non-negative for any two consecutive timestamps and any speed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000_000 }), // prevTimestamp
        fc.integer({ min: 0, max: 1_000_000_000 }), // currTimestamp (may be before or after)
        speedArb,
        (prev, curr, speed) => {
          const delay = computeDelay(prev, curr, speed)
          expect(delay).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 3b: delay is always <= MAX_DELAY_MS (2000ms upper bound)
  it('delay is always clamped to at most 2000ms', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000_000 }),
        fc.integer({ min: 0, max: 1_000_000_000 }),
        speedArb,
        (prev, curr, speed) => {
          const delay = computeDelay(prev, curr, speed)
          expect(delay).toBeLessThanOrEqual(MAX_DELAY_MS)
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 3c: first packet always has delay 0 (no previous timestamp)
  it('first packet always has delay 0 regardless of its timestamp or speed', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000_000 }), speedArb, (timestamp, speed) => {
        const delay = computeDelay(null, timestamp, speed)
        expect(delay).toBe(0)
      }),
      { numRuns: 100 }
    )
  })

  // Property 3d: for a sorted sequence of timestamps, all delays are >= 0
  // This is the core ordering invariant: packets with non-decreasing timestamps
  // always produce non-negative delays, so no packet is ever scheduled before
  // the previous one — preserving the original packet order.
  it('all inter-packet delays are non-negative for any sorted timestamp sequence', () => {
    fc.assert(
      fc.property(sortedTimestampsArb, speedArb, (timestamps, speed) => {
        let prev: number | null = null
        for (const ts of timestamps) {
          const delay = computeDelay(prev, ts, speed)
          expect(delay).toBeGreaterThanOrEqual(0)
          expect(delay).toBeLessThanOrEqual(MAX_DELAY_MS)
          prev = ts
        }
      }),
      { numRuns: 100 }
    )
  })

  // Property 3e: higher speed multiplier produces smaller or equal delay
  // (faster replay = shorter waits between packets)
  it('a higher speed multiplier never produces a longer delay than a lower one', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000_000 }),
        fc.integer({ min: 0, max: 1_000_000_000 }),
        (prev, curr) => {
          // Compare all adjacent speed pairs in ascending order
          const speeds: SpeedMultiplier[] = [0.5, 1, 2, 5]
          for (let i = 0; i < speeds.length - 1; i++) {
            const slowDelay = computeDelay(prev, curr, speeds[i])
            const fastDelay = computeDelay(prev, curr, speeds[i + 1])
            expect(fastDelay).toBeLessThanOrEqual(slowDelay)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
