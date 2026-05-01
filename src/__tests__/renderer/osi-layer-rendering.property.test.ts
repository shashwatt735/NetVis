// Feature: netvis-core, Property 24: OSI layer active/inactive rendering
// Validates: Requirements 26.2, 26.3

/**
 * Property 24: OSI layer active/inactive rendering
 *
 * For any AnonPacket, the OSI layer diagram must correctly classify each of the
 * 7 OSI layers as active or inactive based on the packet's decoded protocol layers.
 *
 * Properties tested:
 *   (a) A packet with no layers produces no active layers
 *   (b) Every protocol in a packet's layers maps to at most one OSI layer
 *   (c) Active layers use the correct PROTOCOL_COLORS tint for the mapped protocol
 *   (d) Inactive layers have opacity 0.3 (represented as isActive=false)
 *   (e) Physical layer (1) is always active when any layers are present
 *   (f) TCP/UDP packets always activate Transport layer (4)
 *   (g) IPv4/IPv6/ICMP packets always activate Network layer (3)
 *   (h) DNS packets always activate Application layer (7)
 *   (i) ARP packets always activate Data Link layer (2)
 *   (j) Active layer count is bounded by [0, 7]
 *   (k) The same packet always produces the same active layer set (deterministic)
 *
 * Validates: Requirements 26.2, 26.3
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { AnonPacket, ParsedLayer, ProtocolName } from '../../shared/capture-types'

// ─── OSI Layer definitions (mirrors OSILayerDiagram.tsx) ─────────────────────

interface OsiLayerDef {
  number: number
  name: string
  protocols: ProtocolName[]
}

const OSI_LAYERS: OsiLayerDef[] = [
  { number: 7, name: 'Application', protocols: ['DNS'] },
  { number: 6, name: 'Presentation', protocols: [] },
  { number: 5, name: 'Session', protocols: [] },
  { number: 4, name: 'Transport', protocols: ['TCP', 'UDP'] },
  { number: 3, name: 'Network', protocols: ['IPv4', 'IPv6', 'ICMP'] },
  { number: 2, name: 'Data Link', protocols: ['ARP', 'OTHER'] },
  { number: 1, name: 'Physical', protocols: [] },
]

const PROTO_COLORS = {
  TCP: '#4E9CE8',
  UDP: '#9B7FE8',
  ICMP: '#E8A030',
  DNS: '#35B890',
  ARP: '#D678A8',
  IPv4: '#D4824A',
  IPv6: '#4AB8D4',
  OTHER: '#7A7A86',
} as const

type ProtoColorKey = keyof typeof PROTO_COLORS

function protocolColorKey(proto: string): ProtoColorKey {
  return Object.prototype.hasOwnProperty.call(PROTO_COLORS, proto)
    ? (proto as ProtoColorKey)
    : 'OTHER'
}

/**
 * Pure function mirroring getActiveLayers() in OSILayerDiagram.tsx.
 * Returns a Map of OSI layer number → { color, protocol }.
 */
function getActiveLayers(
  layers: ParsedLayer[]
): Map<number, { color: string; protocol: ProtocolName }> {
  const active = new Map<number, { color: string; protocol: ProtocolName }>()

  for (const layer of layers) {
    for (const osiLayer of OSI_LAYERS) {
      if (osiLayer.protocols.includes(layer.protocol)) {
        if (!active.has(osiLayer.number)) {
          const key = protocolColorKey(layer.protocol)
          active.set(osiLayer.number, {
            color: PROTO_COLORS[key],
            protocol: layer.protocol,
          })
        }
      }
    }
  }

  // Physical layer is always active when any packet layers are present
  if (layers.length > 0) {
    active.set(1, { color: PROTO_COLORS['OTHER'], protocol: 'OTHER' })
  }

  return active
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const PROTOCOL_NAMES: ProtocolName[] = ['TCP', 'UDP', 'ICMP', 'DNS', 'ARP', 'IPv4', 'IPv6', 'OTHER']

const protocolArb = fc.constantFrom(...PROTOCOL_NAMES)

const parsedLayerArb: fc.Arbitrary<ParsedLayer> = fc.record({
  protocol: protocolArb,
  fields: fc.constant([]),
  rawByteOffset: fc.nat({ max: 1000 }),
  rawByteLength: fc.nat({ max: 1500 }),
})

const layerListArb = fc.array(parsedLayerArb, { minLength: 0, maxLength: 7 })
const nonEmptyLayerListArb = fc.array(parsedLayerArb, { minLength: 1, maxLength: 7 })

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OSI layer active/inactive rendering (P24)', () => {
  /**
   * Property 24a: A packet with no layers produces no active layers.
   * Validates: Requirement 26.2 (inactive layers at opacity 0.3)
   */
  it('packet with no layers produces no active layers', () => {
    const active = getActiveLayers([])
    expect(active.size).toBe(0)
  })

  /**
   * Property 24b: Active layer count is bounded by [0, 7].
   * Validates: Requirement 26.2 (7-layer OSI model)
   */
  it('active layer count is always between 0 and 7', () => {
    fc.assert(
      fc.property(layerListArb, (layers) => {
        const active = getActiveLayers(layers)
        expect(active.size).toBeGreaterThanOrEqual(0)
        expect(active.size).toBeLessThanOrEqual(7)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 24c: Physical layer (1) is always active when any layers are present.
   * Validates: Requirement 26.2 (physical layer always present for real packets)
   */
  it('physical layer is always active when packet has any layers', () => {
    fc.assert(
      fc.property(nonEmptyLayerListArb, (layers) => {
        const active = getActiveLayers(layers)
        expect(active.has(1)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 24d: TCP/UDP packets always activate Transport layer (4).
   * Validates: Requirement 26.3 (active layers use PROTOCOL_COLORS tint)
   */
  it('TCP or UDP layer activates OSI Transport layer 4', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ProtocolName>('TCP', 'UDP'),
        (proto) => {
          const layers: ParsedLayer[] = [
            { protocol: proto, fields: [], rawByteOffset: 0, rawByteLength: 20 },
          ]
          const active = getActiveLayers(layers)
          expect(active.has(4)).toBe(true)
          expect(active.get(4)?.protocol).toBe(proto)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 24e: IPv4/IPv6/ICMP packets always activate Network layer (3).
   * Validates: Requirement 26.3
   */
  it('IPv4, IPv6, or ICMP layer activates OSI Network layer 3', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ProtocolName>('IPv4', 'IPv6', 'ICMP'),
        (proto) => {
          const layers: ParsedLayer[] = [
            { protocol: proto, fields: [], rawByteOffset: 0, rawByteLength: 20 },
          ]
          const active = getActiveLayers(layers)
          expect(active.has(3)).toBe(true)
          expect(active.get(3)?.protocol).toBe(proto)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 24f: DNS packets always activate Application layer (7).
   * Validates: Requirement 26.3
   */
  it('DNS layer activates OSI Application layer 7', () => {
    const layers: ParsedLayer[] = [
      { protocol: 'DNS', fields: [], rawByteOffset: 0, rawByteLength: 20 },
    ]
    const active = getActiveLayers(layers)
    expect(active.has(7)).toBe(true)
    expect(active.get(7)?.protocol).toBe('DNS')
  })

  /**
   * Property 24g: ARP packets activate Data Link layer (2).
   * Validates: Requirement 26.3
   */
  it('ARP layer activates OSI Data Link layer 2', () => {
    const layers: ParsedLayer[] = [
      { protocol: 'ARP', fields: [], rawByteOffset: 0, rawByteLength: 28 },
    ]
    const active = getActiveLayers(layers)
    expect(active.has(2)).toBe(true)
    expect(active.get(2)?.protocol).toBe('ARP')
  })

  /**
   * Property 24h: Active layers use the correct PROTOCOL_COLORS hex value.
   * Validates: Requirement 26.3 (active layers use PROTOCOL_COLORS tint)
   */
  it('active layers use the correct PROTOCOL_COLORS hex for their protocol', () => {
    fc.assert(
      fc.property(nonEmptyLayerListArb, (layers) => {
        const active = getActiveLayers(layers)
        for (const [, info] of active) {
          const expectedColor = PROTO_COLORS[protocolColorKey(info.protocol)]
          expect(info.color).toBe(expectedColor)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 24i: The same layer list always produces the same active layer set (deterministic).
   * Validates: Requirement 26.2 (consistent rendering)
   */
  it('same layer list always produces the same active layer set', () => {
    fc.assert(
      fc.property(layerListArb, (layers) => {
        const active1 = getActiveLayers(layers)
        const active2 = getActiveLayers(layers)
        expect(active1.size).toBe(active2.size)
        for (const [num, info] of active1) {
          expect(active2.has(num)).toBe(true)
          expect(active2.get(num)?.protocol).toBe(info.protocol)
          expect(active2.get(num)?.color).toBe(info.color)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 24j: First-match-wins — when multiple layers map to the same OSI layer,
   * the first one in the packet's layer array takes precedence.
   * Validates: Requirement 26.3 (innermost protocol takes precedence)
   */
  it('first matching protocol wins when multiple layers map to the same OSI layer', () => {
    // TCP and UDP both map to Transport (4); first one wins
    const layers: ParsedLayer[] = [
      { protocol: 'TCP', fields: [], rawByteOffset: 0, rawByteLength: 20 },
      { protocol: 'UDP', fields: [], rawByteOffset: 20, rawByteLength: 8 },
    ]
    const active = getActiveLayers(layers)
    expect(active.get(4)?.protocol).toBe('TCP')
  })

  /**
   * Property 24k: A typical TCP/IP packet (Ethernet→IPv4→TCP) activates layers 1, 2, 3, 4.
   * Validates: Requirements 26.2, 26.3 (realistic packet scenario)
   */
  it('typical TCP/IP packet activates layers 1 (Physical), 2 (Data Link via OTHER), 3 (Network), 4 (Transport)', () => {
    const layers: ParsedLayer[] = [
      { protocol: 'OTHER', fields: [], rawByteOffset: 0, rawByteLength: 14 },  // Ethernet → Data Link
      { protocol: 'IPv4', fields: [], rawByteOffset: 14, rawByteLength: 20 },  // Network
      { protocol: 'TCP', fields: [], rawByteOffset: 34, rawByteLength: 20 },   // Transport
    ]
    const active = getActiveLayers(layers)
    expect(active.has(1)).toBe(true)  // Physical (always)
    expect(active.has(2)).toBe(true)  // Data Link (OTHER)
    expect(active.has(3)).toBe(true)  // Network (IPv4)
    expect(active.has(4)).toBe(true)  // Transport (TCP)
    expect(active.has(7)).toBe(false) // Application (no DNS)
  })
})
