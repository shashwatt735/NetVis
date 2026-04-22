// Feature: netvis-core, Property 25: Protocol animation step highlighting
// Validates: Requirements 29.3

/**
 * Property 25: Protocol animation step highlighting
 *
 * When a protocol animation step is active, the application must correctly
 * identify matching real packets from the Packet_Buffer to highlight in the
 * Packet_List.
 *
 * Properties tested:
 *   (a) findMatchingPacketId returns null when the packet list is empty
 *   (b) findMatchingPacketId returns null when no step matchPacket predicate is defined
 *   (c) findMatchingPacketId returns the id of the first matching packet
 *   (d) findMatchingPacketId returns null when no packet matches the predicate
 *   (e) Each animation definition has at least one step
 *   (f) Each step has a non-empty description (for aria-live announcement)
 *   (g) Each step has a non-empty label (for the packet envelope)
 *   (h) Each step direction is either 'ltr' or 'rtl'
 *   (i) Each step color is a valid hex color string
 *   (j) Step indices within an animation are unique and sequential starting from 0
 *   (k) All three required animations are present: tcp-handshake, dns-query, icmp-echo
 *   (l) findMatchingPacketId is deterministic — same inputs always produce same output
 *   (m) findMatchingPacketId returns the FIRST matching packet, not the last
 *
 * Validates: Requirements 29.3
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { AnonPacket, ParsedLayer, ProtocolName } from '../../shared/capture-types'
import {
  ANIMATIONS,
  findMatchingPacketId,
  type AnimationStep,
} from '../../renderer/src/components/ProtocolAnimations'

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const PROTOCOL_NAMES: ProtocolName[] = ['TCP', 'UDP', 'ICMP', 'DNS', 'ARP', 'IPv4', 'IPv6', 'OTHER']

const protocolArb = fc.constantFrom(...PROTOCOL_NAMES)

const parsedLayerArb: fc.Arbitrary<ParsedLayer> = fc.record({
  protocol: protocolArb,
  fields: fc.constant([]),
  rawByteOffset: fc.nat({ max: 1000 }),
  rawByteLength: fc.nat({ max: 1500 }),
})

const ipv4Arb = fc
  .tuple(
    fc.integer({ min: 1, max: 254 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 1, max: 254 })
  )
  .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`)

const minimalPacketArb: fc.Arbitrary<AnonPacket> = fc.record({
  id: fc.uuid(),
  timestamp: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
  protocol: protocolArb,
  length: fc.integer({ min: 20, max: 1500 }),
  srcAddress: ipv4Arb,
  dstAddress: ipv4Arb,
  sourceId: fc.constant('test'),
  captureMode: fc.constantFrom('live' as const, 'file' as const),
  wireLength: fc.integer({ min: 20, max: 1500 }),
  layers: fc.array(parsedLayerArb, { minLength: 0, maxLength: 4 }),
})

const packetListArb = fc.array(minimalPacketArb, { minLength: 0, maxLength: 100 })
const nonEmptyPacketListArb = fc.array(minimalPacketArb, { minLength: 1, maxLength: 100 })

// ─── Step without matchPacket ─────────────────────────────────────────────────

const stepWithoutMatchArb: fc.Arbitrary<AnimationStep> = fc.record({
  index: fc.nat({ max: 10 }),
  description: fc.string({ minLength: 1, maxLength: 100 }),
  direction: fc.constantFrom('ltr' as const, 'rtl' as const),
  label: fc.string({ minLength: 1, maxLength: 20 }),
  color: fc.constant('#3B82F6'),
  // matchPacket intentionally omitted
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Protocol animation step highlighting (P25)', () => {
  /**
   * Property 25a: findMatchingPacketId returns null for empty packet list.
   * Validates: Requirement 29.3 (graceful handling of empty buffer)
   */
  it('returns null when packet list is empty', () => {
    for (const anim of ANIMATIONS) {
      for (const step of anim.steps) {
        const result = findMatchingPacketId([], step)
        expect(result).toBeNull()
      }
    }
  })

  /**
   * Property 25b: findMatchingPacketId returns null when step has no matchPacket predicate.
   * Validates: Requirement 29.3 (steps without predicates do not highlight)
   */
  it('returns null when step has no matchPacket predicate', () => {
    fc.assert(
      fc.property(nonEmptyPacketListArb, stepWithoutMatchArb, (packets, step) => {
        const result = findMatchingPacketId(packets, step)
        expect(result).toBeNull()
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 25c: findMatchingPacketId returns null when no packet matches the predicate.
   * Validates: Requirement 29.3 (no false positives)
   */
  it('returns null when no packet matches the step predicate', () => {
    // Use a step with a predicate that never matches
    const neverMatchStep: AnimationStep = {
      index: 0,
      description: 'Test step',
      direction: 'ltr',
      label: 'TEST',
      color: '#000000',
      matchPacket: () => false,
    }

    fc.assert(
      fc.property(packetListArb, (packets) => {
        const result = findMatchingPacketId(packets, neverMatchStep)
        expect(result).toBeNull()
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 25d: findMatchingPacketId returns the id of the first matching packet.
   * Validates: Requirement 29.3 (highlights the first relevant packet)
   */
  it('returns the id of the first matching packet', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }),
        fc.integer({ min: 0, max: 9 }),
        (ids, matchIndex) => {
          const clampedIndex = Math.min(matchIndex, ids.length - 1)
          const matchId = ids[clampedIndex]!

          const packets: AnonPacket[] = ids.map((id, i) => ({
            id,
            timestamp: 1_000_000_000_000 + i,
            protocol: 'TCP' as ProtocolName,
            length: 100,
            srcAddress: '192.168.1.1',
            dstAddress: '192.168.1.2',
            sourceId: 'test',
            captureMode: 'live' as const,
            wireLength: 100,
            layers: [],
          }))

          // Step matches only the packet at clampedIndex
          const step: AnimationStep = {
            index: 0,
            description: 'Test',
            direction: 'ltr',
            label: 'TEST',
            color: '#3B82F6',
            matchPacket: (p) => p.id === matchId,
          }

          const result = findMatchingPacketId(packets, step)
          expect(result).toBe(matchId)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 25e: findMatchingPacketId returns the FIRST matching packet, not the last.
   * Validates: Requirement 29.3 (first-match semantics)
   */
  it('returns the first matching packet when multiple packets match', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 3, maxLength: 10 }),
        (ids) => {
          const packets: AnonPacket[] = ids.map((id, i) => ({
            id,
            timestamp: 1_000_000_000_000 + i,
            protocol: 'TCP' as ProtocolName,
            length: 100,
            srcAddress: '192.168.1.1',
            dstAddress: '192.168.1.2',
            sourceId: 'test',
            captureMode: 'live' as const,
            wireLength: 100,
            layers: [],
          }))

          // Step matches ALL packets
          const step: AnimationStep = {
            index: 0,
            description: 'Test',
            direction: 'ltr',
            label: 'TEST',
            color: '#3B82F6',
            matchPacket: () => true,
          }

          const result = findMatchingPacketId(packets, step)
          // Should return the first packet's id
          expect(result).toBe(ids[0])
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 25f: findMatchingPacketId is deterministic.
   * Validates: Requirement 29.3 (consistent highlighting)
   */
  it('findMatchingPacketId is deterministic — same inputs produce same output', () => {
    fc.assert(
      fc.property(packetListArb, (packets) => {
        for (const anim of ANIMATIONS) {
          for (const step of anim.steps) {
            const result1 = findMatchingPacketId(packets, step)
            const result2 = findMatchingPacketId(packets, step)
            expect(result1).toBe(result2)
          }
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 25g: All three required animations are present.
   * Validates: Requirement 29.1 (TCP handshake, DNS query/response, ICMP echo)
   */
  it('all three required animations are present: tcp-handshake, dns-query, icmp-echo', () => {
    const ids = ANIMATIONS.map((a) => a.id)
    expect(ids).toContain('tcp-handshake')
    expect(ids).toContain('dns-query')
    expect(ids).toContain('icmp-echo')
  })

  /**
   * Property 25h: Each animation has at least one step.
   * Validates: Requirement 29.2 (animations have content)
   */
  it('each animation has at least one step', () => {
    for (const anim of ANIMATIONS) {
      expect(anim.steps.length).toBeGreaterThanOrEqual(1)
    }
  })

  /**
   * Property 25i: Each step has a non-empty description for aria-live announcement.
   * Validates: Requirement 29.6 (each step announced via aria-live)
   */
  it('each step has a non-empty description for aria-live announcement', () => {
    for (const anim of ANIMATIONS) {
      for (const step of anim.steps) {
        expect(step.description.trim().length).toBeGreaterThan(0)
      }
    }
  })

  /**
   * Property 25j: Each step has a non-empty label for the packet envelope.
   * Validates: Requirement 29.2 (labeled packet envelopes)
   */
  it('each step has a non-empty label', () => {
    for (const anim of ANIMATIONS) {
      for (const step of anim.steps) {
        expect(step.label.trim().length).toBeGreaterThan(0)
      }
    }
  })

  /**
   * Property 25k: Each step direction is either 'ltr' or 'rtl'.
   * Validates: Requirement 29.2 (directional packet flow)
   */
  it("each step direction is 'ltr' or 'rtl'", () => {
    for (const anim of ANIMATIONS) {
      for (const step of anim.steps) {
        expect(['ltr', 'rtl']).toContain(step.direction)
      }
    }
  })

  /**
   * Property 25l: Each step color is a valid hex color string.
   * Validates: Requirement 29.2 (colored packet envelopes)
   */
  it('each step color is a valid hex color string', () => {
    const hexColorPattern = /^#[0-9A-Fa-f]{6}$/
    for (const anim of ANIMATIONS) {
      for (const step of anim.steps) {
        expect(step.color).toMatch(hexColorPattern)
      }
    }
  })

  /**
   * Property 25m: Step indices within each animation are unique and sequential from 0.
   * Validates: Requirement 29.4 (step-forward/step-back navigation)
   */
  it('step indices are unique and sequential starting from 0', () => {
    for (const anim of ANIMATIONS) {
      const indices = anim.steps.map((s) => s.index)
      // Unique
      expect(new Set(indices).size).toBe(indices.length)
      // Sequential from 0
      for (let i = 0; i < indices.length; i++) {
        expect(indices[i]).toBe(i)
      }
    }
  })

  /**
   * Property 25n: TCP handshake animation has exactly 3 steps (SYN, SYN-ACK, ACK).
   * Validates: Requirement 29.1 (TCP three-way handshake)
   */
  it('TCP handshake animation has exactly 3 steps', () => {
    const tcpAnim = ANIMATIONS.find((a) => a.id === 'tcp-handshake')
    expect(tcpAnim).toBeDefined()
    expect(tcpAnim!.steps).toHaveLength(3)
  })

  /**
   * Property 25o: DNS animation has exactly 2 steps (query, response).
   * Validates: Requirement 29.1 (DNS query/response)
   */
  it('DNS animation has exactly 2 steps', () => {
    const dnsAnim = ANIMATIONS.find((a) => a.id === 'dns-query')
    expect(dnsAnim).toBeDefined()
    expect(dnsAnim!.steps).toHaveLength(2)
  })

  /**
   * Property 25p: ICMP animation has exactly 2 steps (echo request, echo reply).
   * Validates: Requirement 29.1 (ICMP echo request/reply)
   */
  it('ICMP animation has exactly 2 steps', () => {
    const icmpAnim = ANIMATIONS.find((a) => a.id === 'icmp-echo')
    expect(icmpAnim).toBeDefined()
    expect(icmpAnim!.steps).toHaveLength(2)
  })
})
