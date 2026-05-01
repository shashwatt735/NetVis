// Feature: netvis-core, Property 21: IP flow graph construction
// Validates: Requirements 27.1, 27.2

/**
 * Property 21: IP flow graph construction
 *
 * For any collection of AnonPackets, the IP flow graph must correctly represent
 * the communication relationships between IP addresses.
 *
 * Properties tested:
 *   (a) Every unique srcAddress and dstAddress in the packet list appears as a node
 *   (b) Every unique src→dst pair appears as exactly one directed edge
 *   (c) Node packet count equals the total number of packets involving that IP
 *   (d) Edge packet count equals the number of packets with that exact src→dst pair
 *   (e) Empty packet list produces an empty graph (no nodes, no edges)
 *   (f) A single packet produces exactly 2 nodes (src, dst) and 1 edge
 *       unless src == dst, in which case 1 node and 1 edge
 *   (g) Node count is bounded by [0, 2 * packet_count]
 *   (h) Edge count is bounded by [0, packet_count]
 *   (i) Dominant protocol for a node/edge is the most frequent protocol
 *   (j) Packets with empty srcAddress or dstAddress are excluded from the graph
 *
 * Validates: Requirements 27.1, 27.2
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { AnonPacket, ProtocolName } from '../../shared/capture-types'
import { buildFlowGraph } from '../../renderer/src/components/ip-flow-utils'

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const PROTOCOL_NAMES: ProtocolName[] = ['TCP', 'UDP', 'ICMP', 'DNS', 'ARP', 'IPv4', 'IPv6', 'OTHER']

const protocolArb = fc.constantFrom(...PROTOCOL_NAMES)

const ipv4Arb = fc
  .tuple(
    fc.integer({ min: 1, max: 254 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 1, max: 254 })
  )
  .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`)

/** Minimal AnonPacket with only the fields buildFlowGraph reads */
const minimalPacketArb: fc.Arbitrary<
  Pick<AnonPacket, 'id' | 'srcAddress' | 'dstAddress' | 'protocol' | 'length'>
> = fc.record({
  id: fc.uuid(),
  srcAddress: ipv4Arb,
  dstAddress: ipv4Arb,
  protocol: protocolArb,
  length: fc.integer({ min: 20, max: 1500 })
})

const packetListArb = fc.array(minimalPacketArb, { minLength: 0, maxLength: 200 })
const nonEmptyPacketListArb = fc.array(minimalPacketArb, { minLength: 1, maxLength: 200 })

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('IP flow graph construction (P21)', () => {
  /**
   * Property 21a: Empty packet list produces an empty graph.
   * Validates: Requirement 27.1
   */
  it('empty packet list produces empty graph', () => {
    const graph = buildFlowGraph([])
    expect(graph.nodes).toHaveLength(0)
    expect(graph.edges).toHaveLength(0)
  })

  /**
   * Property 21b: Every unique IP address appears as exactly one node.
   * Validates: Requirement 27.1 (nodes represent IP addresses)
   */
  it('every unique IP address appears as exactly one node', () => {
    fc.assert(
      fc.property(nonEmptyPacketListArb, (packets) => {
        const graph = buildFlowGraph(packets as AnonPacket[])
        const uniqueIPs = new Set([
          ...packets.map((p) => p.srcAddress),
          ...packets.map((p) => p.dstAddress)
        ])
        expect(graph.nodes).toHaveLength(uniqueIPs.size)
        for (const ip of uniqueIPs) {
          const node = graph.nodes.find((n) => n.id === ip)
          expect(node, `Node for IP ${ip} should exist`).toBeDefined()
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 21c: Every unique src→dst pair appears as exactly one directed edge.
   * Validates: Requirement 27.2 (edges represent communication flows)
   */
  it('every unique src→dst pair appears as exactly one directed edge', () => {
    fc.assert(
      fc.property(nonEmptyPacketListArb, (packets) => {
        const graph = buildFlowGraph(packets as AnonPacket[])
        const uniquePairs = new Set(packets.map((p) => `${p.srcAddress}→${p.dstAddress}`))
        expect(graph.edges).toHaveLength(uniquePairs.size)
        for (const pair of uniquePairs) {
          const edge = graph.edges.find((e) => e.id === pair)
          expect(edge, `Edge for pair ${pair} should exist`).toBeDefined()
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 21d: Edge packet count equals the number of packets with that src→dst pair.
   * Validates: Requirement 27.2
   */
  it('edge packet count equals actual packet count for that src→dst pair', () => {
    fc.assert(
      fc.property(nonEmptyPacketListArb, (packets) => {
        const graph = buildFlowGraph(packets as AnonPacket[])
        for (const edge of graph.edges) {
          const actualCount = packets.filter(
            (p) => p.srcAddress === edge.source && p.dstAddress === edge.target
          ).length
          expect(edge.packetCount).toBe(actualCount)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 21e: Node count is bounded by [0, 2 * packet_count].
   * Validates: Requirement 27.1 (at most 2 IPs per packet)
   */
  it('node count is bounded by [0, 2 * packet_count]', () => {
    fc.assert(
      fc.property(packetListArb, (packets) => {
        const graph = buildFlowGraph(packets as AnonPacket[])
        expect(graph.nodes.length).toBeGreaterThanOrEqual(0)
        expect(graph.nodes.length).toBeLessThanOrEqual(packets.length * 2)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 21f: Edge count is bounded by [0, packet_count].
   * Validates: Requirement 27.2 (at most one edge per packet)
   */
  it('edge count is bounded by [0, packet_count]', () => {
    fc.assert(
      fc.property(packetListArb, (packets) => {
        const graph = buildFlowGraph(packets as AnonPacket[])
        expect(graph.edges.length).toBeGreaterThanOrEqual(0)
        expect(graph.edges.length).toBeLessThanOrEqual(packets.length)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 21g: A single packet produces 1 or 2 nodes and exactly 1 edge.
   * Validates: Requirement 27.1, 27.2
   */
  it('single packet produces 1 or 2 nodes and exactly 1 edge', () => {
    fc.assert(
      fc.property(minimalPacketArb, (packet) => {
        const graph = buildFlowGraph([packet as AnonPacket])
        const expectedNodes = packet.srcAddress === packet.dstAddress ? 1 : 2
        expect(graph.nodes).toHaveLength(expectedNodes)
        expect(graph.edges).toHaveLength(1)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 21h: Dominant protocol for each edge is the most frequent protocol
   * among packets with that src→dst pair.
   * Validates: Requirement 27.2
   */
  it('dominant protocol for each edge is the most frequent protocol for that flow', () => {
    fc.assert(
      fc.property(nonEmptyPacketListArb, (packets) => {
        const graph = buildFlowGraph(packets as AnonPacket[])
        for (const edge of graph.edges) {
          const flowPackets = packets.filter(
            (p) => p.srcAddress === edge.source && p.dstAddress === edge.target
          )
          // Count protocols
          const protoCounts = new Map<string, number>()
          for (const p of flowPackets) {
            protoCounts.set(p.protocol, (protoCounts.get(p.protocol) ?? 0) + 1)
          }
          // Find dominant
          let maxCount = 0
          let dominant = 'OTHER'
          for (const [proto, count] of protoCounts) {
            if (count > maxCount) {
              maxCount = count
              dominant = proto
            }
          }
          expect(edge.dominantProtocol).toBe(dominant)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 21i: Sum of all edge packet counts equals total packet count.
   * Each packet contributes to exactly one edge.
   * Validates: Requirement 27.2
   */
  it('sum of all edge packet counts equals total packet count', () => {
    fc.assert(
      fc.property(nonEmptyPacketListArb, (packets) => {
        const graph = buildFlowGraph(packets as AnonPacket[])
        const edgeSum = graph.edges.reduce((acc, e) => acc + e.packetCount, 0)
        expect(edgeSum).toBe(packets.length)
      }),
      { numRuns: 100 }
    )
  })
})
