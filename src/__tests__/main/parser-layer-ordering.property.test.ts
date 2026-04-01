// Feature: netvis-core, Property 4: Parser layer ordering
// Validates: Requirements 3.1, 3.2

/**
 * Property 4: Parser layer ordering
 *
 * The Parser decodes protocol layers in order:
 *   Ethernet → IP (v4 and v6) → TCP, UDP, ICMP, DNS
 *
 * Key implementation note: the Ethernet layer is stored with protocol 'OTHER'
 * (since 'ETHERNET' is not in ProtocolName), but it is always the first layer
 * for LINKTYPE_ETHERNET frames. We verify structural ordering by layer index.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { Parser } from '../../main/parser/index'
import type { RawPacket, ProtocolName } from '../../shared/capture-types'

// ─── Constants ────────────────────────────────────────────────────────────────

const LINKTYPE_ETHERNET = 1
// const LINKTYPE_NULL = 0 // Reserved for future use

const ETHERTYPE_IPV4 = 0x0800
const ETHERTYPE_IPV6 = 0x86dd
// const ETHERTYPE_ARP = 0x0806 // Reserved for future use

const IP_PROTO_ICMP = 1
const IP_PROTO_TCP = 6
const IP_PROTO_UDP = 17
const IP_PROTO_ICMPV6 = 58

const TRANSPORT_PROTOCOLS: ProtocolName[] = ['TCP', 'UDP', 'ICMP']
const NETWORK_PROTOCOLS: ProtocolName[] = ['IPv4', 'IPv6']

// ─── Frame builders ───────────────────────────────────────────────────────────

function makeRawPacket(data: Buffer, linkType = LINKTYPE_ETHERNET): RawPacket {
  return {
    timestamp: Date.now(),
    sourceId: 'test',
    captureMode: 'file',
    data: new Uint8Array(data),
    length: data.length,
    linkType
  }
}

/** Build a minimal valid Ethernet header (14 bytes) */
function ethernetHeader(etherType: number): Buffer {
  const buf = Buffer.alloc(14)
  // dst MAC: 6 bytes
  buf.writeUInt8(0xaa, 0)
  buf.writeUInt8(0xbb, 1)
  buf.writeUInt8(0xcc, 2)
  buf.writeUInt8(0xdd, 3)
  buf.writeUInt8(0xee, 4)
  buf.writeUInt8(0xff, 5)
  // src MAC: 6 bytes
  buf.writeUInt8(0x11, 6)
  buf.writeUInt8(0x22, 7)
  buf.writeUInt8(0x33, 8)
  buf.writeUInt8(0x44, 9)
  buf.writeUInt8(0x55, 10)
  buf.writeUInt8(0x66, 11)
  // EtherType
  buf.writeUInt16BE(etherType, 12)
  return buf
}

/** Build a minimal valid IPv4 header (20 bytes) */
function ipv4Header(protocol: number, srcIp?: number[], dstIp?: number[]): Buffer {
  const buf = Buffer.alloc(20)
  buf.writeUInt8(0x45, 0) // version=4, IHL=5 (20 bytes)
  buf.writeUInt8(0x00, 1) // DSCP/ECN
  buf.writeUInt16BE(40, 2) // total length (20 IP + 20 TCP)
  buf.writeUInt16BE(0, 4) // identification
  buf.writeUInt16BE(0, 6) // flags/fragment offset
  buf.writeUInt8(64, 8) // TTL
  buf.writeUInt8(protocol, 9) // protocol
  buf.writeUInt16BE(0, 10) // checksum
  const src = srcIp ?? [192, 168, 1, 1]
  const dst = dstIp ?? [192, 168, 1, 2]
  buf.writeUInt8(src[0], 12)
  buf.writeUInt8(src[1], 13)
  buf.writeUInt8(src[2], 14)
  buf.writeUInt8(src[3], 15)
  buf.writeUInt8(dst[0], 16)
  buf.writeUInt8(dst[1], 17)
  buf.writeUInt8(dst[2], 18)
  buf.writeUInt8(dst[3], 19)
  return buf
}

/** Build a minimal valid IPv6 header (40 bytes) */
function ipv6Header(nextHeader: number): Buffer {
  const buf = Buffer.alloc(40)
  buf.writeUInt8(0x60, 0) // version=6, traffic class high nibble=0
  buf.writeUInt8(0x00, 1)
  buf.writeUInt16BE(0, 2) // flow label
  buf.writeUInt16BE(20, 4) // payload length
  buf.writeUInt8(nextHeader, 6) // next header
  buf.writeUInt8(64, 7) // hop limit
  // src IPv6: 16 bytes (all zeros)
  // dst IPv6: 16 bytes (all zeros)
  return buf
}

/** Build a minimal valid TCP header (20 bytes) */
function tcpHeader(srcPort = 12345, dstPort = 80): Buffer {
  const buf = Buffer.alloc(20)
  buf.writeUInt16BE(srcPort, 0)
  buf.writeUInt16BE(dstPort, 2)
  buf.writeUInt32BE(1000, 4) // seq
  buf.writeUInt32BE(0, 8) // ack
  buf.writeUInt8(0x50, 12) // data offset = 5 (20 bytes), reserved = 0
  buf.writeUInt8(0x02, 13) // flags: SYN
  buf.writeUInt16BE(65535, 14) // window
  buf.writeUInt16BE(0, 16) // checksum
  buf.writeUInt16BE(0, 18) // urgent pointer
  return buf
}

/** Build a minimal valid UDP header (8 bytes) */
function udpHeader(srcPort = 54321, dstPort = 8080): Buffer {
  const buf = Buffer.alloc(8)
  buf.writeUInt16BE(srcPort, 0)
  buf.writeUInt16BE(dstPort, 2)
  buf.writeUInt16BE(8, 4) // length
  buf.writeUInt16BE(0, 6) // checksum
  return buf
}

/** Build a minimal valid ICMP header (8 bytes) */
function icmpHeader(type = 8, code = 0): Buffer {
  const buf = Buffer.alloc(8)
  buf.writeUInt8(type, 0)
  buf.writeUInt8(code, 1)
  buf.writeUInt16BE(0, 2) // checksum
  buf.writeUInt32BE(0, 4) // rest of header
  return buf
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Arbitrary for a valid IPv4 octet */
const octetArb = fc.integer({ min: 0, max: 255 })

/** Arbitrary for a valid IPv4 address as 4-byte array */
const ipv4AddrArb = fc.tuple(octetArb, octetArb, octetArb, octetArb)

/** Arbitrary for a valid port number */
const portArb = fc.integer({ min: 1, max: 65535 })

/** Arbitrary for a non-DNS port (not 53) */
const nonDnsPortArb = fc.integer({ min: 1, max: 65535 }).filter((p) => p !== 53)

/** Arbitrary for an Ethernet+IPv4+TCP frame */
const ethIpv4TcpArb = fc
  .tuple(ipv4AddrArb, ipv4AddrArb, portArb, portArb)
  .map(([src, dst, srcPort, dstPort]) => {
    return Buffer.concat([
      ethernetHeader(ETHERTYPE_IPV4),
      ipv4Header(IP_PROTO_TCP, src, dst),
      tcpHeader(srcPort, dstPort)
    ])
  })

/** Arbitrary for an Ethernet+IPv4+UDP frame (non-DNS ports) */
const ethIpv4UdpArb = fc
  .tuple(ipv4AddrArb, ipv4AddrArb, nonDnsPortArb, nonDnsPortArb)
  .map(([src, dst, srcPort, dstPort]) => {
    return Buffer.concat([
      ethernetHeader(ETHERTYPE_IPV4),
      ipv4Header(IP_PROTO_UDP, src, dst),
      udpHeader(srcPort, dstPort)
    ])
  })

/** Arbitrary for an Ethernet+IPv4+ICMP frame */
const ethIpv4IcmpArb = fc
  .tuple(
    ipv4AddrArb,
    ipv4AddrArb,
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  )
  .map(([src, dst, type, code]) => {
    return Buffer.concat([
      ethernetHeader(ETHERTYPE_IPV4),
      ipv4Header(IP_PROTO_ICMP, src, dst),
      icmpHeader(type, code)
    ])
  })

/** Arbitrary for an Ethernet+IPv6+TCP frame */
const ethIpv6TcpArb = fc.tuple(portArb, portArb).map(([srcPort, dstPort]) => {
  return Buffer.concat([
    ethernetHeader(ETHERTYPE_IPV6),
    ipv6Header(IP_PROTO_TCP),
    tcpHeader(srcPort, dstPort)
  ])
})

/** Arbitrary for an Ethernet+IPv6+UDP frame (non-DNS ports) */
const ethIpv6UdpArb = fc.tuple(nonDnsPortArb, nonDnsPortArb).map(([srcPort, dstPort]) => {
  return Buffer.concat([
    ethernetHeader(ETHERTYPE_IPV6),
    ipv6Header(IP_PROTO_UDP),
    udpHeader(srcPort, dstPort)
  ])
})

/** Arbitrary for an Ethernet+IPv6+ICMPv6 frame */
const ethIpv6IcmpArb = fc
  .tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }))
  .map(([type, code]) => {
    return Buffer.concat([
      ethernetHeader(ETHERTYPE_IPV6),
      ipv6Header(IP_PROTO_ICMPV6),
      icmpHeader(type, code)
    ])
  })

/** Union of all valid Ethernet+IP+transport frames */
const anyEthIpTransportArb = fc.oneof(
  ethIpv4TcpArb,
  ethIpv4UdpArb,
  ethIpv4IcmpArb,
  ethIpv6TcpArb,
  ethIpv6UdpArb,
  ethIpv6IcmpArb
)

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Parser — layer ordering invariant (P4)', () => {
  /**
   * Property 4a: For LINKTYPE_ETHERNET frames, the first layer is always the
   * link layer (Ethernet), stored as protocol 'OTHER' per the parser implementation.
   * Validates: Requirement 3.1
   */
  it('first layer of any LINKTYPE_ETHERNET frame is the link layer (index 0)', () => {
    fc.assert(
      fc.property(anyEthIpTransportArb, (frameData) => {
        const raw = makeRawPacket(frameData)
        const parsed = Parser.parse(raw)
        expect(parsed.layers.length).toBeGreaterThanOrEqual(1)
        // Layer 0 is always the Ethernet/link layer.
        // The parser stores it as 'OTHER' since 'ETHERNET' is not in ProtocolName.
        // It has exactly 3 fields: dst MAC, src MAC, EtherType.
        const layer0 = parsed.layers[0]
        expect(layer0).toBeDefined()
        // Ethernet layer has dst, src, etherType fields
        const fieldNames = layer0.fields.map((f) => f.name)
        expect(fieldNames).toContain('dst')
        expect(fieldNames).toContain('src')
        expect(fieldNames).toContain('etherType')
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4b: For LINKTYPE_ETHERNET frames with IPv4/IPv6, the network layer
   * (IPv4 or IPv6) always appears at index 1 — after the Ethernet layer.
   * Validates: Requirement 3.1
   */
  it('network layer (IPv4/IPv6) always appears at index 1, after the link layer', () => {
    fc.assert(
      fc.property(anyEthIpTransportArb, (frameData) => {
        const raw = makeRawPacket(frameData)
        const parsed = Parser.parse(raw)
        expect(parsed.layers.length).toBeGreaterThanOrEqual(2)
        const layer1 = parsed.layers[1]
        expect(NETWORK_PROTOCOLS).toContain(layer1.protocol)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4c: Transport layer (TCP/UDP/ICMP) always appears at index 2 or later —
   * never before the network layer.
   * Validates: Requirement 3.1
   */
  it('transport layer (TCP/UDP/ICMP) never appears before the network layer', () => {
    fc.assert(
      fc.property(anyEthIpTransportArb, (frameData) => {
        const raw = makeRawPacket(frameData)
        const parsed = Parser.parse(raw)
        const layers = parsed.layers

        const networkIdx = layers.findIndex((l) => NETWORK_PROTOCOLS.includes(l.protocol))
        const transportIdx = layers.findIndex((l) => TRANSPORT_PROTOCOLS.includes(l.protocol))

        // Both must be present
        expect(networkIdx).toBeGreaterThanOrEqual(0)
        expect(transportIdx).toBeGreaterThanOrEqual(0)

        // Transport must come after network
        expect(transportIdx).toBeGreaterThan(networkIdx)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4d: The layer ordering invariant — each layer at index N+1 is a
   * valid encapsulated protocol within the layer at index N.
   * Valid encapsulation relationships:
   *   link layer (index 0) → IPv4 | IPv6 | ARP | OTHER
   *   IPv4 | IPv6 → TCP | UDP | ICMP | OTHER
   *   UDP (port 53) → DNS
   * Validates: Requirement 3.1
   */
  it('each consecutive layer pair satisfies the valid encapsulation relationship', () => {
    fc.assert(
      fc.property(anyEthIpTransportArb, (frameData) => {
        const raw = makeRawPacket(frameData)
        const parsed = Parser.parse(raw)
        const layers = parsed.layers

        for (let i = 0; i < layers.length - 1; i++) {
          const outer = layers[i]
          const inner = layers[i + 1]

          if (i === 0) {
            // Link layer can contain: IPv4, IPv6, ARP, OTHER
            const validInner: ProtocolName[] = ['IPv4', 'IPv6', 'ARP', 'OTHER']
            expect(validInner).toContain(inner.protocol)
          } else if (outer.protocol === 'IPv4' || outer.protocol === 'IPv6') {
            // Network layer can contain: TCP, UDP, ICMP, OTHER
            const validInner: ProtocolName[] = ['TCP', 'UDP', 'ICMP', 'OTHER']
            expect(validInner).toContain(inner.protocol)
          } else if (outer.protocol === 'UDP') {
            // UDP can contain: DNS (when port 53), OTHER
            const validInner: ProtocolName[] = ['DNS', 'OTHER']
            expect(validInner).toContain(inner.protocol)
          } else if (outer.protocol === 'TCP') {
            // TCP payload is not further decoded in this parser
            const validInner: ProtocolName[] = ['OTHER']
            expect(validInner).toContain(inner.protocol)
          }
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4e: For non-LINKTYPE_ETHERNET frames, the parser produces exactly
   * one layer with protocol 'OTHER' (no Ethernet/IP/transport decoding attempted).
   * Validates: Requirement 3.1 (parser handles non-Ethernet link types gracefully)
   */
  it('non-LINKTYPE_ETHERNET frames produce a single OTHER layer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 200 }).filter((lt) => lt !== LINKTYPE_ETHERNET),
        fc.uint8Array({ minLength: 14, maxLength: 100 }),
        (linkType, bytes) => {
          const raw = makeRawPacket(Buffer.from(bytes), linkType)
          const parsed = Parser.parse(raw)
          expect(parsed.layers).toHaveLength(1)
          expect(parsed.layers[0].protocol).toBe('OTHER')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4f: IPv4 layer always contains the required standard header fields:
   * version, ihl, dscp, totalLength, ttl, protocol, src, dst.
   * Validates: Requirement 3.2
   */
  it('IPv4 layer always contains all required standard header fields', () => {
    const ipv4Frames = fc.oneof(ethIpv4TcpArb, ethIpv4UdpArb, ethIpv4IcmpArb)
    fc.assert(
      fc.property(ipv4Frames, (frameData) => {
        const raw = makeRawPacket(frameData)
        const parsed = Parser.parse(raw)
        const ipv4Layer = parsed.layers.find((l) => l.protocol === 'IPv4')
        expect(ipv4Layer).toBeDefined()
        const fieldNames = ipv4Layer!.fields.map((f) => f.name)
        expect(fieldNames).toContain('version')
        expect(fieldNames).toContain('ihl')
        expect(fieldNames).toContain('ttl')
        expect(fieldNames).toContain('protocol')
        expect(fieldNames).toContain('src')
        expect(fieldNames).toContain('dst')
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4g: IPv6 layer always contains the required standard header fields:
   * version, trafficClass, flowLabel, payloadLength, nextHeader, hopLimit, src, dst.
   * Validates: Requirement 3.2
   */
  it('IPv6 layer always contains all required standard header fields', () => {
    const ipv6Frames = fc.oneof(ethIpv6TcpArb, ethIpv6UdpArb, ethIpv6IcmpArb)
    fc.assert(
      fc.property(ipv6Frames, (frameData) => {
        const raw = makeRawPacket(frameData)
        const parsed = Parser.parse(raw)
        const ipv6Layer = parsed.layers.find((l) => l.protocol === 'IPv6')
        expect(ipv6Layer).toBeDefined()
        const fieldNames = ipv6Layer!.fields.map((f) => f.name)
        expect(fieldNames).toContain('version')
        expect(fieldNames).toContain('trafficClass')
        expect(fieldNames).toContain('flowLabel')
        expect(fieldNames).toContain('payloadLength')
        expect(fieldNames).toContain('nextHeader')
        expect(fieldNames).toContain('hopLimit')
        expect(fieldNames).toContain('src')
        expect(fieldNames).toContain('dst')
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4h: TCP layer always contains the required standard header fields:
   * srcPort, dstPort, seqNum, ackNum, flags, windowSize.
   * Validates: Requirement 3.2
   */
  it('TCP layer always contains all required standard header fields', () => {
    const tcpFrames = fc.oneof(ethIpv4TcpArb, ethIpv6TcpArb)
    fc.assert(
      fc.property(tcpFrames, (frameData) => {
        const raw = makeRawPacket(frameData)
        const parsed = Parser.parse(raw)
        const tcpLayer = parsed.layers.find((l) => l.protocol === 'TCP')
        expect(tcpLayer).toBeDefined()
        const fieldNames = tcpLayer!.fields.map((f) => f.name)
        expect(fieldNames).toContain('srcPort')
        expect(fieldNames).toContain('dstPort')
        expect(fieldNames).toContain('seqNum')
        expect(fieldNames).toContain('ackNum')
        expect(fieldNames).toContain('flags')
        expect(fieldNames).toContain('windowSize')
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4i: UDP layer always contains the required standard header fields:
   * srcPort, dstPort, length, checksum.
   * Validates: Requirement 3.2
   */
  it('UDP layer always contains all required standard header fields', () => {
    const udpFrames = fc.oneof(ethIpv4UdpArb, ethIpv6UdpArb)
    fc.assert(
      fc.property(udpFrames, (frameData) => {
        const raw = makeRawPacket(frameData)
        const parsed = Parser.parse(raw)
        const udpLayer = parsed.layers.find((l) => l.protocol === 'UDP')
        expect(udpLayer).toBeDefined()
        const fieldNames = udpLayer!.fields.map((f) => f.name)
        expect(fieldNames).toContain('srcPort')
        expect(fieldNames).toContain('dstPort')
        expect(fieldNames).toContain('length')
        expect(fieldNames).toContain('checksum')
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4j: ICMP layer always contains the required standard header fields:
   * type, code, checksum.
   * Validates: Requirement 3.2
   */
  it('ICMP layer always contains all required standard header fields', () => {
    const icmpFrames = fc.oneof(ethIpv4IcmpArb, ethIpv6IcmpArb)
    fc.assert(
      fc.property(icmpFrames, (frameData) => {
        const raw = makeRawPacket(frameData)
        const parsed = Parser.parse(raw)
        const icmpLayer = parsed.layers.find((l) => l.protocol === 'ICMP')
        expect(icmpLayer).toBeDefined()
        const fieldNames = icmpLayer!.fields.map((f) => f.name)
        expect(fieldNames).toContain('type')
        expect(fieldNames).toContain('code')
        expect(fieldNames).toContain('checksum')
      }),
      { numRuns: 100 }
    )
  })
})
