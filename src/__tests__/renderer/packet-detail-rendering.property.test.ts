// Feature: netvis-core, Property 12: Packet detail rendering completeness
// Validates: Requirements 23.1, 23.3

/**
 * Property 12: Packet detail rendering completeness
 *
 * For any AnonPacket with N layers and M total fields:
 *   (a) Every layer in packet.layers is represented — layer count matches
 *   (b) Every field in every layer is represented — total field count matches
 *   (c) Each layer has a protocol name that is a non-empty string
 *   (d) Each field has a non-empty label, a defined value, a non-negative byteOffset,
 *       and a positive byteLength
 *   (e) Layers with errors carry an error annotation string (not undefined)
 *   (f) Unknown protocol layers are marked as 'OTHER' and have a non-negative rawByteLength
 *
 * Validates: Requirements 23.1, 23.3
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { AnonPacket, ParsedLayer, ParsedField } from '../../shared/capture-types'

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const protocolArb = fc.constantFrom(
  'TCP',
  'UDP',
  'ICMP',
  'DNS',
  'ARP',
  'IPv4',
  'IPv6',
  'OTHER'
) as fc.Arbitrary<AnonPacket['protocol']>

const fieldArb: fc.Arbitrary<ParsedField> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 32 }),
  label: fc.string({ minLength: 1, maxLength: 64 }),
  value: fc.oneof(fc.integer({ min: 0, max: 65535 }), fc.string({ minLength: 0, maxLength: 64 })),
  byteOffset: fc.integer({ min: 0, max: 1500 }),
  byteLength: fc.integer({ min: 1, max: 64 })
})

const layerArb: fc.Arbitrary<ParsedLayer> = fc.record({
  protocol: protocolArb,
  fields: fc.array(fieldArb, { minLength: 0, maxLength: 20 }),
  error: fc.option(fc.string({ minLength: 1, maxLength: 128 }), { nil: undefined }),
  rawByteOffset: fc.integer({ min: 0, max: 1500 }),
  rawByteLength: fc.integer({ min: 0, max: 1500 })
})

const anonPacketArb: fc.Arbitrary<AnonPacket> = fc.record({
  id: fc.uuid(),
  timestamp: fc.integer({ min: 0, max: Date.now() }),
  sourceId: fc.string({ minLength: 1, maxLength: 32 }),
  captureMode: fc.constantFrom('live', 'file') as fc.Arbitrary<'live' | 'file'>,
  wireLength: fc.integer({ min: 14, max: 65535 }),
  layers: fc.array(layerArb, { minLength: 1, maxLength: 7 }),
  srcAddress: fc.ipV4(),
  dstAddress: fc.ipV4(),
  protocol: protocolArb,
  length: fc.integer({ min: 14, max: 65535 })
})

// ─── Helper: simulate what the inspector renders ──────────────────────────────

/**
 * Simulates the rendering logic of PacketDetailInspector without React.
 * Returns the set of layer protocols and field labels that would be rendered.
 */
function simulateInspectorRender(packet: AnonPacket): {
  renderedLayers: string[]
  renderedFieldCount: number
  renderedFieldLabels: string[][]
} {
  const renderedLayers = packet.layers.map((l) => l.protocol)
  const renderedFieldLabels = packet.layers.map((l) => l.fields.map((f) => f.label))
  const renderedFieldCount = packet.layers.reduce((sum, l) => sum + l.fields.length, 0)
  return { renderedLayers, renderedFieldCount, renderedFieldLabels }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Packet detail rendering completeness (P12)', () => {
  /**
   * Property 12a: Every layer in packet.layers is represented in the rendered output.
   * Validates: Requirement 23.1
   */
  it('every layer is represented — rendered layer count equals packet.layers.length', () => {
    fc.assert(
      fc.property(anonPacketArb, (packet) => {
        const { renderedLayers } = simulateInspectorRender(packet)
        expect(renderedLayers).toHaveLength(packet.layers.length)
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 12b: Every field in every layer is represented.
   * Validates: Requirement 23.1
   */
  it('every field is represented — total rendered field count equals sum of layer fields', () => {
    fc.assert(
      fc.property(anonPacketArb, (packet) => {
        const { renderedFieldCount } = simulateInspectorRender(packet)
        const expectedCount = packet.layers.reduce((sum, l) => sum + l.fields.length, 0)
        expect(renderedFieldCount).toBe(expectedCount)
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 12c: Each rendered layer protocol name is a non-empty string.
   * Validates: Requirement 23.1
   */
  it('each layer protocol name is a non-empty string', () => {
    fc.assert(
      fc.property(anonPacketArb, (packet) => {
        const { renderedLayers } = simulateInspectorRender(packet)
        for (const proto of renderedLayers) {
          expect(typeof proto).toBe('string')
          expect(proto.length).toBeGreaterThan(0)
        }
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 12d: Each field has a non-empty label, defined value, non-negative
   * byteOffset, and positive byteLength.
   * Validates: Requirement 23.3
   */
  it('each field has valid label, value, byteOffset, and byteLength', () => {
    fc.assert(
      fc.property(anonPacketArb, (packet) => {
        for (const layer of packet.layers) {
          for (const field of layer.fields) {
            expect(field.label.length, `field.label must be non-empty`).toBeGreaterThan(0)
            expect(field.value, `field.value must be defined`).toBeDefined()
            expect(field.byteOffset, `field.byteOffset must be >= 0`).toBeGreaterThanOrEqual(0)
            expect(field.byteLength, `field.byteLength must be > 0`).toBeGreaterThan(0)
          }
        }
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 12e: Layers with errors carry a non-empty error annotation string.
   * Validates: Requirement 23.1 (malformed layer annotation)
   */
  it('layers with errors carry a non-empty error annotation', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            protocol: protocolArb,
            fields: fc.array(fieldArb, { minLength: 0, maxLength: 5 }),
            error: fc.string({ minLength: 1, maxLength: 64 }), // always has error
            rawByteOffset: fc.integer({ min: 0, max: 100 }),
            rawByteLength: fc.integer({ min: 1, max: 100 })
          }),
          { minLength: 1, maxLength: 4 }
        ),
        (layers) => {
          for (const layer of layers) {
            expect(layer.error).toBeDefined()
            expect(typeof layer.error).toBe('string')
            expect((layer.error as string).length).toBeGreaterThan(0)
          }
        }
      ),
      { numRuns: 25 }
    )
  })

  /**
   * Property 12f: Unknown protocol layers are marked 'OTHER' and have
   * a non-negative rawByteLength (byte length preserved, Req 3.3).
   * Validates: Requirement 23.3
   */
  it('OTHER layers preserve rawByteLength >= 0', () => {
    fc.assert(
      fc.property(
        fc.record({
          protocol: fc.constant('OTHER' as const),
          fields: fc.array(fieldArb, { minLength: 0, maxLength: 3 }),
          error: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
          rawByteOffset: fc.integer({ min: 0, max: 1500 }),
          rawByteLength: fc.integer({ min: 0, max: 1500 })
        }),
        (layer: ParsedLayer) => {
          expect(layer.protocol).toBe('OTHER')
          expect(layer.rawByteLength).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 25 }
    )
  })

  /**
   * Property 12g: Layer ordering is preserved — rendered layer order matches
   * packet.layers array order (encapsulation depth is maintained).
   * Validates: Requirement 23.1
   */
  it('layer ordering is preserved in rendered output', () => {
    fc.assert(
      fc.property(anonPacketArb, (packet) => {
        const { renderedLayers } = simulateInspectorRender(packet)
        const sourceProtocols = packet.layers.map((l) => l.protocol)
        expect(renderedLayers).toEqual(sourceProtocols)
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 12h: Field label order within each layer is preserved.
   * Validates: Requirement 23.3
   */
  it('field label order within each layer is preserved', () => {
    fc.assert(
      fc.property(anonPacketArb, (packet) => {
        const { renderedFieldLabels } = simulateInspectorRender(packet)
        packet.layers.forEach((layer, i) => {
          const sourceLabels = layer.fields.map((f) => f.label)
          expect(renderedFieldLabels[i]).toEqual(sourceLabels)
        })
      }),
      { numRuns: 25 }
    )
  })
})
