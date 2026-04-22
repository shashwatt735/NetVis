// Feature: netvis-core, Property 23: Bandwidth chart data correctness
// Validates: Requirements 28.1

/**
 * Property 23: Bandwidth chart data correctness
 *
 * For any collection of AnonPackets, the bandwidth buckets derived for
 * BandwidthChart must correctly accumulate bytes per protocol per second.
 *
 * Properties tested:
 *   (a) Empty packet list produces empty bucket list (no crash)
 *   (b) Non-empty packet list produces exactly 60 buckets
 *   (c) Consecutive buckets are exactly 1000ms apart
 *   (d) Buckets are ordered chronologically (earliest to latest)
 *   (e) All per-protocol byte values are non-negative
 *   (f) Bucket labels are formatted as HH:MM:SS
 *   (g) Sum of all bucket bytes equals total bytes of packets within the window
 *   (h) A single recent packet contributes its length to exactly one bucket
 *   (i) Packets outside the 60-second window contribute 0 bytes
 *   (j) Per-protocol bytes in each bucket match actual packet lengths for that slot
 *
 * Validates: Requirements 28.1
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { ProtocolName } from '../../shared/capture-types'

// ─── Constants ────────────────────────────────────────────────────────────────

const BUCKET_COUNT = 60
const BUCKET_WIDTH_MS = 1000
const PROTOCOLS: ProtocolName[] = ['TCP', 'UDP', 'ICMP', 'DNS', 'ARP', 'IPv4', 'IPv6', 'OTHER']

// ─── Types ────────────────────────────────────────────────────────────────────

interface BandwidthBucket {
  /** Unix timestamp of the bucket start (floored to second) */
  time: number
  /** HH:MM:SS label */
  label: string
  /** Bytes per protocol in this bucket */
  [proto: string]: number | string
}

interface MinimalPacket {
  timestamp: number
  protocol: ProtocolName
  length: number
}

// ─── Pure logic (mirrors buildBandwidthBuckets in BandwidthChart.tsx) ─────────

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toTimeString().slice(0, 8) // HH:MM:SS
}

/**
 * Build 60 one-second bandwidth buckets from the packet list.
 * Each bucket accumulates bytes per protocol.
 * Mirrors the logic in BandwidthChart.tsx — tested here without React dependencies.
 */
function buildBandwidthBuckets(packets: MinimalPacket[]): BandwidthBucket[] {
  if (packets.length === 0) return []

  const now = Math.floor(Date.now() / 1000) * 1000
  const windowStart = now - 59_000

  // Initialize 60 buckets
  const buckets: BandwidthBucket[] = Array.from({ length: 60 }, (_, i) => {
    const time = windowStart + i * 1000
    const bucket: BandwidthBucket = { time, label: formatTime(time) }
    for (const proto of PROTOCOLS) bucket[proto] = 0
    return bucket
  })

  for (const pkt of packets) {
    const bucketIndex = Math.floor((pkt.timestamp - windowStart) / 1000)
    if (bucketIndex < 0 || bucketIndex >= 60) continue
    const proto = pkt.protocol
    buckets[bucketIndex]![proto] = (buckets[bucketIndex]![proto] as number) + pkt.length
  }

  return buckets
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const protocolArb = fc.constantFrom(...PROTOCOLS)

const minimalPacketArb: fc.Arbitrary<MinimalPacket> = fc.record({
  timestamp: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
  protocol: protocolArb,
  length: fc.integer({ min: 20, max: 1500 }),
})

const packetListArb = fc.array(minimalPacketArb, { minLength: 0, maxLength: 300 })
const nonEmptyPacketListArb = fc.array(minimalPacketArb, { minLength: 1, maxLength: 300 })

/** Packets clustered within the current 60-second window */
const recentPacketListArb = fc.array(
  fc.record({
    timestamp: fc.integer({ min: Date.now() - 59_000, max: Date.now() }),
    protocol: protocolArb,
    length: fc.integer({ min: 20, max: 1500 }),
  }),
  { minLength: 1, maxLength: 300 }
)

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Bandwidth chart data correctness (P23)', () => {
  /**
   * Property 23a: Empty packet list produces empty bucket list.
   * Validates: Requirement 28.1 (handles empty state without crash)
   */
  it('empty packet list produces empty bucket list', () => {
    const buckets = buildBandwidthBuckets([])
    expect(buckets).toHaveLength(0)
  })

  /**
   * Property 23b: Non-empty packet list produces exactly 60 buckets.
   * Validates: Requirement 28.1 (60 one-second buckets)
   */
  it('non-empty packet list produces exactly 60 buckets', () => {
    fc.assert(
      fc.property(nonEmptyPacketListArb, (packets) => {
        const buckets = buildBandwidthBuckets(packets)
        expect(buckets).toHaveLength(BUCKET_COUNT)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 23c: Consecutive buckets are exactly 1000ms apart.
   * Validates: Requirement 28.1 (1-second buckets)
   */
  it('consecutive buckets are exactly 1000ms apart', () => {
    fc.assert(
      fc.property(nonEmptyPacketListArb, (packets) => {
        const buckets = buildBandwidthBuckets(packets)
        for (let i = 1; i < buckets.length; i++) {
          expect(buckets[i]!.time - buckets[i - 1]!.time).toBe(BUCKET_WIDTH_MS)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 23d: Buckets are ordered chronologically (earliest to latest).
   * Validates: Requirement 28.1 (time-ordered chart)
   */
  it('buckets are ordered chronologically', () => {
    fc.assert(
      fc.property(nonEmptyPacketListArb, (packets) => {
        const buckets = buildBandwidthBuckets(packets)
        for (let i = 1; i < buckets.length; i++) {
          expect(buckets[i]!.time).toBeGreaterThan(buckets[i - 1]!.time)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 23e: All per-protocol byte values in every bucket are non-negative.
   * Validates: Requirement 28.1 (bytes cannot be negative)
   */
  it('all per-protocol byte values are non-negative', () => {
    fc.assert(
      fc.property(nonEmptyPacketListArb, (packets) => {
        const buckets = buildBandwidthBuckets(packets)
        for (const bucket of buckets) {
          for (const proto of PROTOCOLS) {
            expect((bucket[proto] as number) ?? 0).toBeGreaterThanOrEqual(0)
          }
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 23f: Bucket labels are formatted as HH:MM:SS.
   * Validates: Requirement 28.1 (readable time labels)
   */
  it('bucket labels are formatted as HH:MM:SS', () => {
    fc.assert(
      fc.property(nonEmptyPacketListArb, (packets) => {
        const buckets = buildBandwidthBuckets(packets)
        const hhmmssPattern = /^\d{2}:\d{2}:\d{2}$/
        for (const bucket of buckets) {
          expect(bucket.label).toMatch(hhmmssPattern)
          expect(bucket.label).toBe(formatTime(bucket.time))
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 23g: Sum of all bucket bytes equals total bytes of packets within the window.
   * Validates: Requirement 28.1 (no bytes lost or duplicated)
   */
  it('sum of all bucket bytes equals total bytes of packets within the window', () => {
    fc.assert(
      fc.property(recentPacketListArb, (packets) => {
        const buckets = buildBandwidthBuckets(packets)

        const bucketTotal = buckets.reduce((sum, b) => {
          return sum + PROTOCOLS.reduce((s, p) => s + ((b[p] as number) ?? 0), 0)
        }, 0)

        const now = Math.floor(Date.now() / 1000) * 1000
        const windowStart = now - 59_000

        const expectedTotal = packets
          .filter((p) => {
            const idx = Math.floor((p.timestamp - windowStart) / BUCKET_WIDTH_MS)
            return idx >= 0 && idx < BUCKET_COUNT
          })
          .reduce((sum, p) => sum + p.length, 0)

        expect(bucketTotal).toBe(expectedTotal)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 23h: A single recent packet contributes its length to exactly one bucket.
   * Validates: Requirement 28.1 (each packet counted once)
   */
  it('a single recent packet contributes its length to exactly one bucket', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: Date.now() - 55_000, max: Date.now() }),
        protocolArb,
        fc.integer({ min: 20, max: 1500 }),
        (timestamp, protocol, length) => {
          const packet: MinimalPacket = { timestamp, protocol, length }
          const buckets = buildBandwidthBuckets([packet])

          const bucketsWithData = buckets.filter((b) => (b[protocol] as number) > 0)
          expect(bucketsWithData).toHaveLength(1)

          const totalBytes = buckets.reduce((sum, b) => sum + ((b[protocol] as number) ?? 0), 0)
          expect(totalBytes).toBe(length)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 23i: Packets outside the 60-second window contribute 0 bytes.
   * Validates: Requirement 28.1 (60-second window constraint)
   */
  it('packets outside the 60-second window contribute 0 bytes to any bucket', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 20, max: 1500 }),
        protocolArb,
        (length, protocol) => {
          // Packet from 2 minutes ago — well outside the window
          const oldPacket: MinimalPacket = {
            timestamp: Date.now() - 120_000,
            protocol,
            length,
          }

          const buckets = buildBandwidthBuckets([oldPacket])
          const totalBytes = buckets.reduce(
            (sum, b) => sum + PROTOCOLS.reduce((s, p) => s + ((b[p] as number) ?? 0), 0),
            0
          )
          expect(totalBytes).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 23j: Per-protocol bytes in each bucket match actual packet lengths
   * for that protocol and time slot.
   * Validates: Requirement 28.1 (correct per-protocol breakdown)
   */
  it('per-protocol bytes in each bucket match actual packet lengths for that protocol and slot', () => {
    fc.assert(
      fc.property(recentPacketListArb, (packets) => {
        const buckets = buildBandwidthBuckets(packets)

        const now = Math.floor(Date.now() / 1000) * 1000
        const windowStart = now - 59_000

        for (let i = 0; i < buckets.length; i++) {
          const bucket = buckets[i]!

          for (const proto of PROTOCOLS) {
            const expectedBytes = packets
              .filter((p) => {
                const idx = Math.floor((p.timestamp - windowStart) / BUCKET_WIDTH_MS)
                return idx === i && p.protocol === proto
              })
              .reduce((sum, p) => sum + p.length, 0)

            expect((bucket[proto] as number) ?? 0).toBe(expectedBytes)
          }
        }
      }),
      { numRuns: 50 }
    )
  })
})
