/**
 * Challenge library for guided educational exercises.
 * Challenges are intentionally lightweight: no points, streaks, or pressure.
 */

import type { AnonPacket } from '../../../shared/capture-types'

export type ChallengeDifficulty = 'beginner' | 'intermediate'
export type ChallengeProtocol = 'TCP' | 'UDP' | 'DNS' | 'ICMP' | 'ARP' | 'OTHER' | 'ANY'

export interface ChallengeCompletionCopy {
  found: string
  meaning: string
}

export interface Challenge {
  id: string
  title: string
  goal: string
  hint: string
  difficulty: ChallengeDifficulty
  protocol: ChallengeProtocol
  estimatedMinutes: number
  lookFor: string[]
  initialFilter: string
  completion: ChallengeCompletionCopy
  listed?: boolean
  successCriteria: (
    packets: AnonPacket[],
    filterExpression?: string,
    selectedPacket?: AnonPacket | null
  ) => boolean
}

function layerField(packet: AnonPacket, protocol: string, fieldNames: string[]): string {
  const layer = packet.layers.find(
    (candidate) => candidate.protocol.toLowerCase() === protocol.toLowerCase()
  )
  if (!layer) return ''

  for (const field of layer.fields) {
    const name = field.name.toLowerCase()
    const label = field.label.toLowerCase()
    if (fieldNames.some((candidate) => name.includes(candidate) || label.includes(candidate))) {
      return String(field.value)
    }
  }

  return ''
}

function packetFlags(packet: AnonPacket): string {
  return layerField(packet, 'TCP', ['flag']).toUpperCase()
}

function packetHasFlag(packet: AnonPacket, flag: string): boolean {
  return packetFlags(packet).includes(flag)
}

function packetPort(packet: AnonPacket, names: string[]): string {
  return layerField(packet, 'TCP', names) || layerField(packet, 'UDP', names)
}

function packetDnsFlags(packet: AnonPacket): string {
  return layerField(packet, 'DNS', ['flag', 'qr', 'response']).toLowerCase()
}

function packetDnsId(packet: AnonPacket): string {
  return layerField(packet, 'DNS', ['transaction', 'id'])
}

function packetIcmpType(packet: AnonPacket): string {
  return layerField(packet, 'ICMP', ['type']).toLowerCase()
}

function packetArpOpcode(packet: AnonPacket): string {
  return layerField(packet, 'ARP', ['opcode', 'operation']).toLowerCase()
}

function tcpConversationKey(packet: AnonPacket): string {
  const srcPort = packetPort(packet, ['src', 'source'])
  const dstPort = packetPort(packet, ['dst', 'dest', 'destination'])
  const forward = `${packet.srcAddress}:${srcPort}->${packet.dstAddress}:${dstPort}`
  const reverse = `${packet.dstAddress}:${dstPort}->${packet.srcAddress}:${srcPort}`
  return [forward, reverse].sort().join('|')
}

function isTcpSyn(packet: AnonPacket): boolean {
  const flags = packetFlags(packet)
  return flags.includes('SYN') && !flags.includes('ACK')
}

function isTcpSynAck(packet: AnonPacket): boolean {
  const flags = packetFlags(packet)
  return flags.includes('SYN') && flags.includes('ACK')
}

function isTcpAckOnly(packet: AnonPacket): boolean {
  const flags = packetFlags(packet)
  return (
    flags.includes('ACK') &&
    !flags.includes('SYN') &&
    !flags.includes('FIN') &&
    !flags.includes('RST')
  )
}

function isDnsQueryPacket(packet: AnonPacket): boolean {
  if (packet.protocol !== 'DNS') return false
  const flags = packetDnsFlags(packet)
  return !flags.includes('response')
}

function isDnsResponsePacket(packet: AnonPacket): boolean {
  if (packet.protocol !== 'DNS') return false
  return packetDnsFlags(packet).includes('response')
}

function isIcmpEchoRequest(packet: AnonPacket): boolean {
  if (packet.protocol !== 'ICMP') return false
  const type = packetIcmpType(packet)
  return type === '8' || type.includes('echo request')
}

function isIcmpEchoReply(packet: AnonPacket): boolean {
  if (packet.protocol !== 'ICMP') return false
  const type = packetIcmpType(packet)
  return type === '0' || type.includes('echo reply')
}

function isArpRequest(packet: AnonPacket): boolean {
  if (packet.protocol !== 'ARP') return false
  const opcode = packetArpOpcode(packet)
  return opcode.includes('request') || opcode.includes('who')
}

function isArpReply(packet: AnonPacket): boolean {
  if (packet.protocol !== 'ARP') return false
  const opcode = packetArpOpcode(packet)
  return opcode.includes('reply') || opcode.includes('is at')
}

function hasTcpHandshake(packets: AnonPacket[]): boolean {
  const tcpPackets = packets.filter((packet) => packet.protocol === 'TCP')

  for (let i = 0; i < tcpPackets.length; i++) {
    const syn = tcpPackets[i]!
    if (!isTcpSyn(syn)) continue

    for (let j = i + 1; j < tcpPackets.length; j++) {
      const synAck = tcpPackets[j]!
      if (!isTcpSynAck(synAck)) continue
      if (synAck.srcAddress !== syn.dstAddress || synAck.dstAddress !== syn.srcAddress) continue

      for (let k = j + 1; k < tcpPackets.length; k++) {
        const ack = tcpPackets[k]!
        if (!isTcpAckOnly(ack)) continue
        if (ack.srcAddress === syn.srcAddress && ack.dstAddress === syn.dstAddress) return true
      }
    }
  }

  return false
}

function hasDnsQueryResponse(packets: AnonPacket[]): boolean {
  const queries = packets.filter(isDnsQueryPacket)
  const responses = packets.filter(isDnsResponsePacket)

  if (queries.length === 0 || responses.length === 0) return false

  return queries.some((query) => {
    const queryId = packetDnsId(query)
    return responses.some((response) => {
      const responseId = packetDnsId(response)
      const reversed =
        query.srcAddress === response.dstAddress && query.dstAddress === response.srcAddress
      return reversed && (!queryId || !responseId || queryId === responseId)
    })
  })
}

function hasIcmpEchoPair(packets: AnonPacket[]): boolean {
  return packets.some(isIcmpEchoRequest) && packets.some(isIcmpEchoReply)
}

function hasArpRequestReply(packets: AnonPacket[]): boolean {
  return packets.some(isArpRequest) && packets.some(isArpReply)
}

function hasTcpConnectionWithFin(packets: AnonPacket[]): boolean {
  const byConversation = new Map<string, AnonPacket[]>()
  for (const packet of packets) {
    if (packet.protocol !== 'TCP') continue
    const key = tcpConversationKey(packet)
    byConversation.set(key, [...(byConversation.get(key) ?? []), packet])
  }

  for (const conversation of byConversation.values()) {
    const hasSyn = conversation.some(isTcpSyn)
    const hasFin = conversation.some((packet) => packetHasFlag(packet, 'FIN'))
    if (hasSyn && hasFin) return true
  }

  return false
}

function hasRetransmission(packets: AnonPacket[]): boolean {
  const seen = new Set<string>()

  for (const packet of packets) {
    if (packet.protocol !== 'TCP') continue
    const sequence = layerField(packet, 'TCP', ['seq'])
    if (!sequence) continue

    const key = `${packet.srcAddress}->${packet.dstAddress}:${packetPort(packet, ['src', 'source'])}:${packetPort(packet, ['dst', 'dest', 'destination'])}:${sequence}`
    if (seen.has(key)) return true
    seen.add(key)
  }

  return false
}

function hasThreeProtocolsWithLengthVariation(packets: AnonPacket[]): boolean {
  const protocolLengths = new Map<string, Set<number>>()

  for (const packet of packets) {
    if (!protocolLengths.has(packet.protocol)) {
      protocolLengths.set(packet.protocol, new Set())
    }
    protocolLengths.get(packet.protocol)!.add(packet.length)
  }

  if (protocolLengths.size < 3) return false

  let protocolsWithVariation = 0
  for (const lengths of protocolLengths.values()) {
    if (lengths.size >= 2) protocolsWithVariation++
  }

  return protocolsWithVariation >= 2
}

function hasProtocolFilter(filterExpression?: string): boolean {
  const normalized = (filterExpression ?? '').toLowerCase()
  return (
    normalized.includes('proto') ||
    ['tcp', 'udp', 'dns', 'icmp', 'arp'].some((proto) => normalized === proto)
  )
}

function hasPortFilter(filterExpression?: string): boolean {
  return (filterExpression ?? '').toLowerCase().includes('port')
}

export const CHALLENGES: Challenge[] = [
  {
    id: 'first-capture',
    title: 'start your first capture',
    goal: 'Start a capture and collect at least one packet.',
    hint: 'Click start capture, then open a website or another app that uses the network.',
    difficulty: 'beginner',
    protocol: 'ANY',
    estimatedMinutes: 2,
    lookFor: ['packets appearing in the list', 'live status dot', 'packet count increasing'],
    initialFilter: '',
    completion: {
      found: 'you captured your first packet.',
      meaning: 'NetVis is now showing real traffic from your machine.'
    },
    successCriteria: (packets) => packets.length > 0
  },
  {
    id: 'dns-query',
    title: 'find a dns query',
    goal: 'Spot a DNS packet that asks for a domain name.',
    hint: 'Look for the DNS badge, then look for a QUERY role badge in the packet list.',
    difficulty: 'beginner',
    protocol: 'DNS',
    estimatedMinutes: 2,
    lookFor: ['DNS badge', 'QUERY role badge', 'destination DNS server'],
    initialFilter: 'proto == DNS',
    completion: {
      found: 'you identified a DNS QUERY packet.',
      meaning: 'your computer asked a DNS server to translate a domain name into an IP address.'
    },
    successCriteria: (packets, _filter, selectedPacket) =>
      selectedPacket ? isDnsQueryPacket(selectedPacket) : packets.some(isDnsQueryPacket)
  },
  {
    id: 'tcp-handshake',
    title: 'find a tcp handshake',
    goal: 'Identify a TCP three-way handshake: SYN, SYN-ACK, then ACK.',
    hint: 'Look for three TCP packets between the same endpoints. The middle packet should reverse source and destination.',
    difficulty: 'beginner',
    protocol: 'TCP',
    estimatedMinutes: 3,
    lookFor: ['SYN role badge', 'SYN-ACK role badge', 'ACK role badge'],
    initialFilter: 'proto == TCP',
    completion: {
      found: 'you found a TCP handshake.',
      meaning: 'the client and server agreed that a reliable connection could begin.'
    },
    successCriteria: hasTcpHandshake
  },
  {
    id: 'icmp-echo-pair',
    title: 'identify a ping',
    goal: 'Find an ICMP echo request and echo reply pair.',
    hint: 'Look for ICMP packets with PING and REPLY role badges close together.',
    difficulty: 'beginner',
    protocol: 'ICMP',
    estimatedMinutes: 2,
    lookFor: ['ICMP badge', 'PING role badge', 'REPLY role badge'],
    initialFilter: 'proto == ICMP',
    completion: {
      found: 'you found an ICMP ping round trip.',
      meaning: 'one packet checked reachability and the reply confirmed the destination answered.'
    },
    successCriteria: hasIcmpEchoPair
  },
  {
    id: 'filter-one-protocol',
    title: 'use a filter to isolate one protocol',
    goal: 'Use the filter bar or protocol chart to focus on one protocol.',
    hint: 'Click a protocol row in the chart or type a filter like proto == DNS.',
    difficulty: 'beginner',
    protocol: 'ANY',
    estimatedMinutes: 2,
    lookFor: ['filter text', 'dimmed non-matching rows', 'one protocol emphasized'],
    initialFilter: 'proto == DNS',
    completion: {
      found: 'you filtered the capture to one protocol.',
      meaning: 'filters help you study busy traffic without losing the larger capture context.'
    },
    successCriteria: (packets, filterExpression) =>
      packets.length > 0 && hasProtocolFilter(filterExpression)
  },
  {
    id: 'largest-packet',
    title: 'find the largest packet',
    goal: 'Select the largest packet currently in the capture.',
    hint: 'Sort with your eyes for the largest length value, then select that row.',
    difficulty: 'beginner',
    protocol: 'ANY',
    estimatedMinutes: 2,
    lookFor: ['length column', 'largest byte value', 'selected row'],
    initialFilter: '',
    completion: {
      found: 'you selected the largest packet in the current capture.',
      meaning: 'large packets often carry more payload data than setup or control packets.'
    },
    successCriteria: (packets, _filter, selectedPacket) => {
      if (!selectedPacket || packets.length === 0) return false
      const largest = Math.max(...packets.map((packet) => packet.length))
      return selectedPacket.length === largest
    }
  },
  {
    id: 'dns-query-response',
    title: 'identify a complete dns transaction',
    goal: 'Find a DNS query and the response that belongs to it.',
    hint: 'Use DNS filtering. Matching query and response packets usually reverse source and destination and share a transaction ID.',
    difficulty: 'intermediate',
    protocol: 'DNS',
    estimatedMinutes: 4,
    lookFor: ['QUERY role badge', 'RESPONSE role badge', 'matching transaction ID'],
    initialFilter: 'proto == DNS',
    completion: {
      found: 'you identified a DNS query and response pair.',
      meaning:
        'the resolver answered the name lookup, so the next connection can use the returned address.'
    },
    successCriteria: hasDnsQueryResponse
  },
  {
    id: 'trace-tcp-connection',
    title: 'trace a tcp connection',
    goal: 'Follow a TCP connection from SYN through connection close.',
    hint: 'Filter to TCP and look for the same endpoints from SYN to FIN.',
    difficulty: 'intermediate',
    protocol: 'TCP',
    estimatedMinutes: 5,
    lookFor: ['SYN', 'data packets', 'FIN or FIN-ACK'],
    initialFilter: 'proto == TCP',
    completion: {
      found: 'you traced a TCP connection from start to close.',
      meaning: 'TCP conversations have a lifecycle: open, exchange data, then close.'
    },
    successCriteria: hasTcpConnectionWithFin
  },
  {
    id: 'arp-request-reply',
    title: 'find an arp request and reply',
    goal: 'Find an ARP request and the ARP reply that answers it.',
    hint: 'Look for WHO HAS followed by IS AT on your local network.',
    difficulty: 'intermediate',
    protocol: 'ARP',
    estimatedMinutes: 4,
    lookFor: ['WHO HAS role badge', 'IS AT role badge', 'same target address'],
    initialFilter: 'proto == ARP',
    completion: {
      found: 'you found an ARP request and reply.',
      meaning: 'a device asked for a local hardware address and another device answered.'
    },
    successCriteria: hasArpRequestReply
  },
  {
    id: 'compare-packet-lengths',
    title: 'compare packet sizes',
    goal: 'Compare packet lengths across at least three protocols.',
    hint: 'Use the length column and protocol chart. Control packets are often small; data packets are usually larger.',
    difficulty: 'intermediate',
    protocol: 'ANY',
    estimatedMinutes: 4,
    lookFor: ['three protocols', 'different length values', 'largest packet'],
    initialFilter: '',
    completion: {
      found: 'you compared packet sizes across protocols.',
      meaning:
        'packet size gives a quick clue about whether traffic is setup, control, or data-heavy.'
    },
    successCriteria: hasThreeProtocolsWithLengthVariation
  },
  {
    id: 'spot-retransmission',
    title: 'spot a retransmission',
    goal: 'Find repeated TCP sequence numbers in the same conversation.',
    hint: 'A retransmission often repeats the same sequence number when a segment needs to be sent again.',
    difficulty: 'intermediate',
    protocol: 'TCP',
    estimatedMinutes: 5,
    lookFor: ['TCP badge', 'same sequence number', 'same endpoints'],
    initialFilter: 'proto == TCP',
    completion: {
      found: 'you spotted a repeated TCP sequence number.',
      meaning: 'the sender appears to have sent the same part of the byte stream again.'
    },
    successCriteria: hasRetransmission
  },
  {
    id: 'filter-by-port',
    title: 'filter traffic by port',
    goal: 'Use the filter bar to show only traffic on a specific port.',
    hint: 'Type a filter expression like port == 80 or port == 443.',
    difficulty: 'intermediate',
    protocol: 'ANY',
    estimatedMinutes: 3,
    lookFor: ['port filter', 'matching rows', 'service port'],
    initialFilter: 'port == 443',
    listed: false,
    completion: {
      found: 'you filtered packets by port.',
      meaning: 'ports identify the service or temporary application slot involved in a packet.'
    },
    successCriteria: (packets, filterExpression) =>
      packets.length > 0 && hasPortFilter(filterExpression)
  }
]

export function getChallengeById(id: string): Challenge | undefined {
  return CHALLENGES.find((challenge) => challenge.id === id)
}

export function getListedChallenges(): Challenge[] {
  return CHALLENGES.filter((challenge) => challenge.listed !== false)
}
