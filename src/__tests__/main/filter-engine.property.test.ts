// Properties P7, P8, P9: Filter engine correctness
// Validates: Requirements 9.1, 9.3, 9.4, 9.5

/**
 * Property 7: Filter read-only invariant
 * Property 8: Parse-evaluate round trip
 * Property 9: Filter clear match-all
 *
 * Validates: Requirements 9.1, 9.3, 9.4, 9.5
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { parse, evaluate } from '../../main/filter-engine'
import type { AnonPacket } from '../../shared/capture-types'

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const protocolArb = fc.constantFrom('TCP', 'UDP', 'ICMP', 'DNS', 'ARP', 'OTHER')
const ipv4Arb = fc
  .tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  )
  .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`)
const lengthArb = fc.integer({ min: 20, max: 65535 })
const timestampArb = fc.integer({ min: 1_600_000_000_000, max: 1_800_000_000_000 })

const anonPacketArb: fc.Arbitrary<AnonPacket> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 64 }),
  timestamp: timestampArb,
  sourceId: fc.constant('test'),
  captureMode: fc.constantFrom('live' as const, 'file' as const),
  wireLength: lengthArb,
  length: lengthArb,
  protocol: protocolArb,
  srcAddress: ipv4Arb,
  dstAddress: ipv4Arb,
  layers: fc.array(
    fc.record({
      protocol: protocolArb,
      fields: fc.array(
        fc.record({
          name: fc.constantFrom('srcPort', 'dstPort', 'length', 'checksum', 'payload'),
          label: fc.constantFrom('Source Port', 'Destination Port', 'Length', 'Checksum', 'Payload'),
          value: fc.oneof(
            fc.integer({ min: 1, max: 65535 }),
            fc
              .array(fc.integer({ min: 0, max: 15 }), { minLength: 8, maxLength: 8 })
              .map((arr) => arr.map((n) => n.toString(16)).join(''))
          ),
          byteOffset: fc.integer({ min: 0, max: 100 }),
          byteLength: fc.integer({ min: 1, max: 20 })
        }),
        { minLength: 1, maxLength: 5 }
      ),
      rawByteOffset: fc.integer({ min: 0, max: 100 }),
      rawByteLength: fc.integer({ min: 1, max: 60 })
    }),
    { minLength: 1, maxLength: 4 }
  )
})

// Valid filter expression arbitraries
const fieldArb = fc.constantFrom('proto', 'src', 'dst', 'port', 'len', 'ts')
const comparatorArb = fc.constantFrom('==', '!=', '>', '<', '>=', '<=')
const valueArb = fc.oneof(
  fc.constantFrom('TCP', 'UDP', 'ICMP', 'DNS', 'ARP'),
  ipv4Arb,
  fc.integer({ min: 1, max: 65535 }).map(String),
  timestampArb.map(String)
)

const simplePredicateArb = fc
  .tuple(fieldArb, comparatorArb, valueArb)
  .map(([field, comp, value]) => `${field} ${comp} ${value}`)

const filterExpressionArb = fc.oneof(
  simplePredicateArb,
  fc.tuple(simplePredicateArb, simplePredicateArb).map(([p1, p2]) => `${p1} AND ${p2}`),
  fc.tuple(simplePredicateArb, simplePredicateArb).map(([p1, p2]) => `${p1} OR ${p2}`),
  simplePredicateArb.map((p) => `NOT ${p}`)
)

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Filter Engine — correctness properties (P7, P8, P9)', () => {
  /**
   * Property 7: Filter read-only invariant
   * For any packet and filter expression, evaluating the filter must not mutate the packet.
   * Validates: Requirement 9.5 (filters never mutate buffer)
   */
  it('P7: filters never modify packet objects (read-only invariant)', () => {
    fc.assert(
      fc.property(anonPacketArb, filterExpressionArb, (packet, expression) => {
        // Deep-clone packet before evaluation
        const packetBefore = JSON.stringify(packet)

        // Parse and evaluate filter
        const result = parse(expression)
        if (result.ok) {
          evaluate(result.ast, packet)
        }

        // Assert packet is unchanged
        const packetAfter = JSON.stringify(packet)
        expect(packetAfter).toBe(packetBefore)
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 8: Parse-evaluate round trip
   * For any valid filter expression, parsing it twice and evaluating both ASTs
   * against the same packet must produce identical results (parsing is deterministic).
   * Validates: Requirements 9.1, 9.4 (filter engine correctness)
   */
  it('P8: parsing is deterministic (parse-evaluate round trip)', () => {
    fc.assert(
      fc.property(anonPacketArb, filterExpressionArb, (packet, expression) => {
        // Parse expression twice
        const result1 = parse(expression)
        const result2 = parse(expression)

        // Both should succeed or both should fail
        expect(result1.ok).toBe(result2.ok)

        if (result1.ok && result2.ok) {
          // Evaluate both ASTs against same packet
          const match1 = evaluate(result1.ast, packet)
          const match2 = evaluate(result2.ast, packet)

          // Results must be identical
          expect(match1).toBe(match2)
        }
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 9: Filter clear match-all
   * For any packet, an empty filter expression must match (return true).
   * The empty expression is represented by a dedicated match-all AST node.
   * Validates: Requirement 9.3 (empty filter returns all packets)
   */
  it('P9: empty filter expression matches all packets', () => {
    fc.assert(
      fc.property(anonPacketArb, (packet) => {
        // Parse empty expression (returns dedicated match-all AST)
        const result = parse('')

        expect(result.ok).toBe(true)
        if (result.ok) {
          // Evaluate against packet
          const matches = evaluate(result.ast, packet)

          // Empty expression must match all packets
          expect(matches).toBe(true)
        }
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Additional test: Verify 'ts' field support
   * Ensures timeline filter integration works correctly.
   */
  it('ts field is recognized and evaluated correctly', () => {
    fc.assert(
      fc.property(anonPacketArb, timestampArb, (packet, threshold) => {
        // Parse ts field expression
        const expression = `ts >= ${threshold}`
        const result = parse(expression)

        expect(result.ok).toBe(true)
        if (result.ok) {
          const matches = evaluate(result.ast, packet)
          const expected = packet.timestamp >= threshold
          expect(matches).toBe(expected)
        }
      }),
      { numRuns: 25 }
    )
  })
})
