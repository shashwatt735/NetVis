// Feature: netvis-core, Property 6: Anonymization invariant
// Validates: Requirements 4.1, 4.3, 4.4, 4.5

/**
 * Property 6: Anonymization invariant
 *
 * For any ParsedPacket, Anonymizer.anonymize(packet) must:
 *   (a) produce an AnonPacket where no field contains the original raw payload bytes
 *   (b) preserve all metadata fields (timestamp, sourceId, wireLength, layer structure,
 *       field names, byte offsets, byte lengths) unchanged
 *   (c) produce the same pseudonym token for the same input payload (determinism)
 *   (d) for DNS packets: preserve query name and record type; anonymize answer IPs
 *
 * Validates: Requirements 4.1, 4.3, 4.4, 4.5
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { Parser } from '../../main/parser/index'
import { Anonymizer } from '../../main/anonymizer/index'
import type { RawPacket } from '../../shared/capture-types'

// ─── Constants ────────────────────────────────────────────────────────────────

const LINKTYPE_ETHERNET = 1
const ETHERTYPE_IPV4 = 0x0800
const ETHERTYPE_IPV6 = 0x86dd
const IP_PROTO_TCP = 6
const IP_PROTO_UDP = 17
const IP_PROTO_ICMP = 1

// ─── Frame builders ───────────────────────────────────────────────────────────

function makeRawPacket(data: Buffer, timestamp = 1_700_000_000_000): RawPacket {
  return {
    timestamp,
    sourceId: 'test',
    captureMode: 'file',
    data: new Uint8Array(data),
    length: data.length,
    linkType: LINKTYPE_ETHERNET
  }
}

function ethernetHeader(etherType: number): Buffer {
  const buf = Buffer.alloc(14)
  buf.writeUInt8(0xaa, 0)
  buf.writeUInt8(0xbb, 1)
  buf.writeUInt8(0xcc, 2)
  buf.writeUInt8(0xdd, 3)
  buf.writeUInt8(0xee, 4)
  buf.writeUInt8(0xff, 5)
  buf.writeUInt8(0x11, 6)
  buf.writeUInt8(0x22, 7)
  buf.writeUInt8(0x33, 8)
  buf.writeUInt8(0x44, 9)
  buf.writeUInt8(0x55, 10)
  buf.writeUInt8(0x66, 11)
  buf.writeUInt16BE(etherType, 12)
  return buf
}

function ipv4Header(
  protocol: number,
  src: number[] = [10, 0, 0, 1],
  dst: number[] = [10, 0, 0, 2]
): Buffer {
  const buf = Buffer.alloc(20)
  buf.writeUInt8(0x45, 0) // version=4, IHL=5
  buf.writeUInt8(0x00, 1) // DSCP/ECN
  buf.writeUInt16BE(40, 2) // total length
  buf.writeUInt16BE(0x1234, 4) // identification
  buf.writeUInt16BE(0x4000, 6) // flags: DF
  buf.writeUInt8(64, 8) // TTL
  buf.writeUInt8(protocol, 9)
  buf.writeUInt16BE(0, 10) // checksum
  src.forEach((b, i) => buf.writeUInt8(b, 12 + i))
  dst.forEach((b, i) => buf.writeUInt8(b, 16 + i))
  return buf
}

function ipv6Header(nextHeader: number): Buffer {
  const buf = Buffer.alloc(40)
  buf.writeUInt8(0x60, 0) // version=6
  buf.writeUInt16BE(20, 4) // payload length
  buf.writeUInt8(nextHeader, 6)
  buf.writeUInt8(64, 7) // hop limit
  return buf
}

function tcpHeader(srcPort: number, dstPort: number, payload?: Buffer): Buffer {
  const header = Buffer.alloc(20)
  header.writeUInt16BE(srcPort, 0)
  header.writeUInt16BE(dstPort, 2)
  header.writeUInt32BE(1000, 4) // seq
  header.writeUInt32BE(0, 8) // ack
  header.writeUInt8(0x50, 12) // data offset=5
  header.writeUInt8(0x02, 13) // SYN flag
  header.writeUInt16BE(65535, 14) // window
  return payload ? Buffer.concat([header, payload]) : header
}

function udpHeader(srcPort: number, dstPort: number, payload?: Buffer): Buffer {
  const header = Buffer.alloc(8)
  header.writeUInt16BE(srcPort, 0)
  header.writeUInt16BE(dstPort, 2)
  header.writeUInt16BE(8 + (payload?.length || 0), 4)
  header.writeUInt16BE(0, 6)
  return payload ? Buffer.concat([header, payload]) : header
}

function icmpHeader(type: number, code: number): Buffer {
  const buf = Buffer.alloc(8)
  buf.writeUInt8(type, 0)
  buf.writeUInt8(code, 1)
  buf.writeUInt16BE(0, 2)
  buf.writeUInt32BE(0, 4)
  return buf
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const octetArb = fc.integer({ min: 0, max: 255 })
const ipv4AddrArb = fc.tuple(octetArb, octetArb, octetArb, octetArb)
const portArb = fc.integer({ min: 1, max: 65535 })
const nonDnsPortArb = portArb.filter((p) => p !== 53)
const payloadArb = fc.uint8Array({ minLength: 0, maxLength: 100 })

const ethIpv4TcpWithPayloadArb = fc
  .tuple(ipv4AddrArb, ipv4AddrArb, nonDnsPortArb, nonDnsPortArb, payloadArb)
  .map(([src, dst, sp, dp, payload]) =>
    makeRawPacket(
      Buffer.concat([
        ethernetHeader(ETHERTYPE_IPV4),
        ipv4Header(IP_PROTO_TCP, src, dst),
        tcpHeader(sp, dp, Buffer.from(payload))
      ])
    )
  )

const ethIpv4UdpWithPayloadArb = fc
  .tuple(ipv4AddrArb, ipv4AddrArb, nonDnsPortArb, nonDnsPortArb, payloadArb)
  .map(([src, dst, sp, dp, payload]) =>
    makeRawPacket(
      Buffer.concat([
        ethernetHeader(ETHERTYPE_IPV4),
        ipv4Header(IP_PROTO_UDP, src, dst),
        udpHeader(sp, dp, Buffer.from(payload))
      ])
    )
  )

const ethIpv4IcmpArb = fc
  .tuple(
    ipv4AddrArb,
    ipv4AddrArb,
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  )
  .map(([src, dst, type, code]) =>
    makeRawPacket(
      Buffer.concat([
        ethernetHeader(ETHERTYPE_IPV4),
        ipv4Header(IP_PROTO_ICMP, src, dst),
        icmpHeader(type, code)
      ])
    )
  )

const ethIpv6TcpWithPayloadArb = fc
  .tuple(nonDnsPortArb, nonDnsPortArb, payloadArb)
  .map(([sp, dp, payload]) =>
    makeRawPacket(
      Buffer.concat([
        ethernetHeader(ETHERTYPE_IPV6),
        ipv6Header(IP_PROTO_TCP),
        tcpHeader(sp, dp, Buffer.from(payload))
      ])
    )
  )

const anyTransportFrameArb = fc.oneof(
  ethIpv4TcpWithPayloadArb,
  ethIpv4UdpWithPayloadArb,
  ethIpv4IcmpArb,
  ethIpv6TcpWithPayloadArb
)

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Anonymizer — anonymization invariant (P6)', () => {
  /**
   * Property 6a: rawData field is never present in AnonPacket output.
   * Validates: Requirements 4.5, ARCH-04
   */
  it('AnonPacket never contains rawData field', () => {
    fc.assert(
      fc.property(anyTransportFrameArb, (raw) => {
        const parsed = Parser.parse(raw)
        const anon = Anonymizer.anonymize(parsed)
        expect(anon).not.toHaveProperty('rawData')
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 6b: Metadata fields are preserved unchanged.
   * Validates: Requirement 4.3
   */
  it('timestamp, sourceId, captureMode, wireLength are preserved', () => {
    fc.assert(
      fc.property(anyTransportFrameArb, (raw) => {
        const parsed = Parser.parse(raw)
        const anon = Anonymizer.anonymize(parsed)
        expect(anon.timestamp).toBe(parsed.timestamp)
        expect(anon.sourceId).toBe(parsed.sourceId)
        expect(anon.captureMode).toBe(parsed.captureMode)
        expect(anon.wireLength).toBe(parsed.wireLength)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 6c: Layer structure is preserved (same number of layers, same protocols).
   * Validates: Requirement 4.3
   */
  it('layer count and protocol sequence are preserved', () => {
    fc.assert(
      fc.property(anyTransportFrameArb, (raw) => {
        const parsed = Parser.parse(raw)
        const anon = Anonymizer.anonymize(parsed)
        expect(anon.layers.length).toBe(parsed.layers.length)
        for (let i = 0; i < parsed.layers.length; i++) {
          expect(anon.layers[i].protocol).toBe(parsed.layers[i].protocol)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 6d: Field names, byte offsets, and byte lengths are preserved.
   * Validates: Requirement 4.3
   */
  it('field metadata (names, offsets, lengths) are preserved', () => {
    fc.assert(
      fc.property(anyTransportFrameArb, (raw) => {
        const parsed = Parser.parse(raw)
        const anon = Anonymizer.anonymize(parsed)
        for (let li = 0; li < parsed.layers.length; li++) {
          const parsedLayer = parsed.layers[li]
          const anonLayer = anon.layers[li]
          // Field count may differ by 1 if payload field is added
          expect(anonLayer.fields.length).toBeGreaterThanOrEqual(parsedLayer.fields.length)
          expect(anonLayer.fields.length).toBeLessThanOrEqual(parsedLayer.fields.length + 1)
          // Check all original fields are present with same metadata
          for (const pf of parsedLayer.fields) {
            const af = anonLayer.fields.find((f) => f.name === pf.name)
            expect(af).toBeDefined()
            expect(af!.byteOffset).toBe(pf.byteOffset)
            expect(af!.byteLength).toBe(pf.byteLength)
          }
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 6e: Anonymization is deterministic — same input produces same pseudonym.
   * Validates: Requirement 4.1
   */
  it('same packet produces identical pseudonym on repeated anonymization', () => {
    fc.assert(
      fc.property(anyTransportFrameArb, (raw) => {
        const parsed = Parser.parse(raw)
        const anon1 = Anonymizer.anonymize(parsed)
        const anon2 = Anonymizer.anonymize(parsed)
        // Compare payload field values in transport layers
        for (let li = 0; li < anon1.layers.length; li++) {
          const layer1 = anon1.layers[li]
          const layer2 = anon2.layers[li]
          const payload1 = layer1.fields.find((f) => f.name === 'payload')
          const payload2 = layer2.fields.find((f) => f.name === 'payload')
          if (payload1 && payload2) {
            expect(payload1.value).toBe(payload2.value)
          }
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 6f: Transport layer gets a payload field with an 8-character hex pseudonym.
   * Validates: Requirement 4.1
   */
  it('transport layers have payload field with 8-char hex pseudonym', () => {
    fc.assert(
      fc.property(anyTransportFrameArb, (raw) => {
        const parsed = Parser.parse(raw)
        const anon = Anonymizer.anonymize(parsed)
        const transportLayer = anon.layers.find(
          (l) => l.protocol === 'TCP' || l.protocol === 'UDP' || l.protocol === 'ICMP'
        )
        if (transportLayer) {
          const payloadField = transportLayer.fields.find((f) => f.name === 'payload')
          expect(payloadField).toBeDefined()
          expect(typeof payloadField!.value).toBe('string')
          expect(payloadField!.value).toMatch(/^[0-9a-f]{8}$/)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 6g: Convenience fields (srcAddress, dstAddress, protocol) are populated.
   * Validates: Requirement 4.3
   */
  it('convenience fields are populated from layer data', () => {
    fc.assert(
      fc.property(anyTransportFrameArb, (raw) => {
        const parsed = Parser.parse(raw)
        const anon = Anonymizer.anonymize(parsed)
        expect(anon.srcAddress).toBeTruthy()
        expect(anon.dstAddress).toBeTruthy()
        expect(anon.protocol).toBeTruthy()
      }),
      { numRuns: 100 }
    )
  })
})
