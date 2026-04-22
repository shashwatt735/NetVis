// Feature: netvis-core, Property 10: Protocol distribution correctness
// Validates: Requirements 6.1, 6.3

/**
 * Property 10: Protocol distribution correctness
 *
 * For any collection of AnonPackets:
 *   (a) The protocol count map contains exactly one entry per distinct protocol
 *       present in the packet list — no phantom entries, no missing entries
 *   (b) The sum of all protocol counts equals the total packet count
 *   (c) Each entry's percentage is Math.round((count / total) * 100) — no rounding
 *       drift, no negative values, no values exceeding 100
 *   (d) Entries are sorted descending by count (most frequent protocol first)
 *   (e) An empty packet list produces an empty distribution (no division-by-zero crash)
 *   (f) A single-protocol list produces one entry with percentage = 100
 *   (g) Adding packets of a new protocol increases the entry count by exactly 1
 *       and does not change the counts of existing protocols
 *
 * Validates: Requirements 6.1, 6.3
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { AnonPacket, ProtocolName } from '../../shared/capture-types'

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const PROTOCOL_NAMES: ProtocolName[] = ['TCP', 'UDP', 'ICMP', 'DNS', 'ARP', 'IPv4', 'IPv6', 'OTHER']

const protocolArb = fc.constantFrom(...PROTOCOL_NAMES)

/** Minimal AnonPacket — only the fields the distribution logic reads. */
const minimalPacketArb: fc.Arbitrary<Pick<AnonPacket, 'id' | 'protocol'>> = fc.record({
  id: fc.uuid(),
  protocol: protocolArb
})

const packetListArb = fc.array(minimalPacketArb, { minLength: 0, maxLength: 500 })
const nonEmptyPacketListArb = fc.array(minimalPacketArb, { minLength: 1, maxLength: 500 })

// ─── Distribution logic (mirrors ProtocolChart.buildEntries) ─────────────────

interface DistributionEntry {
  protocol: ProtocolName
  count: number
  percentage: number
}

/**
 * Pure function that mirrors the distribution logic in ProtocolChart.
 * Extracted here so properties can be tested without a React environment.
 */
function buildDistribution(
  packets: ReadonlyArray<Pick<AnonPacket, 'protocol'>>
): DistributionEntry[] {
  const counts = new Map<ProtocolName, number>()
  for (const pkt of packets) {
    counts.set(pkt.protocol, (counts.get(pkt.protocol) ?? 0) + 1)
  }
  const total = packets.length
  return Array.from(counts.entries())
    .map(([protocol, count]) => ({
      protocol,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Protocol distribution correctness (P10)', () => {
  /**
   * Property 10a: Entry count equals the number of distinct protocols in the list.
   * No phantom entries for protocols with zero packets; no missing entries.
   * Validates: Requirement 6.1
   */
  it('entry count equals number of distinct protocols in packet list', () => {
    fc.assert(
      fc.property(packetListArb, (packets) => {
        const distinctProtocols = new Set(packets.map((p) => p.protocol))
        const entries = buildDistribution(packets)
        expect(entries).toHaveLength(distinctProtocols.size)
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 10b: Sum of all entry counts equals total packet count.
   * Validates: Requirement 6.1 (reflects all packets in buffer)
   */
  it('sum of all entry counts equals total packet count', () => {
    fc.assert(
      fc.property(nonEmptyPacketListArb, (packets) => {
        const entries = buildDistribution(packets)
        const countSum = entries.reduce((acc, e) => acc + e.count, 0)
        expect(countSum).toBe(packets.length)
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 10c: Each entry's count matches the actual frequency of that protocol.
   * Validates: Requirement 6.3 (labeled segment with packet count)
   */
  it('each entry count matches actual protocol frequency', () => {
    fc.assert(
      fc.property(nonEmptyPacketListArb, (packets) => {
        const entries = buildDistribution(packets)
        for (const entry of entries) {
          const actualCount = packets.filter((p) => p.protocol === entry.protocol).length
          expect(entry.count).toBe(actualCount)
        }
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 10d: Each percentage is Math.round((count / total) * 100).
   * No negative values, no values exceeding 100.
   * Validates: Requirement 6.3 (percentage of total packets)
   */
  it('each percentage equals Math.round(count / total * 100) and is in [0, 100]', () => {
    fc.assert(
      fc.property(nonEmptyPacketListArb, (packets) => {
        const entries = buildDistribution(packets)
        const total = packets.length
        for (const entry of entries) {
          const expected = Math.round((entry.count / total) * 100)
          expect(entry.percentage).toBe(expected)
          expect(entry.percentage).toBeGreaterThanOrEqual(0)
          expect(entry.percentage).toBeLessThanOrEqual(100)
        }
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 10e: Entries are sorted descending by count (most frequent first).
   * Validates: Requirement 6.3 (consistent ordering for chart rendering)
   */
  it('entries are sorted descending by count', () => {
    fc.assert(
      fc.property(nonEmptyPacketListArb, (packets) => {
        const entries = buildDistribution(packets)
        for (let i = 1; i < entries.length; i++) {
          expect(entries[i]!.count).toBeLessThanOrEqual(entries[i - 1]!.count)
        }
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 10f: Empty packet list produces an empty distribution.
   * No division-by-zero crash; no phantom entries.
   * Validates: Requirement 6.1
   */
  it('empty packet list produces empty distribution without error', () => {
    const entries = buildDistribution([])
    expect(entries).toHaveLength(0)
  })

  /**
   * Property 10g: A list containing only one protocol produces exactly one entry
   * with percentage = 100 (or Math.round(n/n * 100) = 100).
   * Validates: Requirement 6.3
   */
  it('single-protocol list produces one entry with percentage 100', () => {
    fc.assert(
      fc.property(protocolArb, fc.integer({ min: 1, max: 200 }), (protocol, count) => {
        const packets = Array.from({ length: count }, (_, i) => ({
          id: `pkt-${i}`,
          protocol
        }))
        const entries = buildDistribution(packets)
        expect(entries).toHaveLength(1)
        expect(entries[0]!.protocol).toBe(protocol)
        expect(entries[0]!.count).toBe(count)
        expect(entries[0]!.percentage).toBe(100)
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 10h: Adding packets of a new protocol increases entry count by 1
   * and does not change the counts of existing protocols.
   * Validates: Requirement 6.1 (chart reflects current buffer state)
   */
  it('adding a new protocol increases entry count by 1 without changing existing counts', () => {
    fc.assert(
      fc.property(
        // Base list with at most 5 distinct protocols so we can always find a new one
        fc.array(
          fc.record({
            id: fc.uuid(),
            protocol: fc.constantFrom<ProtocolName>('TCP', 'UDP', 'ICMP', 'DNS', 'ARP')
          }),
          { minLength: 1, maxLength: 100 }
        ),
        fc.integer({ min: 1, max: 50 }),
        (basePackets, newCount) => {
          const baseEntries = buildDistribution(basePackets)
          const baseCountMap = new Map(baseEntries.map((e) => [e.protocol, e.count]))

          // Add packets of a protocol guaranteed not in the base list
          const newProtocol: ProtocolName = 'OTHER'
          const newPackets = Array.from({ length: newCount }, (_, i) => ({
            id: `new-${i}`,
            protocol: newProtocol
          }))
          const combined = [...basePackets, ...newPackets]
          const combinedEntries = buildDistribution(combined)

          // Entry count increases by exactly 1
          expect(combinedEntries).toHaveLength(baseEntries.length + 1)

          // Existing protocol counts are unchanged
          for (const [proto, originalCount] of baseCountMap) {
            const updated = combinedEntries.find((e) => e.protocol === proto)
            expect(updated, `Protocol ${proto} should still be present`).toBeDefined()
            expect(updated!.count).toBe(originalCount)
          }

          // New protocol entry has the correct count
          const newEntry = combinedEntries.find((e) => e.protocol === newProtocol)
          expect(newEntry).toBeDefined()
          expect(newEntry!.count).toBe(newCount)
        }
      ),
      { numRuns: 25 }
    )
  })

  /**
   * Property 10i: Every entry protocol name is a member of the known ProtocolName union.
   * Validates: Requirement 6.3 (labeled segments use canonical protocol names)
   */
  it('every entry protocol is a valid ProtocolName', () => {
    fc.assert(
      fc.property(nonEmptyPacketListArb, (packets) => {
        const entries = buildDistribution(packets)
        for (const entry of entries) {
          expect(PROTOCOL_NAMES).toContain(entry.protocol)
        }
      }),
      { numRuns: 25 }
    )
  })
})
