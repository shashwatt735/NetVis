// Feature: netvis-core, Task 21.6.3: UDP/ICMP payload boundary fix
// Validates: Requirements 3.1, 3.2 - Correct byte offset calculations

/**
 * Focused tests for UDP/ICMP payload boundary edge cases:
 * - UDP length > IP payload length
 * - Truncated UDP packet where IP payload length > captured bytes
 * - Truncated ICMP packet where IP payload length > captured bytes
 * - IPv6 UDP with trailing bytes beyond payload boundary
 */

import { describe, it, expect } from 'vitest'
import { Parser } from '../../main/parser/index'
import type { RawPacket } from '../../shared/capture-types'

// ─── Constants ────────────────────────────────────────────────────────────────

const LINKTYPE_ETHERNET = 1
const ETHERTYPE_IPV4 = 0x0800
const ETHERTYPE_IPV6 = 0x86dd
const IP_PROTO_UDP = 17
const IP_PROTO_ICMP = 1

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRawPacket(data: Buffer): RawPacket {
  return {
    timestamp: Date.now(),
    sourceId: 'test',
    captureMode: 'file',
    data: new Uint8Array(data),
    length: data.length,
    linkType: LINKTYPE_ETHERNET
  }
}

function makeEthernetHeader(etherType: number): Buffer {
  const buf = Buffer.alloc(14)
  buf.writeUInt16BE(etherType, 12) // EtherType at offset 12
  return buf
}

function makeIPv4Header(protocol: number, totalLength: number): Buffer {
  const buf = Buffer.alloc(20)
  buf[0] = 0x45 // Version 4, IHL 5 (20 bytes)
  buf.writeUInt16BE(totalLength, 2) // Total Length
  buf[8] = 64 // TTL
  buf[9] = protocol // Protocol
  // Source IP: 192.168.1.1
  buf[12] = 192
  buf[13] = 168
  buf[14] = 1
  buf[15] = 1
  // Dest IP: 192.168.1.2
  buf[16] = 192
  buf[17] = 168
  buf[18] = 1
  buf[19] = 2
  return buf
}

function makeIPv6Header(nextHeader: number, payloadLength: number): Buffer {
  const buf = Buffer.alloc(40)
  buf.writeUInt32BE(0x60000000, 0) // Version 6, traffic class 0, flow label 0
  buf.writeUInt16BE(payloadLength, 4) // Payload Length
  buf[6] = nextHeader // Next Header
  buf[7] = 64 // Hop Limit
  // Source IP: 2001:db8::1
  buf.writeUInt16BE(0x2001, 8)
  buf.writeUInt16BE(0x0db8, 10)
  buf[23] = 1
  // Dest IP: 2001:db8::2
  buf.writeUInt16BE(0x2001, 24)
  buf.writeUInt16BE(0x0db8, 26)
  buf[39] = 2
  return buf
}

function makeUDPHeader(srcPort: number, dstPort: number, length: number): Buffer {
  const buf = Buffer.alloc(8)
  buf.writeUInt16BE(srcPort, 0)
  buf.writeUInt16BE(dstPort, 2)
  buf.writeUInt16BE(length, 4) // UDP Length
  buf.writeUInt16BE(0, 6) // Checksum
  return buf
}

function makeICMPHeader(type: number, code: number): Buffer {
  const buf = Buffer.alloc(4)
  buf[0] = type
  buf[1] = code
  buf.writeUInt16BE(0, 2) // Checksum
  return buf
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Parser — UDP/ICMP Payload Boundary Edge Cases', () => {
  describe('Edge Case 1: UDP length > IP payload length', () => {
    it('UDP rawByteLength is always 8 (header only)', () => {
      // rawByteLength = header length only (8 bytes for UDP).
      // The anonymizer uses rawByteOffset + rawByteLength as payloadStart,
      // so header-only is the correct semantic regardless of IP payload length.

      const eth = makeEthernetHeader(ETHERTYPE_IPV4)
      const ipv4 = makeIPv4Header(IP_PROTO_UDP, 38) // IP total = 38, payload = 18
      const udp = makeUDPHeader(12345, 80, 28) // UDP claims 28 bytes (exceeds IP payload)
      const payload = Buffer.alloc(10, 0xaa)

      const frame = Buffer.concat([eth, ipv4, udp, payload])
      const raw = makeRawPacket(frame)
      const parsed = Parser.parse(raw)

      const udpLayer = parsed.layers.find((l) => l.protocol === 'UDP')
      expect(udpLayer).toBeDefined()
      expect(udpLayer?.rawByteLength).toBe(8) // Header only
    })
  })

  describe('Edge Case 2: Truncated UDP packet (IP payload length > captured bytes)', () => {
    it('UDP rawByteLength is always 8 (header only) even when packet is truncated', () => {
      const eth = makeEthernetHeader(ETHERTYPE_IPV4)
      const ipv4 = makeIPv4Header(IP_PROTO_UDP, 48) // IP claims 28 byte payload
      const udp = makeUDPHeader(12345, 80, 18) // UDP claims 18 bytes total
      const payload = Buffer.alloc(5, 0xbb) // Only 5 bytes captured (truncated)

      const frame = Buffer.concat([eth, ipv4, udp, payload])
      const raw = makeRawPacket(frame)
      const parsed = Parser.parse(raw)

      const udpLayer = parsed.layers.find((l) => l.protocol === 'UDP')
      expect(udpLayer).toBeDefined()
      expect(udpLayer?.rawByteLength).toBe(8) // Header only
    })
  })

  describe('Edge Case 3: Truncated ICMP packet (IP payload length > captured bytes)', () => {
    it('ICMP rawByteLength is always 4 (header only) even when packet is truncated', () => {
      const eth = makeEthernetHeader(ETHERTYPE_IPV4)
      const ipv4 = makeIPv4Header(IP_PROTO_ICMP, 44) // IP claims 24 byte payload
      const icmp = makeICMPHeader(8, 0) // Echo request
      const payload = Buffer.alloc(3, 0xcc) // Only 3 bytes captured (truncated)

      const frame = Buffer.concat([eth, ipv4, icmp, payload])
      const raw = makeRawPacket(frame)
      const parsed = Parser.parse(raw)

      const icmpLayer = parsed.layers.find((l) => l.protocol === 'ICMP')
      expect(icmpLayer).toBeDefined()
      expect(icmpLayer?.rawByteLength).toBe(4) // Header only
    })
  })

  describe('Edge Case 4: IPv6 UDP with trailing bytes beyond payload boundary', () => {
    it('UDP rawByteLength is always 8 (header only) regardless of trailing bytes', () => {
      const eth = makeEthernetHeader(ETHERTYPE_IPV6)
      const ipv6 = makeIPv6Header(IP_PROTO_UDP, 20) // IPv6 payload = 20 bytes
      const udp = makeUDPHeader(12345, 80, 20) // UDP = 20 bytes
      const payload = Buffer.alloc(12, 0xdd) // UDP payload: 12 bytes
      const trailing = Buffer.alloc(8, 0xff) // Trailing bytes beyond IPv6 boundary

      const frame = Buffer.concat([eth, ipv6, udp, payload, trailing])
      const raw = makeRawPacket(frame)
      const parsed = Parser.parse(raw)

      const udpLayer = parsed.layers.find((l) => l.protocol === 'UDP')
      expect(udpLayer).toBeDefined()
      expect(udpLayer?.rawByteLength).toBe(8) // Header only
    })
  })

  describe('Edge Case 5: UDP with zero length field', () => {
    it('UDP rawByteLength is always 8 (header only) even with zero length field', () => {
      const eth = makeEthernetHeader(ETHERTYPE_IPV4)
      const ipv4 = makeIPv4Header(IP_PROTO_UDP, 38) // IP payload = 18
      const udp = makeUDPHeader(12345, 80, 0) // UDP length = 0 (invalid)
      const payload = Buffer.alloc(10, 0xee)

      const frame = Buffer.concat([eth, ipv4, udp, payload])
      const raw = makeRawPacket(frame)
      const parsed = Parser.parse(raw)

      const udpLayer = parsed.layers.find((l) => l.protocol === 'UDP')
      expect(udpLayer).toBeDefined()
      expect(udpLayer?.rawByteLength).toBe(8) // Header only
    })
  })

  describe('Edge Case 6: ICMP with IP payload length exceeding buffer', () => {
    it('ICMP rawByteLength is always 4 (header only) even when IP claims more bytes', () => {
      const eth = makeEthernetHeader(ETHERTYPE_IPV4)
      const ipv4 = makeIPv4Header(IP_PROTO_ICMP, 100) // IP claims 80 byte payload
      const icmp = makeICMPHeader(8, 0)
      const payload = Buffer.alloc(6, 0x99) // Only 6 bytes captured

      const frame = Buffer.concat([eth, ipv4, icmp, payload])
      const raw = makeRawPacket(frame)
      const parsed = Parser.parse(raw)

      const icmpLayer = parsed.layers.find((l) => l.protocol === 'ICMP')
      expect(icmpLayer).toBeDefined()
      expect(icmpLayer?.rawByteLength).toBe(4) // Header only
    })
  })
})
