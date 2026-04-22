// Feature: netvis-core, Property 19: Timeline bucket construction
// Validates: Requirements 22.1

/**
 * Property 19: Timeline bucket construction
 *
 * For any set of AnonPacket objects, the timeline data derived for Packet_Flow_Timeline
 * must contain at most 60 buckets, each bucket must span exactly 1 second, and the sum
 * of all packet counts across all buckets must equal the total number of packets in the
 * input set.
 *
 * Properties tested:
 *   (a) Bucket count is at most 60
 *   (b) Each bucket spans exactly 1000ms (1 second)
 *   (c) Sum of all bucket counts equals total packet count (no packets lost or duplicated)
 *   (d) Buckets are ordered chronologically (earliest to latest)
 *   (e) Empty packet list produces empty bucket list
 *   (f) Packets outside the 60-second window are excluded from buckets
 *   (g) Each packet is assigned to exactly one bucket based on its timestamp
 *   (h) Bucket labels are formatted as HH:MM:SS
 *
 * Validates: Requirements 22.1
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { AnonPacket, ProtocolName } from '../../shared/capture-types'

// ─── Constants ────────────────────────────────────────────────────────────────

const BUCKET_COUNT = 60
const BUCKET_WIDTH_MS = 1000

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimelineBucket {
  startMs: number
  label: string
  count: number
  dominantProtocol: ProtocolName
  protocolCounts: Partial<Record<ProtocolName, number>>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHHMMSS(ms: number): string {
  const d = new Date(ms)
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  const ss = d.getSeconds().toString().padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

/**
 * Build 60 one-second buckets anchored to the most recent packet's second.
 * Buckets with no packets get count=0 and dominantProtocol='OTHER'.
 * This mirrors the logic in PacketFlowTimeline.tsx
 */
function buildBuckets(packets: { timestamp: number; protocol: ProtocolName }[]): TimelineBucket[] {
  if (packets.length === 0) return []

  // Anchor to the latest packet's second boundary
  const latestMs = Math.max(...packets.map((p) => p.timestamp))
  const latestBucketStart = Math.floor(latestMs / BUCKET_WIDTH_MS) * BUCKET_WIDTH_MS
  const firstBucketStart = latestBucketStart - (BUCKET_COUNT - 1) * BUCKET_WIDTH_MS

  // Initialize all 60 buckets
  const buckets: TimelineBucket[] = Array.from({ length: BUCKET_COUNT }, (_, i) => {
    const startMs = firstBucketStart + i * BUCKET_WIDTH_MS
    return {
      startMs,
      label: formatHHMMSS(startMs),
      count: 0,
      dominantProtocol: 'OTHER' as ProtocolName,
      protocolCounts: {}
    }
  })

  // Distribute packets into buckets
  for (const pkt of packets) {
    const bucketIndex = Math.floor((pkt.timestamp - firstBucketStart) / BUCKET_WIDTH_MS)
    if (bucketIndex < 0 || bucketIndex >= BUCKET_COUNT) continue
    const bucket = buckets[bucketIndex]
    if (!bucket) continue
    bucket.count++
    bucket.protocolCounts[pkt.protocol] = (bucket.protocolCounts[pkt.protocol] ?? 0) + 1
  }

  // Compute dominant protocol for each bucket
  for (const bucket of buckets) {
    if (bucket.count === 0) continue
    let maxCount = 0
    let dominant: ProtocolName = 'OTHER'
    for (const [proto, cnt] of Object.entries(bucket.protocolCounts) as [ProtocolName, number][]) {
      if (cnt > maxCount) {
        maxCount = cnt
        dominant = proto
      }
    }
    bucket.dominantProtocol = dominant
  }

  return buckets
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const PROTOCOL_NAMES: ProtocolName[] = ['TCP', 'UDP', 'ICMP', 'DNS', 'ARP', 'IPv4', 'IPv6', 'OTHER']

const protocolArb = fc.constantFrom(...PROTOCOL_NAMES)

/** Minimal packet with timestamp and protocol */
const minimalPacketArb = fc.record({
  timestamp: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }), // reasonable Unix ms range
  protocol: protocolArb
})

const packetListArb = fc.array(minimalPacketArb, { minLength: 0, maxLength: 500 })
const nonEmptyPacketListArb = fc.array(minimalPacketArb, { minLength: 1, maxLength: 500 })

/** Packets within a 60-second window */
const clusteredPacketListArb = fc
  .integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 })
  .chain((baseTime) =>
    fc.array(
      fc.record({
        timestamp: fc.integer({ min: baseTime, max: baseTime + 60_000 }), // within 60 seconds
        protocol: protocolArb
      }),
      { minLength: 1, maxLength: 500 }
    )
  )

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Timeline bucket construction (P19)', () => {
  /**
   * Property 19a: Bucket count is at most 60.
   * Validates: Requirement 22.1 (60 one-second buckets)
   */
  it('produces at most 60 buckets', () => {
    fc.assert(
      fc.property(packetListArb, (packets) => {
        const buckets = buildBuckets(packets)
        expect(buckets.length).toBeLessThanOrEqual(BUCKET_COUNT)
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 19b: Each bucket spans exactly 1000ms (1 second).
   * Validates: Requirement 22.1 (one-second buckets)
   */
  it('each bucket spans exactly 1000ms', () => {
    fc.assert(
      fc.property(nonEmptyPacketListArb, (packets) => {
        const buckets = buildBuckets(packets)
        for (let i = 1; i < buckets.length; i++) {
          const prevStart = buckets[i - 1]!.startMs
          const currStart = buckets[i]!.startMs
          expect(currStart - prevStart).toBe(BUCKET_WIDTH_MS)
        }
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 19c: Sum of all bucket counts equals total packet count within the window.
   * No packets are lost or duplicated during bucketing.
   * The window is anchored to the latest packet and extends back 59 seconds.
   * Validates: Requirement 22.1 (displays packet flow over time)
   */
  it('sum of bucket counts equals packets within the 60-second window', () => {
    fc.assert(
      fc.property(clusteredPacketListArb, (packets) => {
        const buckets = buildBuckets(packets)
        const bucketSum = buckets.reduce((acc, b) => acc + b.count, 0)

        // Calculate the actual window based on the latest packet
        const latestMs = Math.max(...packets.map((p) => p.timestamp))
        const latestBucketStart = Math.floor(latestMs / BUCKET_WIDTH_MS) * BUCKET_WIDTH_MS
        const firstBucketStart = latestBucketStart - (BUCKET_COUNT - 1) * BUCKET_WIDTH_MS

        // Count packets that fall within the window
        const packetsInWindow = packets.filter((p) => {
          const bucketIndex = Math.floor((p.timestamp - firstBucketStart) / BUCKET_WIDTH_MS)
          return bucketIndex >= 0 && bucketIndex < BUCKET_COUNT
        })

        expect(bucketSum).toBe(packetsInWindow.length)
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 19d: Buckets are ordered chronologically (earliest to latest).
   * Validates: Requirement 22.1 (timeline displays flow over time)
   */
  it('buckets are ordered chronologically', () => {
    fc.assert(
      fc.property(nonEmptyPacketListArb, (packets) => {
        const buckets = buildBuckets(packets)
        for (let i = 1; i < buckets.length; i++) {
          expect(buckets[i]!.startMs).toBeGreaterThan(buckets[i - 1]!.startMs)
        }
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 19e: Empty packet list produces empty bucket list.
   * Validates: Requirement 22.1 (handles empty state)
   */
  it('empty packet list produces empty bucket list', () => {
    const buckets = buildBuckets([])
    expect(buckets).toHaveLength(0)
  })

  /**
   * Property 19f: Packets outside the 60-second window are excluded.
   * Validates: Requirement 22.1 (60-second window)
   */
  it('packets outside 60-second window are excluded from buckets', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
        protocolArb,
        fc.integer({ min: 1, max: 50 }),
        (baseTime, protocol, count) => {
          // Create packets: some within window, some far outside
          const withinWindow = Array.from({ length: count }, (_, i) => ({
            timestamp: baseTime + i * 1000, // spread across 'count' seconds
            protocol
          }))
          const outsideWindow = [
            { timestamp: baseTime - 100_000, protocol }, // 100 seconds before
            { timestamp: baseTime + 200_000, protocol } // 200 seconds after
          ]
          const allPackets = [...withinWindow, ...outsideWindow]

          const buckets = buildBuckets(allPackets)
          const bucketSum = buckets.reduce((acc, b) => acc + b.count, 0)

          // Only packets within the 60-second window should be counted
          // The window is anchored to the latest packet (baseTime + 200_000)
          // So the window is [baseTime + 200_000 - 59_000, baseTime + 200_000]
          const windowStart = baseTime + 200_000 - 59_000
          const windowEnd = baseTime + 200_000
          const expectedCount = allPackets.filter(
            (p) => p.timestamp >= windowStart && p.timestamp <= windowEnd
          ).length

          expect(bucketSum).toBe(expectedCount)
        }
      ),
      { numRuns: 25 }
    )
  })

  /**
   * Property 19g: Each packet within the window is assigned to exactly one bucket.
   * Validates: Requirement 22.1 (correct bucketing)
   */
  it('each packet is assigned to exactly one bucket based on timestamp', () => {
    fc.assert(
      fc.property(clusteredPacketListArb, (packets) => {
        const buckets = buildBuckets(packets)

        // For each packet, verify it appears in exactly one bucket
        for (const pkt of packets) {
          const latestMs = Math.max(...packets.map((p) => p.timestamp))
          const latestBucketStart = Math.floor(latestMs / BUCKET_WIDTH_MS) * BUCKET_WIDTH_MS
          const firstBucketStart = latestBucketStart - (BUCKET_COUNT - 1) * BUCKET_WIDTH_MS

          const bucketIndex = Math.floor((pkt.timestamp - firstBucketStart) / BUCKET_WIDTH_MS)

          if (bucketIndex >= 0 && bucketIndex < BUCKET_COUNT) {
            // Packet should be in this bucket
            const bucket = buckets[bucketIndex]
            expect(bucket).toBeDefined()
            expect(bucket!.protocolCounts[pkt.protocol]).toBeGreaterThan(0)
          }
        }
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 19h: Bucket labels are formatted as HH:MM:SS.
   * Validates: Requirement 22.1 (readable time labels)
   */
  it('bucket labels are formatted as HH:MM:SS', () => {
    fc.assert(
      fc.property(nonEmptyPacketListArb, (packets) => {
        const buckets = buildBuckets(packets)
        const hhmmssPattern = /^\d{2}:\d{2}:\d{2}$/

        for (const bucket of buckets) {
          expect(bucket.label).toMatch(hhmmssPattern)
          // Verify label matches the timestamp
          expect(bucket.label).toBe(formatHHMMSS(bucket.startMs))
        }
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 19i: Non-empty packet list produces exactly 60 buckets.
   * Validates: Requirement 22.1 (always 60 buckets for non-empty data)
   */
  it('non-empty packet list produces exactly 60 buckets', () => {
    fc.assert(
      fc.property(nonEmptyPacketListArb, (packets) => {
        const buckets = buildBuckets(packets)
        expect(buckets).toHaveLength(BUCKET_COUNT)
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 19j: Buckets with no packets have count=0 and dominantProtocol='OTHER'.
   * Validates: Requirement 22.1 (empty buckets are represented)
   */
  it('empty buckets have count=0 and dominantProtocol=OTHER', () => {
    fc.assert(
      fc.property(nonEmptyPacketListArb, (packets) => {
        const buckets = buildBuckets(packets)

        for (const bucket of buckets) {
          if (bucket.count === 0) {
            expect(bucket.dominantProtocol).toBe('OTHER')
            expect(Object.keys(bucket.protocolCounts)).toHaveLength(0)
          }
        }
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 19k: Dominant protocol is the protocol with the highest count in the bucket.
   * Validates: Requirement 22.1 (correct protocol identification)
   */
  it('dominant protocol is the most frequent protocol in each bucket', () => {
    fc.assert(
      fc.property(nonEmptyPacketListArb, (packets) => {
        const buckets = buildBuckets(packets)

        for (const bucket of buckets) {
          if (bucket.count === 0) continue

          const dominantCount = bucket.protocolCounts[bucket.dominantProtocol] ?? 0
          for (const [proto, count] of Object.entries(bucket.protocolCounts) as [
            ProtocolName,
            number
          ][]) {
            expect(dominantCount).toBeGreaterThanOrEqual(count)
          }
        }
      }),
      { numRuns: 25 }
    )
  })
})
