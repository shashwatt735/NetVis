/**
 * Challenge library for guided educational exercises.
 * Req 11.1, 11.2
 */

import type { AnonPacket } from '../../../shared/capture-types'

export interface Challenge {
  id: string
  title: string
  goal: string
  hint: string
  successCriteria: (packets: AnonPacket[], filterExpression?: string) => boolean
}

/**
 * Challenge 1: Identify a TCP three-way handshake
 * Success: Find SYN, SYN-ACK, ACK sequence between same endpoints (non-consecutive)
 */
function isTcpHandshake(packets: AnonPacket[]): boolean {
  const tcpPackets = packets.filter((p) => p.protocol === 'TCP')

  for (let i = 0; i < tcpPackets.length; i++) {
    const p1 = tcpPackets[i]!
    const tcp1 = p1.layers.find((l) => l.protocol === 'TCP')
    if (!tcp1) continue
    const flags1 = tcp1.fields.find((f) => f.name === 'flags')?.value as string | undefined
    if (!flags1) continue

    // p1 must be SYN (no ACK)
    if (!flags1.includes('SYN') || flags1.includes('ACK')) continue

    // Look for SYN-ACK from the reverse direction after p1
    for (let j = i + 1; j < tcpPackets.length; j++) {
      const p2 = tcpPackets[j]!
      const tcp2 = p2.layers.find((l) => l.protocol === 'TCP')
      if (!tcp2) continue
      const flags2 = tcp2.fields.find((f) => f.name === 'flags')?.value as string | undefined
      if (!flags2) continue

      // p2 must be SYN-ACK from reversed direction
      if (!flags2.includes('SYN') || !flags2.includes('ACK')) continue
      if (p2.srcAddress !== p1.dstAddress || p2.dstAddress !== p1.srcAddress) continue

      // Look for ACK from original direction after p2
      for (let k = j + 1; k < tcpPackets.length; k++) {
        const p3 = tcpPackets[k]!
        const tcp3 = p3.layers.find((l) => l.protocol === 'TCP')
        if (!tcp3) continue
        const flags3 = tcp3.fields.find((f) => f.name === 'flags')?.value as string | undefined
        if (!flags3) continue

        // p3 must be ACK (no SYN) from original direction
        if (!flags3.includes('ACK') || flags3.includes('SYN')) continue
        if (p3.srcAddress !== p1.srcAddress || p3.dstAddress !== p1.dstAddress) continue

        return true
      }
    }
  }
  return false
}

/**
 * Challenge 2: Identify a DNS query/response pair
 * Success: Find DNS query followed by DNS response (non-consecutive)
 */
function isDnsQueryResponse(packets: AnonPacket[]): boolean {
  const dnsPackets = packets.filter((p) => p.protocol === 'DNS')

  let hasQuery = false
  let hasResponse = false

  for (const p of dnsPackets) {
    const dns = p.layers.find((l) => l.protocol === 'DNS')
    if (!dns) continue
    const flags = dns.fields.find((f) => f.name === 'flags')?.value as string | undefined
    if (!flags) continue

    if (flags.includes('Query')) hasQuery = true
    if (flags.includes('Response')) hasResponse = true

    if (hasQuery && hasResponse) return true
  }
  return false
}

/**
 * Challenge 3: Identify an ICMP echo request/reply pair
 * Success: Find ICMP echo request (type 8) and echo reply (type 0)
 */
function isIcmpEchoPair(packets: AnonPacket[]): boolean {
  let hasRequest = false
  let hasReply = false

  for (const p of packets) {
    if (p.protocol !== 'ICMP') continue

    const icmp = p.layers.find((l) => l.protocol === 'ICMP')
    if (!icmp) continue

    const type = icmp.fields.find((f) => f.name === 'type')?.value
    if (type === 8 || type === '8') hasRequest = true
    if (type === 0 || type === '0') hasReply = true

    if (hasRequest && hasReply) return true
  }
  return false
}

/**
 * Challenge 4: Filter traffic by port number
 * Success: User has applied a filter expression containing "port"
 */
function isFilterByPort(packets: AnonPacket[], filterExpression?: string): boolean {
  if (!filterExpression) return false
  return filterExpression.toLowerCase().includes('port') && packets.length > 0
}

/**
 * Challenge 5: Compare packet lengths across protocols
 * Success: Have packets from at least 3 different protocols with varying lengths
 */
function isComparePacketLengths(packets: AnonPacket[]): boolean {
  const protocolLengths = new Map<string, Set<number>>()

  for (const p of packets) {
    if (!protocolLengths.has(p.protocol)) {
      protocolLengths.set(p.protocol, new Set())
    }
    protocolLengths.get(p.protocol)!.add(p.length)
  }

  // Need at least 3 protocols
  if (protocolLengths.size < 3) return false

  // Each protocol should have varying lengths (at least 2 different lengths)
  let protocolsWithVariation = 0
  for (const lengths of protocolLengths.values()) {
    if (lengths.size >= 2) protocolsWithVariation++
  }

  return protocolsWithVariation >= 2
}

/**
 * Challenge library — 5 guided challenges covering core networking concepts.
 * Req 11.1
 */
export const CHALLENGES: Challenge[] = [
  {
    id: 'tcp-handshake',
    title: 'TCP Three-Way Handshake',
    goal: 'Identify a complete TCP three-way handshake (SYN → SYN-ACK → ACK) in the packet list.',
    hint: 'Look for three consecutive TCP packets with flags: SYN, SYN+ACK, and ACK. The source and destination addresses should be reversed in the SYN-ACK packet.',
    successCriteria: isTcpHandshake
  },
  {
    id: 'dns-query-response',
    title: 'DNS Query and Response',
    goal: 'Find a DNS query followed by its corresponding response.',
    hint: 'DNS queries and responses both use UDP port 53. Look for a query packet followed by a response packet with matching transaction IDs.',
    successCriteria: isDnsQueryResponse
  },
  {
    id: 'icmp-echo-pair',
    title: 'ICMP Echo Request and Reply',
    goal: 'Identify an ICMP echo request (ping) and its corresponding reply.',
    hint: 'ICMP echo requests have type 8, and echo replies have type 0. Look for both types in your packet list.',
    successCriteria: isIcmpEchoPair
  },
  {
    id: 'filter-by-port',
    title: 'Filter Traffic by Port',
    goal: 'Use the filter bar to show only traffic on a specific port (e.g., port == 80 or port == 443).',
    hint: 'Type a filter expression like "port == 80" in the filter bar at the top of the window. Press Enter to apply the filter.',
    successCriteria: isFilterByPort
  },
  {
    id: 'compare-packet-lengths',
    title: 'Compare Packet Lengths',
    goal: 'Observe packets from at least 3 different protocols and notice how their lengths vary.',
    hint: 'Different protocols have different header sizes and payload requirements. TCP packets are often larger than UDP, and ICMP packets are typically smaller.',
    successCriteria: isComparePacketLengths
  }
]

/**
 * Get a challenge by ID.
 */
export function getChallengeById(id: string): Challenge | undefined {
  return CHALLENGES.find((c) => c.id === id)
}
