import type { AnonPacket, ParsedField, ProtocolName } from '../../../shared/capture-types'

export type PacketRole =
  | 'SYN'
  | 'SYN-ACK'
  | 'ACK'
  | 'FIN'
  | 'FIN-ACK'
  | 'RST'
  | 'DATA'
  | 'QUERY'
  | 'RESPONSE'
  | 'PING'
  | 'REPLY'
  | 'UNREACHABLE'
  | 'TTL EXCEEDED'
  | 'WHO HAS'
  | 'IS AT'
  | 'UDP DATA'
  | 'UNCLASSIFIED'

export interface PacketRoleInfo {
  role: PacketRole
  tableLabel: string
  title: string
  description: string
}

export interface PacketSummary {
  title: string
  summary: string
  whyItMatters: string
  whatToInspectNext: string[]
  priorityFields: string[]
}

function fieldValue(
  packet: AnonPacket,
  layerProtocol: string,
  names: string[]
): string | number | undefined {
  const layer = packet.layers.find((l) => l.protocol === layerProtocol)
  if (!layer) return undefined
  const field = layer.fields.find(
    (f) => names.includes(f.name.toLowerCase()) || names.includes(f.label.toLowerCase())
  )
  return field?.value
}

function allFieldText(packet: AnonPacket, layerProtocol: string): string {
  const layer = packet.layers.find((l) => l.protocol === layerProtocol)
  if (!layer) return ''
  return layer.fields
    .map((field) => String(field.value))
    .join(' ')
    .toLowerCase()
}

function hasPayload(packet: AnonPacket): boolean {
  const headerBytes = packet.layers.reduce((sum, layer) => sum + layer.rawByteLength, 0)
  return packet.wireLength > headerBytes
}

export function formatRelativeTimestamp(timestamp: number, startMs: number): string {
  const seconds = Math.max(0, (timestamp - startMs) / 1000)
  return `+${seconds.toFixed(3)}s`
}

export function classifyPacketRole(packet: AnonPacket): PacketRole | null {
  if (packet.protocol === 'TCP') {
    const flags = allFieldText(packet, 'TCP')
    if (flags.includes('rst')) return 'RST'
    if (flags.includes('syn') && flags.includes('ack')) return 'SYN-ACK'
    if (flags.includes('syn')) return 'SYN'
    if (flags.includes('fin') && flags.includes('ack')) return 'FIN-ACK'
    if (flags.includes('fin')) return 'FIN'
    if (flags.includes('ack') && !hasPayload(packet)) return 'ACK'
    return 'DATA'
  }

  if (packet.protocol === 'DNS') {
    const flags = allFieldText(packet, 'DNS')
    if (flags.includes('response') || flags.includes('answer')) return 'RESPONSE'
    return 'QUERY'
  }

  if (packet.protocol === 'ICMP') {
    const type = fieldValue(packet, 'ICMP', ['type'])
    if (type === 0 || type === '0') return 'REPLY'
    if (type === 3 || type === '3') return 'UNREACHABLE'
    if (type === 8 || type === '8') return 'PING'
    if (type === 11 || type === '11') return 'TTL EXCEEDED'
  }

  if (packet.protocol === 'ARP') {
    const text = allFieldText(packet, 'ARP')
    if (text.includes('reply') || text.includes('is at') || text.includes('operation 2'))
      return 'IS AT'
    return 'WHO HAS'
  }

  if (packet.protocol === 'UDP') return 'UDP DATA'
  if (packet.protocol === 'OTHER') return 'UNCLASSIFIED'

  return null
}

export function getPacketRoleInfo(packet: AnonPacket): PacketRoleInfo {
  const role = classifyPacketRole(packet) ?? 'UNCLASSIFIED'
  const byRole: Record<PacketRole, Omit<PacketRoleInfo, 'role'>> = {
    SYN: {
      tableLabel: 'Conn start',
      title: 'TCP SYN',
      description: 'Connection start. A device is asking to open a TCP connection.'
    },
    'SYN-ACK': {
      tableLabel: 'Server reply',
      title: 'TCP SYN-ACK',
      description:
        'Server response. The destination acknowledges the request and agrees to open the connection.'
    },
    ACK: {
      tableLabel: 'Ack',
      title: 'TCP ACK',
      description:
        'Acknowledgement. The sender confirms it received earlier TCP data or setup messages.'
    },
    FIN: {
      tableLabel: 'Closing',
      title: 'TCP FIN',
      description: 'Connection closing. The sender has finished sending data.'
    },
    'FIN-ACK': {
      tableLabel: 'Close + ack',
      title: 'TCP FIN-ACK',
      description:
        'Closing plus acknowledgement. The sender is closing while confirming earlier data.'
    },
    RST: {
      tableLabel: 'Reset',
      title: 'TCP RST',
      description:
        'Connection reset. TCP is ending the conversation abruptly instead of closing gracefully.'
    },
    DATA: {
      tableLabel: 'TCP data',
      title: 'TCP data',
      description: 'Application data is likely moving inside an already-open TCP connection.'
    },
    QUERY: {
      tableLabel: 'Name lookup',
      title: 'DNS query',
      description: 'Name lookup. A device is asking for information about a domain name.'
    },
    RESPONSE: {
      tableLabel: 'Name resolved',
      title: 'DNS response',
      description: 'Name resolved. A DNS server is answering a previous lookup.'
    },
    PING: {
      tableLabel: 'Ping request',
      title: 'ICMP echo request',
      description: 'Ping request. A device is checking whether another endpoint can be reached.'
    },
    REPLY: {
      tableLabel: 'Ping reply',
      title: 'ICMP echo reply',
      description: 'Ping reply. The destination answered an earlier reachability check.'
    },
    UNREACHABLE: {
      tableLabel: 'Unreachable',
      title: 'ICMP unreachable',
      description: 'Diagnostic message. A packet could not be delivered to its destination.'
    },
    'TTL EXCEEDED': {
      tableLabel: 'TTL expired',
      title: 'ICMP TTL exceeded',
      description:
        'Diagnostic message. A packet ran out of router hops before reaching its destination.'
    },
    'WHO HAS': {
      tableLabel: 'Addr lookup',
      title: 'ARP request',
      description:
        'Local address lookup. A device is asking who owns an address on the local network.'
    },
    'IS AT': {
      tableLabel: 'Addr reply',
      title: 'ARP reply',
      description:
        'Local address response. A device is answering with the matching local hardware address.'
    },
    'UDP DATA': {
      tableLabel: 'UDP data',
      title: 'UDP data',
      description:
        'Connectionless UDP traffic. This may be DNS, discovery, streaming, or another lightweight exchange.'
    },
    UNCLASSIFIED: {
      tableLabel: 'Unclassified',
      title: 'Unclassified packet',
      description:
        'NetVis decoded the packet enough to show it, but no specific beginner role matched it.'
    }
  }

  return { role, ...byRole[role] }
}

export function summarizePacket(packet: AnonPacket): PacketSummary {
  const roleInfo = getPacketRoleInfo(packet)

  if (packet.protocol === 'TCP') {
    const dstPort = fieldValue(packet, 'TCP', ['dst port', 'destination port', 'dstport'])
    const baseNext = [
      'Follow packets with the same source, destination, and ports to see this TCP conversation.'
    ]
    if (roleInfo.role === 'SYN') {
      baseNext.unshift('Look for a SYN-ACK packet coming back from the destination.')
    } else if (roleInfo.role === 'FIN' || roleInfo.role === 'FIN-ACK') {
      baseNext.unshift(
        'Look for the matching ACK or FIN from the other side of the close sequence.'
      )
    } else if (roleInfo.role === 'RST') {
      baseNext.unshift('Check whether a connection ended suddenly and which side sent the reset.')
    }
    return {
      title: roleInfo.title,
      summary: `${roleInfo.description} It travels from ${packet.srcAddress} to ${packet.dstAddress}${dstPort ? ` on port ${dstPort}` : ''}.`,
      whyItMatters:
        'TCP packets show the lifecycle of a reliable connection: setup, acknowledgement, data transfer, and close.',
      whatToInspectNext: baseNext,
      priorityFields: [
        'dst port',
        'destination port',
        'src port',
        'source port',
        'flags',
        'seq',
        'ack'
      ]
    }
  }

  if (packet.protocol === 'DNS') {
    return {
      title: roleInfo.title,
      summary: `${roleInfo.description} It moves between ${packet.srcAddress} and ${packet.dstAddress}.`,
      whyItMatters:
        'DNS explains how a name lookup happens before many application connections can begin.',
      whatToInspectNext:
        roleInfo.role === 'QUERY'
          ? [
              'Find the DNS response with the same transaction ID.',
              'Check the query name to see what was being resolved.'
            ]
          : [
              'Compare this response with the earlier DNS query.',
              'Look at the answer count and record type.'
            ],
      priorityFields: ['transaction id', 'id', 'flags', 'query name', 'record type', 'answer count']
    }
  }

  if (packet.protocol === 'ICMP') {
    return {
      title: roleInfo.title,
      summary: `${roleInfo.description} It travels from ${packet.srcAddress} to ${packet.dstAddress}.`,
      whyItMatters:
        'ICMP packets are network diagnostic messages. They often explain reachability, ping replies, or delivery problems.',
      whatToInspectNext:
        roleInfo.role === 'PING'
          ? [
              'Look for an ICMP echo reply returning from the destination.',
              'Compare timestamps to estimate round trip timing.'
            ]
          : ['Inspect the ICMP type and code to learn what diagnostic message was sent.'],
      priorityFields: ['type', 'code', 'checksum', 'identifier', 'sequence']
    }
  }

  if (packet.protocol === 'ARP') {
    return {
      title: roleInfo.title,
      summary: `${roleInfo.description} It stays on the local network rather than crossing routers.`,
      whyItMatters:
        'ARP connects network-layer addresses to local hardware delivery, which is why devices can talk on the same LAN.',
      whatToInspectNext:
        roleInfo.role === 'WHO HAS'
          ? ['Look for an ARP reply that answers the same target address.']
          : ['Compare this reply with the earlier ARP request.'],
      priorityFields: ['operation', 'sender ip', 'target ip', 'sender mac', 'target mac']
    }
  }

  if (packet.protocol === 'UDP') {
    return {
      title: roleInfo.title,
      summary: `${roleInfo.description} It travels from ${packet.srcAddress} to ${packet.dstAddress}.`,
      whyItMatters:
        'UDP carries lightweight messages without a TCP handshake. DNS, discovery, voice, and streaming protocols often use it.',
      whatToInspectNext: [
        'Check the source and destination ports to infer the application or service.',
        'If port 53 is present, look for a decoded DNS layer.'
      ],
      priorityFields: [
        'dst port',
        'destination port',
        'src port',
        'source port',
        'length',
        'checksum'
      ]
    }
  }

  return {
    title: roleInfo.title,
    summary: `${roleInfo.description} It travels from ${packet.srcAddress} to ${packet.dstAddress}.`,
    whyItMatters:
      'Unclassified packets still preserve timing, size, and endpoint relationships, which can help explain the capture.',
    whatToInspectNext: ['Open each decoded layer and look for protocol or type fields.'],
    priorityFields: ['protocol', 'length', 'type']
  }
}

function normalizedFieldName(field: ParsedField): string {
  return `${field.name} ${field.label}`.toLowerCase()
}

export function sortFieldsByPriority(
  fields: ParsedField[],
  priorityFields: string[]
): ParsedField[] {
  const priorities = priorityFields.map((field) => field.toLowerCase())
  return [...fields].sort((a, b) => {
    const aPriority = priorities.findIndex((priority) => normalizedFieldName(a).includes(priority))
    const bPriority = priorities.findIndex((priority) => normalizedFieldName(b).includes(priority))
    if (aPriority === -1 && bPriority === -1) return 0
    if (aPriority === -1) return 1
    if (bPriority === -1) return -1
    return aPriority - bPriority
  })
}

export interface ConversationMatch {
  packets: AnonPacket[]
  complete: boolean
  reason?: string
}

export function findConversation(packets: AnonPacket[], seedPacket: AnonPacket): ConversationMatch {
  if (seedPacket.protocol === 'TCP') {
    const related = packets.filter(
      (packet) =>
        packet.protocol === 'TCP' &&
        ((packet.srcAddress === seedPacket.srcAddress &&
          packet.dstAddress === seedPacket.dstAddress) ||
          (packet.srcAddress === seedPacket.dstAddress &&
            packet.dstAddress === seedPacket.srcAddress))
    )
    const roles = new Set(related.map(classifyPacketRole))
    const complete = roles.has('SYN') && roles.has('SYN-ACK') && roles.has('ACK')
    return {
      packets: related,
      complete,
      reason: complete ? undefined : 'handshake not in capture window'
    }
  }

  const related = packets.filter(
    (packet) =>
      packet.protocol === seedPacket.protocol &&
      ((packet.srcAddress === seedPacket.srcAddress &&
        packet.dstAddress === seedPacket.dstAddress) ||
        (packet.srcAddress === seedPacket.dstAddress &&
          packet.dstAddress === seedPacket.srcAddress))
  )

  return {
    packets: related,
    complete: related.length > 1,
    reason: related.length > 1 ? undefined : 'matching packet not captured'
  }
}

export interface CaptureSummary {
  totalPackets: number
  durationLabel: string
  dominantProtocol: ProtocolName | 'none'
  dominantProtocolShare: number
  topConversationLabel: string
  dnsActivity: string
  tcpLifecycle: string
  burstSummary: string
  story: string
}

function protocolCounts(packets: AnonPacket[]): Map<ProtocolName, number> {
  const counts = new Map<ProtocolName, number>()
  for (const packet of packets) {
    counts.set(packet.protocol, (counts.get(packet.protocol) ?? 0) + 1)
  }
  return counts
}

function dominantProtocol(packets: AnonPacket[]): {
  protocol: ProtocolName | 'none'
  count: number
} {
  let protocol: ProtocolName | 'none' = 'none'
  let count = 0
  for (const [candidate, candidateCount] of protocolCounts(packets)) {
    if (candidateCount > count) {
      protocol = candidate
      count = candidateCount
    }
  }
  return { protocol, count }
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0.000s'
  if (ms < 10_000) return `${(ms / 1000).toFixed(3)}s`
  return `${(ms / 1000).toFixed(1)}s`
}

function topConversation(packets: AnonPacket[]): { label: string; count: number } {
  const counts = new Map<string, number>()
  for (const packet of packets) {
    const forward = `${packet.srcAddress} -> ${packet.dstAddress}`
    const reverse = `${packet.dstAddress} -> ${packet.srcAddress}`
    const key = [forward, reverse].sort().join(' | ')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  let label = 'No conversation yet'
  let count = 0
  for (const [candidate, candidateCount] of counts) {
    if (candidateCount > count) {
      label = candidate.replace(' | ', ' <-> ')
      count = candidateCount
    }
  }
  return { label, count }
}

function dnsActivity(packets: AnonPacket[]): string {
  const dnsPackets = packets.filter((packet) => packet.protocol === 'DNS')
  if (dnsPackets.length > 0) {
    const queries = dnsPackets.filter((packet) => classifyPacketRole(packet) === 'QUERY').length
    const responses = dnsPackets.filter(
      (packet) => classifyPacketRole(packet) === 'RESPONSE'
    ).length
    return `${queries} DNS queries and ${responses} DNS responses decoded.`
  }
  const udpPackets = packets.filter((packet) => packet.protocol === 'UDP')
  if (udpPackets.length > 0) {
    return 'UDP traffic is present, but no DNS packets were decoded.'
  }
  return 'No DNS traffic was decoded.'
}

function tcpLifecycle(packets: AnonPacket[]): string {
  const roles = new Set(packets.map(classifyPacketRole))
  const hasStart = roles.has('SYN')
  const hasResponse = roles.has('SYN-ACK')
  const hasClose = roles.has('FIN') || roles.has('FIN-ACK')
  const hasReset = roles.has('RST')

  if (hasStart && hasResponse && hasClose) return 'TCP setup and connection closing were observed.'
  if (hasStart && hasResponse) return 'TCP connection setup was observed.'
  if (hasClose) return 'TCP connection closing was observed.'
  if (hasReset) return 'A TCP reset was observed.'
  return 'No TCP setup or close event was detected.'
}

function burstSummary(packets: AnonPacket[]): string {
  if (packets.length < 3) return 'Not enough packets to identify a timing pattern yet.'
  const first = Math.min(...packets.map((packet) => packet.timestamp))
  const last = Math.max(...packets.map((packet) => packet.timestamp))
  const duration = Math.max(1, last - first)
  const bucketWidth = Math.max(100, Math.ceil(duration / 12))
  const buckets = new Map<number, number>()
  for (const packet of packets) {
    const bucket = Math.floor((packet.timestamp - first) / bucketWidth)
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1)
  }
  const nonEmpty = [...buckets.values()].filter((count) => count > 0)
  const max = Math.max(...nonEmpty)
  const average = packets.length / Math.max(1, buckets.size)

  if (max >= average * 3 && max >= 5) return 'Traffic is concentrated in a short burst.'
  if (nonEmpty.length >= 3 && max >= average * 2) return 'Traffic occurred in separate bursts.'
  if (nonEmpty.length <= 2) return 'Traffic is concentrated in a small time window.'
  return 'Traffic is steady across the capture.'
}

export function buildCaptureSummary(packets: AnonPacket[]): CaptureSummary {
  if (packets.length === 0) {
    return {
      totalPackets: 0,
      durationLabel: '0.000s',
      dominantProtocol: 'none',
      dominantProtocolShare: 0,
      topConversationLabel: 'No conversation yet',
      dnsActivity: 'No DNS traffic was decoded.',
      tcpLifecycle: 'No TCP setup or close event was detected.',
      burstSummary: 'No traffic has been captured yet.',
      story: 'Start or import a capture to generate a beginner-readable summary.'
    }
  }

  const first = Math.min(...packets.map((packet) => packet.timestamp))
  const last = Math.max(...packets.map((packet) => packet.timestamp))
  const dominant = dominantProtocol(packets)
  const share = dominant.count > 0 ? Math.round((dominant.count / packets.length) * 100) : 0
  const top = topConversation(packets)
  const dns = dnsActivity(packets)
  const tcp = tcpLifecycle(packets)
  const burst = burstSummary(packets)

  const story = `This view contains mostly ${dominant.protocol} traffic (${share}%) across ${packets.length.toLocaleString()} packets. Top conversation: ${top.label}. ${dns} ${tcp} ${burst}`

  return {
    totalPackets: packets.length,
    durationLabel: formatDuration(last - first),
    dominantProtocol: dominant.protocol,
    dominantProtocolShare: share,
    topConversationLabel: `${top.label} (${top.count.toLocaleString()} packets)`,
    dnsActivity: dns,
    tcpLifecycle: tcp,
    burstSummary: burst,
    story
  }
}

function formatClock(ms: number): string {
  const date = new Date(ms)
  return `${date.getHours().toString().padStart(2, '0')}:${date
    .getMinutes()
    .toString()
    .padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
}

export function describeFilterExpression(expression: string): string {
  const trimmed = expression.trim()
  if (!trimmed) return 'All packets'

  const proto = /^proto\s*==\s*([a-z0-9]+)$/i.exec(trimmed)
  if (proto) return `Protocol = ${proto[1]!.toUpperCase()}`

  const time = /^ts\s*>=\s*(\d+(?:\.\d+)?)\s+AND\s+ts\s*<\s*(\d+(?:\.\d+)?)$/i.exec(trimmed)
  if (time) {
    const start = Number(time[1])
    const end = Number(time[2])
    return `Time = ${formatClock(start)}-${formatClock(end)}`
  }

  const src = /^src\s*==\s*(.+)$/i.exec(trimmed)
  if (src) return `Source = ${src[1]!.replace(/^"|"$/g, '')}`

  const dst = /^dst\s*==\s*(.+)$/i.exec(trimmed)
  if (dst) return `Destination = ${dst[1]!.replace(/^"|"$/g, '')}`

  const port = /^port\s*==\s*(\d+)$/i.exec(trimmed)
  if (port) return `Port = ${port[1]}`

  return `Custom filter: ${trimmed}`
}
