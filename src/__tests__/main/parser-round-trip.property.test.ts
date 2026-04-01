// Feature: netvis-core, Property 5: Parse–print round trip
// Validates: Requirements 3.5, 3.6, 8.2

/**
 * Property 5: Parse–print round trip
 *
 * For any valid packet, parsing a PCAP record then printing then parsing again
 * SHALL produce a ParsedPacket with identical field values.
 *
 * Parser.print() produces: 16-byte libpcap record header + raw frame bytes.
 * To re-parse, we strip the 16-byte header and feed the frame bytes back in.
 *
 * Invariants verified:
 *   - Same number of layers
 *   - Same protocol at each layer index
 *   - Same field names and values at each layer
 *   - Same wireLength
 *   - Same timestamp (modulo sub-ms precision loss: ts_usec = (ts % 1000) * 1000)
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { Parser } from '../../main/parser/index'
import type { RawPacket, ParsedPacket } from '../../shared/capture-types'

// ─── Constants ────────────────────────────────────────────────────────────────

const LINKTYPE_ETHERNET = 1
const ETHERTYPE_IPV4 = 0x0800
const ETHERTYPE_IPV6 = 0x86dd
const ETHERTYPE_ARP = 0x0806
const IP_PROTO_TCP = 6
const IP_PROTO_UDP = 17
const IP_PROTO_ICMP = 1
const IP_PROTO_ICMPV6 = 58

/** Size of the libpcap per-packet record header written by Parser.print() */
const PCAP_RECORD_HEADER_BYTES = 16

// ─── Frame builders (reused from P4 test) ────────────────────────────────────

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
  buf.writeUInt16BE(0x4000, 6) // flags: DF, no fragment
  buf.writeUInt8(64, 8) // TTL
  buf.writeUInt8(protocol, 9)
  buf.writeUInt16BE(0, 10) // checksum (0 = unchecked)
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

function tcpHeader(srcPort: number, dstPort: number): Buffer {
  const buf = Buffer.alloc(20)
  buf.writeUInt16BE(srcPort, 0)
  buf.writeUInt16BE(dstPort, 2)
  buf.writeUInt32BE(1000, 4) // seq
  buf.writeUInt32BE(0, 8) // ack
  buf.writeUInt8(0x50, 12) // data offset=5
  buf.writeUInt8(0x02, 13) // SYN flag
  buf.writeUInt16BE(65535, 14) // window
  return buf
}

function udpHeader(srcPort: number, dstPort: number): Buffer {
  const buf = Buffer.alloc(8)
  buf.writeUInt16BE(srcPort, 0)
  buf.writeUInt16BE(dstPort, 2)
  buf.writeUInt16BE(8, 4)
  buf.writeUInt16BE(0, 6)
  return buf
}

function icmpHeader(type: number, code: number): Buffer {
  const buf = Buffer.alloc(8)
  buf.writeUInt8(type, 0)
  buf.writeUInt8(code, 1)
  buf.writeUInt16BE(0, 2)
  buf.writeUInt32BE(0, 4)
  return buf
}

function arpFrame(): Buffer {
  const buf = Buffer.alloc(28)
  buf.writeUInt16BE(1, 0) // hwType = Ethernet
  buf.writeUInt16BE(0x0800, 2) // protoType = IPv4
  buf.writeUInt8(6, 4) // hwSize
  buf.writeUInt8(4, 5) // protoSize
  buf.writeUInt16BE(1, 6) // operation = Request
  // sender MAC: 6 bytes at offset 8
  // sender IP: 4 bytes at offset 14
  buf.writeUInt8(192, 14)
  buf.writeUInt8(168, 15)
  buf.writeUInt8(1, 16)
  buf.writeUInt8(1, 17)
  // target MAC: 6 bytes at offset 18
  // target IP: 4 bytes at offset 24
  buf.writeUInt8(192, 24)
  buf.writeUInt8(168, 25)
  buf.writeUInt8(1, 26)
  buf.writeUInt8(2, 27)
  return buf
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const octetArb = fc.integer({ min: 0, max: 255 })
const ipv4AddrArb = fc.tuple(octetArb, octetArb, octetArb, octetArb)
const portArb = fc.integer({ min: 1, max: 65535 })
const nonDnsPortArb = portArb.filter((p) => p !== 53)

/** Arbitrary for a timestamp that survives the print→parse round trip.
 *  Parser.print() stores ts_usec = (ts % 1000) * 1000, so sub-ms precision
 *  is lost. We use timestamps that are exact multiples of 1 ms to avoid drift. */
const timestampArb = fc.integer({ min: 1_000_000_000, max: 2_000_000_000 }).map((s) => s * 1000)

const ethIpv4TcpArb = fc
  .tuple(ipv4AddrArb, ipv4AddrArb, nonDnsPortArb, nonDnsPortArb, timestampArb)
  .map(([src, dst, sp, dp, ts]) =>
    makeRawPacket(
      Buffer.concat([
        ethernetHeader(ETHERTYPE_IPV4),
        ipv4Header(IP_PROTO_TCP, src, dst),
        tcpHeader(sp, dp)
      ]),
      ts
    )
  )

const ethIpv4UdpArb = fc
  .tuple(ipv4AddrArb, ipv4AddrArb, nonDnsPortArb, nonDnsPortArb, timestampArb)
  .map(([src, dst, sp, dp, ts]) =>
    makeRawPacket(
      Buffer.concat([
        ethernetHeader(ETHERTYPE_IPV4),
        ipv4Header(IP_PROTO_UDP, src, dst),
        udpHeader(sp, dp)
      ]),
      ts
    )
  )

const ethIpv4IcmpArb = fc
  .tuple(
    ipv4AddrArb,
    ipv4AddrArb,
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    timestampArb
  )
  .map(([src, dst, type, code, ts]) =>
    makeRawPacket(
      Buffer.concat([
        ethernetHeader(ETHERTYPE_IPV4),
        ipv4Header(IP_PROTO_ICMP, src, dst),
        icmpHeader(type, code)
      ]),
      ts
    )
  )

const ethIpv6TcpArb = fc
  .tuple(nonDnsPortArb, nonDnsPortArb, timestampArb)
  .map(([sp, dp, ts]) =>
    makeRawPacket(
      Buffer.concat([ethernetHeader(ETHERTYPE_IPV6), ipv6Header(IP_PROTO_TCP), tcpHeader(sp, dp)]),
      ts
    )
  )

const ethIpv6UdpArb = fc
  .tuple(nonDnsPortArb, nonDnsPortArb, timestampArb)
  .map(([sp, dp, ts]) =>
    makeRawPacket(
      Buffer.concat([ethernetHeader(ETHERTYPE_IPV6), ipv6Header(IP_PROTO_UDP), udpHeader(sp, dp)]),
      ts
    )
  )

const ethIpv6IcmpArb = fc
  .tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), timestampArb)
  .map(([type, code, ts]) =>
    makeRawPacket(
      Buffer.concat([
        ethernetHeader(ETHERTYPE_IPV6),
        ipv6Header(IP_PROTO_ICMPV6),
        icmpHeader(type, code)
      ]),
      ts
    )
  )

const ethArpArb = timestampArb.map((ts) =>
  makeRawPacket(Buffer.concat([ethernetHeader(ETHERTYPE_ARP), arpFrame()]), ts)
)

const anyValidFrameArb = fc.oneof(
  ethIpv4TcpArb,
  ethIpv4UdpArb,
  ethIpv4IcmpArb,
  ethIpv6TcpArb,
  ethIpv6UdpArb,
  ethIpv6IcmpArb,
  ethArpArb
)

// ─── Round-trip helpers ───────────────────────────────────────────────────────

/**
 * Re-parse a ParsedPacket by:
 *  1. Calling Parser.print() to get the PCAP record (16-byte header + frame)
 *  2. Stripping the 16-byte header to recover the raw frame bytes
 *  3. Constructing a new RawPacket and calling Parser.parse() again
 */
function roundTrip(original: RawPacket, parsed: ParsedPacket): ParsedPacket {
  const record = Parser.print(parsed)
  // Strip the 16-byte libpcap record header to get the raw frame bytes
  const frameBytes = record.slice(PCAP_RECORD_HEADER_BYTES)
  const raw2: RawPacket = {
    timestamp: parsed.timestamp,
    sourceId: parsed.sourceId,
    captureMode: parsed.captureMode,
    data: new Uint8Array(frameBytes),
    length: parsed.wireLength,
    linkType: original.linkType
  }
  return Parser.parse(raw2)
}

/**
 * Compare two ParsedPackets for field-level equality.
 * Returns null if equal, or a description of the first difference found.
 */
function diffPackets(a: ParsedPacket, b: ParsedPacket): string | null {
  if (a.layers.length !== b.layers.length) {
    return `layer count: ${a.layers.length} vs ${b.layers.length}`
  }
  for (let li = 0; li < a.layers.length; li++) {
    const la = a.layers[li]
    const lb = b.layers[li]
    if (la.protocol !== lb.protocol) {
      return `layer[${li}].protocol: ${la.protocol} vs ${lb.protocol}`
    }
    if (la.fields.length !== lb.fields.length) {
      return `layer[${li}](${la.protocol}).fields.length: ${la.fields.length} vs ${lb.fields.length}`
    }
    for (let fi = 0; fi < la.fields.length; fi++) {
      const fa = la.fields[fi]
      const fb = lb.fields[fi]
      if (fa.name !== fb.name) {
        return `layer[${li}].fields[${fi}].name: ${fa.name} vs ${fb.name}`
      }
      if (fa.value !== fb.value) {
        return `layer[${li}].fields[${fi}](${fa.name}).value: ${fa.value} vs ${fb.value}`
      }
    }
  }
  return null
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Parser — parse–print round trip (P5)', () => {
  /**
   * Property 5a: For any valid Ethernet frame, parsing then printing then
   * parsing again produces the same number of layers with the same protocols.
   * Validates: Requirements 3.5, 3.6
   */
  it('round-trip preserves layer count and protocol sequence', () => {
    fc.assert(
      fc.property(anyValidFrameArb, (raw) => {
        const first = Parser.parse(raw)
        const second = roundTrip(raw, first)

        expect(second.layers.length).toBe(first.layers.length)
        for (let i = 0; i < first.layers.length; i++) {
          expect(second.layers[i].protocol).toBe(first.layers[i].protocol)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5b: For any valid Ethernet frame, all decoded field names and
   * values are identical after a parse → print → parse round trip.
   * Validates: Requirements 3.5, 3.6
   */
  it('round-trip preserves all field names and values', () => {
    fc.assert(
      fc.property(anyValidFrameArb, (raw) => {
        const first = Parser.parse(raw)
        const second = roundTrip(raw, first)

        const diff = diffPackets(first, second)
        expect(diff).toBeNull()
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5c: Parser.print() output is a valid PCAP record — the first
   * 16 bytes are a well-formed libpcap packet header with correct incl_len
   * matching the actual frame byte count.
   * Validates: Requirement 8.2
   */
  it('Parser.print() produces a valid PCAP record header with correct incl_len', () => {
    fc.assert(
      fc.property(anyValidFrameArb, (raw) => {
        const parsed = Parser.parse(raw)
        const record = Parser.print(parsed)

        // Record must be at least 16 bytes (header only)
        expect(record.length).toBeGreaterThanOrEqual(PCAP_RECORD_HEADER_BYTES)

        // incl_len (bytes 8–11, little-endian) must equal actual frame bytes
        const inclLen = record.readUInt32LE(8)
        expect(inclLen).toBe(record.length - PCAP_RECORD_HEADER_BYTES)

        // orig_len (bytes 12–15, little-endian) must equal wireLength
        const origLen = record.readUInt32LE(12)
        expect(origLen).toBe(parsed.wireLength)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5d: Parser.print() preserves the timestamp with ms precision.
   * ts_sec = floor(timestamp / 1000), ts_usec = (timestamp % 1000) * 1000.
   * Reconstructing: ts_sec * 1000 + floor(ts_usec / 1000) === original timestamp.
   * Validates: Requirement 3.5
   */
  it('Parser.print() encodes timestamp with millisecond precision', () => {
    fc.assert(
      fc.property(anyValidFrameArb, (raw) => {
        const parsed = Parser.parse(raw)
        const record = Parser.print(parsed)

        const tsSec = record.readUInt32LE(0)
        const tsUsec = record.readUInt32LE(4)

        // Reconstruct timestamp from PCAP header fields
        const reconstructed = tsSec * 1000 + Math.floor(tsUsec / 1000)
        expect(reconstructed).toBe(parsed.timestamp)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5e: wireLength is preserved through the round trip.
   * Validates: Requirement 3.5
   */
  it('round-trip preserves wireLength', () => {
    fc.assert(
      fc.property(anyValidFrameArb, (raw) => {
        const first = Parser.parse(raw)
        const second = roundTrip(raw, first)
        expect(second.wireLength).toBe(first.wireLength)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5f: The raw frame bytes stored in rawData are faithfully
   * reproduced by Parser.print() (after stripping the 16-byte header).
   * Validates: Requirement 8.2
   */
  it('Parser.print() frame bytes match the original rawData', () => {
    fc.assert(
      fc.property(anyValidFrameArb, (raw) => {
        const parsed = Parser.parse(raw)
        const record = Parser.print(parsed)
        const frameBytes = record.slice(PCAP_RECORD_HEADER_BYTES)

        expect(frameBytes.length).toBe(raw.data.length)
        for (let i = 0; i < frameBytes.length; i++) {
          expect(frameBytes[i]).toBe(raw.data[i])
        }
      }),
      { numRuns: 100 }
    )
  })
})
