/**
 * Parser — decodes raw Ethernet frames into structured ParsedPacket layers.
 * Pretty_Printer — serializes a ParsedPacket back into a valid PCAP record.
 *
 * Design rules:
 *  - No external parsing libraries. Only Node.js built-ins (crypto, Buffer/DataView).
 *  - All byte reads are bounds-checked; malformed layers are annotated, never thrown.
 *  - Unknown EtherType/protocol → layer with protocol: 'OTHER', rawByteLength preserved.
 *  - linkType !== 1 (LINKTYPE_ETHERNET) → single 'OTHER' layer.
 */

import { randomUUID } from 'crypto'
import type {
  RawPacket,
  ParsedPacket,
  ParsedLayer,
  ParsedField,
  ProtocolName
} from '../../shared/capture-types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function field(
  name: string,
  label: string,
  value: string | number,
  byteOffset: number,
  byteLength: number
): ParsedField {
  return { name, label, value, byteOffset, byteLength }
}

function macToString(view: DataView, offset: number): string {
  const bytes: string[] = []
  for (let i = 0; i < 6; i++) {
    bytes.push(
      view
        .getUint8(offset + i)
        .toString(16)
        .padStart(2, '0')
    )
  }
  return bytes.join(':')
}

function ipv4ToString(view: DataView, offset: number): string {
  return `${view.getUint8(offset)}.${view.getUint8(offset + 1)}.${view.getUint8(offset + 2)}.${view.getUint8(offset + 3)}`
}

function ipv6ToString(view: DataView, offset: number): string {
  const groups: string[] = []
  for (let i = 0; i < 8; i++) {
    groups.push(view.getUint16(offset + i * 2).toString(16))
  }
  return groups.join(':')
}

// ─── Layer decoders ───────────────────────────────────────────────────────────

function decodeEthernet(
  view: DataView,
  offset: number
): { layer: ParsedLayer; nextOffset: number; etherType: number } {
  const fields: ParsedField[] = []
  let error: string | undefined
  let etherType = 0
  const startOffset = offset

  try {
    if (view.byteLength < offset + 14) throw new Error('Ethernet header truncated')
    const dst = macToString(view, offset)
    fields.push(field('dst', 'Destination MAC', dst, offset, 6))
    const src = macToString(view, offset + 6)
    fields.push(field('src', 'Source MAC', src, offset + 6, 6))
    etherType = view.getUint16(offset + 12)
    fields.push(
      field(
        'etherType',
        'EtherType',
        `0x${etherType.toString(16).padStart(4, '0')}`,
        offset + 12,
        2
      )
    )
  } catch (e) {
    error = (e as Error).message
  }

  const layer: ParsedLayer = {
    protocol: 'OTHER' as ProtocolName, // will be overridden by caller label
    fields,
    rawByteOffset: startOffset,
    rawByteLength: Math.min(14, view.byteLength - startOffset),
    ...(error ? { error } : {})
  }

  return { layer, nextOffset: offset + 14, etherType }
}

function decodeIPv4(
  view: DataView,
  offset: number
): { layer: ParsedLayer; nextOffset: number; protocol: number } {
  const fields: ParsedField[] = []
  let error: string | undefined
  let protocol = 0
  let nextOffset = offset
  const startOffset = offset

  try {
    if (view.byteLength < offset + 20) throw new Error('IPv4 header truncated')
    const versionIHL = view.getUint8(offset)
    const version = (versionIHL >> 4) & 0xf
    const ihl = (versionIHL & 0xf) * 4
    if (ihl < 20) throw new Error(`IPv4 IHL ${ihl} is below minimum header size of 20 bytes`)
    if (offset + ihl > view.byteLength) throw new Error('IPv4 header options truncated')
    fields.push(field('version', 'Version', version, offset, 1))
    fields.push(field('ihl', 'Header Length', ihl, offset, 1))
    const dscp = (view.getUint8(offset + 1) >> 2) & 0x3f
    fields.push(field('dscp', 'DSCP', dscp, offset + 1, 1))
    const totalLength = view.getUint16(offset + 2)
    fields.push(field('totalLength', 'Total Length', totalLength, offset + 2, 2))
    const ttl = view.getUint8(offset + 8)
    fields.push(field('ttl', 'TTL', ttl, offset + 8, 1))
    protocol = view.getUint8(offset + 9)
    fields.push(field('protocol', 'Protocol', protocol, offset + 9, 1))
    const src = ipv4ToString(view, offset + 12)
    fields.push(field('src', 'Source IP', src, offset + 12, 4))
    const dst = ipv4ToString(view, offset + 16)
    fields.push(field('dst', 'Destination IP', dst, offset + 16, 4))
    nextOffset = offset + ihl
  } catch (e) {
    error = (e as Error).message
    nextOffset = offset + 20
  }

  const layer: ParsedLayer = {
    protocol: 'IPv4',
    fields,
    rawByteOffset: startOffset,
    rawByteLength: nextOffset - startOffset,
    ...(error ? { error } : {})
  }

  return { layer, nextOffset, protocol }
}

function decodeIPv6(
  view: DataView,
  offset: number
): { layer: ParsedLayer; nextOffset: number; protocol: number } {
  const fields: ParsedField[] = []
  let error: string | undefined
  let protocol = 0
  const startOffset = offset

  try {
    if (view.byteLength < offset + 40) throw new Error('IPv6 header truncated')
    const word0 = view.getUint32(offset)
    const version = (word0 >> 28) & 0xf
    const trafficClass = (word0 >> 20) & 0xff
    const flowLabel = word0 & 0xfffff
    fields.push(field('version', 'Version', version, offset, 1))
    fields.push(field('trafficClass', 'Traffic Class', trafficClass, offset, 1))
    fields.push(field('flowLabel', 'Flow Label', flowLabel, offset, 3))
    const payloadLength = view.getUint16(offset + 4)
    fields.push(field('payloadLength', 'Payload Length', payloadLength, offset + 4, 2))
    protocol = view.getUint8(offset + 6)
    fields.push(field('nextHeader', 'Next Header', protocol, offset + 6, 1))
    const hopLimit = view.getUint8(offset + 7)
    fields.push(field('hopLimit', 'Hop Limit', hopLimit, offset + 7, 1))
    const src = ipv6ToString(view, offset + 8)
    fields.push(field('src', 'Source IP', src, offset + 8, 16))
    const dst = ipv6ToString(view, offset + 24)
    fields.push(field('dst', 'Destination IP', dst, offset + 24, 16))
  } catch (e) {
    error = (e as Error).message
  }

  const layer: ParsedLayer = {
    protocol: 'IPv6',
    fields,
    rawByteOffset: startOffset,
    rawByteLength: 40,
    ...(error ? { error } : {})
  }

  return { layer, nextOffset: offset + 40, protocol }
}

function decodeTCP(view: DataView, offset: number): ParsedLayer {
  const fields: ParsedField[] = []
  let error: string | undefined
  const startOffset = offset

  try {
    if (view.byteLength < offset + 20) throw new Error('TCP header truncated')
    const srcPort = view.getUint16(offset)
    fields.push(field('srcPort', 'Source Port', srcPort, offset, 2))
    const dstPort = view.getUint16(offset + 2)
    fields.push(field('dstPort', 'Destination Port', dstPort, offset + 2, 2))
    const seqNum = view.getUint32(offset + 4)
    fields.push(field('seqNum', 'Sequence Number', seqNum, offset + 4, 4))
    const ackNum = view.getUint32(offset + 8)
    fields.push(field('ackNum', 'Acknowledgment Number', ackNum, offset + 8, 4))
    const dataOffset = ((view.getUint8(offset + 12) >> 4) & 0xf) * 4
    const flagsByte = view.getUint8(offset + 13)
    const flags = [
      flagsByte & 0x02 ? 'SYN' : '',
      flagsByte & 0x10 ? 'ACK' : '',
      flagsByte & 0x01 ? 'FIN' : '',
      flagsByte & 0x04 ? 'RST' : '',
      flagsByte & 0x08 ? 'PSH' : '',
      flagsByte & 0x20 ? 'URG' : ''
    ]
      .filter(Boolean)
      .join(',')
    fields.push(field('flags', 'Flags', flags || '0', offset + 13, 1))
    const windowSize = view.getUint16(offset + 14)
    fields.push(field('windowSize', 'Window Size', windowSize, offset + 14, 2))
    return {
      protocol: 'TCP',
      fields,
      rawByteOffset: startOffset,
      rawByteLength: dataOffset || 20
    }
  } catch (e) {
    error = (e as Error).message
  }

  return {
    protocol: 'TCP',
    fields,
    rawByteOffset: startOffset,
    rawByteLength: Math.max(0, view.byteLength - startOffset),
    error
  }
}

function decodeUDP(view: DataView, offset: number): ParsedLayer {
  const fields: ParsedField[] = []
  let error: string | undefined
  const startOffset = offset

  try {
    if (view.byteLength < offset + 8) throw new Error('UDP header truncated')
    fields.push(field('srcPort', 'Source Port', view.getUint16(offset), offset, 2))
    fields.push(field('dstPort', 'Destination Port', view.getUint16(offset + 2), offset + 2, 2))
    fields.push(field('length', 'Length', view.getUint16(offset + 4), offset + 4, 2))
    fields.push(
      field(
        'checksum',
        'Checksum',
        `0x${view
          .getUint16(offset + 6)
          .toString(16)
          .padStart(4, '0')}`,
        offset + 6,
        2
      )
    )
  } catch (e) {
    error = (e as Error).message
  }

  return {
    protocol: 'UDP',
    fields,
    rawByteOffset: startOffset,
    rawByteLength: Math.max(0, view.byteLength - startOffset),
    ...(error ? { error } : {})
  }
}

function decodeICMP(view: DataView, offset: number): ParsedLayer {
  const fields: ParsedField[] = []
  let error: string | undefined
  const startOffset = offset

  try {
    if (view.byteLength < offset + 4) throw new Error('ICMP header truncated')
    fields.push(field('type', 'Type', view.getUint8(offset), offset, 1))
    fields.push(field('code', 'Code', view.getUint8(offset + 1), offset + 1, 1))
    fields.push(
      field(
        'checksum',
        'Checksum',
        `0x${view
          .getUint16(offset + 2)
          .toString(16)
          .padStart(4, '0')}`,
        offset + 2,
        2
      )
    )
  } catch (e) {
    error = (e as Error).message
  }

  return {
    protocol: 'ICMP',
    fields,
    rawByteOffset: startOffset,
    rawByteLength: Math.max(0, view.byteLength - startOffset),
    ...(error ? { error } : {})
  }
}

function decodeDNSName(
  view: DataView,
  offset: number,
  packetStart: number
): { name: string; bytesRead: number } {
  const labels: string[] = []
  let pos = offset
  let jumped = false
  let bytesRead = 0
  const maxIterations = 128

  for (let i = 0; i < maxIterations; i++) {
    if (pos >= view.byteLength) break
    const len = view.getUint8(pos)
    if (len === 0) {
      if (!jumped) bytesRead = pos - offset + 1
      break
    }
    // Pointer compression
    if ((len & 0xc0) === 0xc0) {
      if (pos + 1 >= view.byteLength) break
      if (!jumped) bytesRead = pos - offset + 2
      const ptr = ((len & 0x3f) << 8) | view.getUint8(pos + 1)
      pos = packetStart + ptr
      jumped = true
      continue
    }
    pos++
    if (pos + len > view.byteLength) break
    const label = Array.from({ length: len }, (_, j) =>
      String.fromCharCode(view.getUint8(pos + j))
    ).join('')
    labels.push(label)
    pos += len
  }

  return { name: labels.join('.') || '.', bytesRead: bytesRead || pos - offset }
}

function decodeDNS(view: DataView, offset: number): ParsedLayer {
  const fields: ParsedField[] = []
  let error: string | undefined
  const startOffset = offset

  try {
    if (view.byteLength < offset + 12) throw new Error('DNS header truncated')
    const id = view.getUint16(offset)
    fields.push(field('id', 'Transaction ID', `0x${id.toString(16).padStart(4, '0')}`, offset, 2))
    const flags = view.getUint16(offset + 2)
    const qr = (flags >> 15) & 1
    fields.push(field('flags', 'Flags', qr === 0 ? 'Query' : 'Response', offset + 2, 2))
    const qdCount = view.getUint16(offset + 4)
    fields.push(field('qdCount', 'Question Count', qdCount, offset + 4, 2))
    const anCount = view.getUint16(offset + 6)
    fields.push(field('anCount', 'Answer Count', anCount, offset + 6, 2))

    // Decode first question name and type
    if (qdCount > 0 && view.byteLength > offset + 12) {
      const { name, bytesRead } = decodeDNSName(view, offset + 12, offset)
      fields.push(field('queryName', 'Query Name', name, offset + 12, bytesRead))
      const typeOffset = offset + 12 + bytesRead
      if (typeOffset + 2 <= view.byteLength) {
        const qtype = view.getUint16(typeOffset)
        const typeNames: Record<number, string> = {
          1: 'A',
          2: 'NS',
          5: 'CNAME',
          6: 'SOA',
          12: 'PTR',
          15: 'MX',
          16: 'TXT',
          28: 'AAAA'
        }
        fields.push(
          field('queryType', 'Record Type', typeNames[qtype] ?? String(qtype), typeOffset, 2)
        )
      }
    }
  } catch (e) {
    error = (e as Error).message
  }

  return {
    protocol: 'DNS',
    fields,
    rawByteOffset: startOffset,
    rawByteLength: Math.max(0, view.byteLength - startOffset),
    ...(error ? { error } : {})
  }
}

function decodeARP(view: DataView, offset: number): ParsedLayer {
  const fields: ParsedField[] = []
  let error: string | undefined
  const startOffset = offset

  try {
    if (view.byteLength < offset + 28) throw new Error('ARP header truncated')
    fields.push(field('hwType', 'Hardware Type', view.getUint16(offset), offset, 2))
    fields.push(
      field(
        'protoType',
        'Protocol Type',
        `0x${view
          .getUint16(offset + 2)
          .toString(16)
          .padStart(4, '0')}`,
        offset + 2,
        2
      )
    )
    const operation = view.getUint16(offset + 6)
    fields.push(
      field(
        'operation',
        'Operation',
        operation === 1 ? 'Request' : operation === 2 ? 'Reply' : String(operation),
        offset + 6,
        2
      )
    )
    fields.push(field('senderMAC', 'Sender MAC', macToString(view, offset + 8), offset + 8, 6))
    fields.push(field('senderIP', 'Sender IP', ipv4ToString(view, offset + 14), offset + 14, 4))
    fields.push(field('targetMAC', 'Target MAC', macToString(view, offset + 18), offset + 18, 6))
    fields.push(field('targetIP', 'Target IP', ipv4ToString(view, offset + 24), offset + 24, 4))
  } catch (e) {
    error = (e as Error).message
  }

  return {
    protocol: 'ARP',
    fields,
    rawByteOffset: startOffset,
    rawByteLength: 28,
    ...(error ? { error } : {})
  }
}

// ─── Transport layer dispatcher ───────────────────────────────────────────────

function decodeTransport(view: DataView, offset: number, ipProtocol: number): ParsedLayer | null {
  if (ipProtocol === 17) {
    return decodeUDP(view, offset)
  }
  if (ipProtocol === 6) return decodeTCP(view, offset)
  if (ipProtocol === 1 || ipProtocol === 58) return decodeICMP(view, offset) // 58 = ICMPv6
  return null
}

// ─── Parser ───────────────────────────────────────────────────────────────────

export const Parser = {
  parse(raw: RawPacket): ParsedPacket {
    const layers: ParsedLayer[] = []
    const buf = Buffer.isBuffer(raw.data) ? raw.data : Buffer.from(raw.data)
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)

    if (raw.linkType !== 1) {
      // Non-Ethernet link type — single OTHER layer
      layers.push({
        protocol: 'OTHER',
        fields: [],
        rawByteOffset: 0,
        rawByteLength: buf.byteLength
      })
      return {
        id: randomUUID(),
        timestamp: raw.timestamp,
        sourceId: raw.sourceId,
        captureMode: raw.captureMode,
        wireLength: raw.length,
        layers,
        rawData: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength).slice()
      }
    }

    // ── Ethernet ──
    let etherType = 0
    let offset = 0
    try {
      const eth = decodeEthernet(view, 0)
      const ethLayer = eth.layer
      layers.push(ethLayer)
      offset = eth.nextOffset
      etherType = eth.etherType
    } catch (e) {
      layers.push({
        protocol: 'OTHER',
        fields: [],
        rawByteOffset: 0,
        rawByteLength: buf.byteLength,
        error: (e as Error).message
      })
      return buildPacket(raw, layers, buf)
    }

    // ── Network layer ──
    let ipProtocol = 0
    if (etherType === 0x0800) {
      // IPv4
      try {
        const ip = decodeIPv4(view, offset)
        layers.push(ip.layer)
        offset = ip.nextOffset
        ipProtocol = ip.protocol
      } catch (e) {
        layers.push({
          protocol: 'IPv4',
          fields: [],
          rawByteOffset: offset,
          rawByteLength: Math.max(0, buf.byteLength - offset),
          error: (e as Error).message
        })
        return buildPacket(raw, layers, buf)
      }
    } else if (etherType === 0x86dd) {
      // IPv6
      try {
        const ip = decodeIPv6(view, offset)
        layers.push(ip.layer)
        offset = ip.nextOffset
        ipProtocol = ip.protocol
      } catch (e) {
        layers.push({
          protocol: 'IPv6',
          fields: [],
          rawByteOffset: offset,
          rawByteLength: Math.max(0, buf.byteLength - offset),
          error: (e as Error).message
        })
        return buildPacket(raw, layers, buf)
      }
    } else if (etherType === 0x0806) {
      // ARP
      try {
        layers.push(decodeARP(view, offset))
      } catch (e) {
        layers.push({
          protocol: 'ARP',
          fields: [],
          rawByteOffset: offset,
          rawByteLength: Math.max(0, buf.byteLength - offset),
          error: (e as Error).message
        })
      }
      return buildPacket(raw, layers, buf)
    } else {
      // Unknown EtherType
      layers.push({
        protocol: 'OTHER',
        fields: [],
        rawByteOffset: offset,
        rawByteLength: Math.max(0, buf.byteLength - offset)
      })
      return buildPacket(raw, layers, buf)
    }

    // ── Transport layer ──
    if (offset >= buf.byteLength) return buildPacket(raw, layers, buf)

    try {
      const transport = decodeTransport(view, offset, ipProtocol)
      if (transport) {
        layers.push(transport)
        // DNS over UDP: add DNS layer after UDP
        if (transport.protocol === 'UDP') {
          const srcPort = transport.fields.find((f) => f.name === 'srcPort')?.value as number
          const dstPort = transport.fields.find((f) => f.name === 'dstPort')?.value as number
          if (srcPort === 53 || dstPort === 53) {
            const udpHeaderEnd = offset + 8
            if (udpHeaderEnd < buf.byteLength) {
              layers.push(decodeDNS(view, udpHeaderEnd))
            }
          }
        }
      } else {
        // Unknown IP protocol
        layers.push({
          protocol: 'OTHER',
          fields: [],
          rawByteOffset: offset,
          rawByteLength: Math.max(0, buf.byteLength - offset)
        })
      }
    } catch (e) {
      layers.push({
        protocol: 'OTHER',
        fields: [],
        rawByteOffset: offset,
        rawByteLength: Math.max(0, buf.byteLength - offset),
        error: (e as Error).message
      })
    }

    return buildPacket(raw, layers, buf)
  },

  /**
   * Pretty_Printer — produces a valid libpcap record:
   *   16-byte packet header (little-endian) + raw frame bytes
   *
   * Header layout:
   *   ts_sec   (4 bytes): Math.floor(timestamp / 1000)
   *   ts_usec  (4 bytes): (timestamp % 1000) * 1000
   *   incl_len (4 bytes): actual captured bytes
   *   orig_len (4 bytes): original wire length
   */
  print(packet: ParsedPacket): Buffer {
    const rawData = packet.rawData ? Buffer.from(packet.rawData) : Buffer.alloc(0)

    const inclLen = rawData.length
    const origLen = packet.wireLength

    const header = Buffer.allocUnsafe(16)
    const tsSec = Math.floor(packet.timestamp / 1000)
    const tsUsec = (packet.timestamp % 1000) * 1000

    header.writeUInt32LE(tsSec, 0)
    header.writeUInt32LE(tsUsec, 4)
    header.writeUInt32LE(inclLen, 8)
    header.writeUInt32LE(origLen, 12)

    return Buffer.concat([header, rawData])
  }
}

function buildPacket(raw: RawPacket, layers: ParsedLayer[], buf: Buffer): ParsedPacket {
  return {
    id: randomUUID(),
    timestamp: raw.timestamp,
    sourceId: raw.sourceId,
    captureMode: raw.captureMode,
    wireLength: raw.length,
    layers,
    rawData: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength).slice()
  }
}
