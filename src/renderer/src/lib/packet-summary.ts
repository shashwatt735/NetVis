/**
 * Plain-language packet summary utility.
 * Converts technical packet structure into beginner-friendly one-line explanations.
 * Req: Educational UX enhancement (Tier 1 improvement)
 */

import type { AnonPacket, ParsedLayer } from '../../../shared/capture-types'

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Safely retrieve a field value from a parsed layer by field name.
 * @param layer - The parsed protocol layer to search
 * @param fieldName - The name of the field to retrieve
 * @returns The field value (string or number) if found, undefined otherwise
 */
function getField(layer: ParsedLayer, fieldName: string): string | number | undefined {
  const field = layer.fields.find((f) => f.name === fieldName)
  return field?.value
}

/**
 * Check if a TCP flags field contains a specific flag name.
 * Case-insensitive substring match (e.g., "SYN", "ACK", "FIN").
 * @param layer - The parsed protocol layer (typically TCP)
 * @param flagName - The flag name to check for (e.g., "SYN", "ACK")
 * @returns true if the flag is present, false otherwise
 */
function hasFlag(layer: ParsedLayer, flagName: string): boolean {
  const flags = getField(layer, 'flags')
  if (typeof flags === 'string') {
    return flags.toLowerCase().includes(flagName.toLowerCase())
  }
  return false
}

/**
 * Extract source or destination port number from a transport layer (TCP/UDP).
 * @param layer - The parsed protocol layer (TCP or UDP)
 * @param direction - 'src' for source port, 'dst' for destination port
 * @returns The port number if found and valid, undefined otherwise
 */
function getPort(layer: ParsedLayer, direction: 'src' | 'dst'): number | undefined {
  const fieldName = direction === 'src' ? 'srcPort' : 'dstPort'
  const port = getField(layer, fieldName)
  return typeof port === 'number' ? port : undefined
}

// ─── Protocol-Specific Summarizers ──────────────────────────────────────────

function summarizeDns(packet: AnonPacket): string | null {
  const dnsLayer = packet.layers.find((l) => l.protocol === 'DNS')
  if (!dnsLayer) return null

  const queryName = getField(dnsLayer, 'queryName')
  const isResponse = getField(dnsLayer, 'isResponse')
  const recordType = getField(dnsLayer, 'recordType')

  if (isResponse) {
    if (queryName) {
      return `DNS response for ${queryName}.`
    }
    return 'DNS response.'
  }

  // Query
  if (queryName) {
    if (recordType && recordType !== 'A') {
      return `DNS query for ${queryName} (${recordType} record).`
    }
    return `DNS query for ${queryName}.`
  }

  return 'DNS query.'
}

function summarizeTcp(packet: AnonPacket): string | null {
  const tcpLayer = packet.layers.find((l) => l.protocol === 'TCP')
  if (!tcpLayer) return null

  const dstPort = getPort(tcpLayer, 'dst')
  const portLabel = dstPort ? ` port ${dstPort}` : ''

  // Check flags in priority order
  if (hasFlag(tcpLayer, 'RST')) {
    return `TCP RST — connection reset.`
  }

  if (hasFlag(tcpLayer, 'SYN') && hasFlag(tcpLayer, 'ACK')) {
    return `TCP SYN-ACK — server accepted connection.`
  }

  if (hasFlag(tcpLayer, 'SYN')) {
    return `TCP SYN — connection initiation to${portLabel}.`
  }

  if (hasFlag(tcpLayer, 'FIN')) {
    return `TCP FIN — connection termination.`
  }

  if (hasFlag(tcpLayer, 'PSH')) {
    return `TCP segment carrying application data.`
  }

  if (hasFlag(tcpLayer, 'ACK')) {
    return `TCP ACK — connection state update.`
  }

  // Generic TCP fallback
  if (dstPort) {
    return `TCP packet on${portLabel}.`
  }

  return 'TCP packet.'
}

function summarizeUdp(packet: AnonPacket): string | null {
  const udpLayer = packet.layers.find((l) => l.protocol === 'UDP')
  if (!udpLayer) return null

  const dstPort = getPort(udpLayer, 'dst')

  if (dstPort) {
    return `UDP datagram on port ${dstPort}.`
  }

  return 'UDP datagram.'
}

function summarizeIcmp(packet: AnonPacket): string | null {
  const icmpLayer = packet.layers.find((l) => l.protocol === 'ICMP')
  if (!icmpLayer) return null

  const type = getField(icmpLayer, 'type')

  if (type === 8 || type === '8') {
    return 'ICMP Echo Request (ping).'
  }

  if (type === 0 || type === '0') {
    return 'ICMP Echo Reply (ping response).'
  }

  if (type === 3 || type === '3') {
    return 'ICMP Destination Unreachable.'
  }

  if (type === 11 || type === '11') {
    return 'ICMP Time Exceeded.'
  }

  return 'ICMP control message.'
}

function summarizeArp(packet: AnonPacket): string | null {
  const arpLayer = packet.layers.find((l) => l.protocol === 'ARP')
  if (!arpLayer) return null

  const opcode = getField(arpLayer, 'opcode')

  if (opcode === 1 || opcode === '1') {
    return 'ARP request — who has [redacted]?'
  }

  if (opcode === 2 || opcode === '2') {
    return 'ARP reply — device address announcement.'
  }

  return 'ARP packet.'
}

// ─── Main Summarizer ─────────────────────────────────────────────────────────

/**
 * Generate a plain-language one-sentence summary of what a packet is doing.
 *
 * Decision order:
 * 1. DNS (highest priority — even if over UDP)
 * 2. ICMP
 * 3. ARP
 * 4. TCP
 * 5. UDP
 * 6. Generic fallback
 *
 * @param packet - The anonymized packet to summarize
 * @returns A beginner-friendly one-sentence explanation
 */
export function summarizePacket(packet: AnonPacket): string {
  // Input validation
  if (!packet || !Array.isArray(packet.layers) || packet.layers.length === 0) {
    return 'Captured network frame.'
  }

  try {
    // Try protocol-specific summarizers in priority order
    const summary =
      summarizeDns(packet) ??
      summarizeIcmp(packet) ??
      summarizeArp(packet) ??
      summarizeTcp(packet) ??
      summarizeUdp(packet)

    if (summary) return summary

    // Generic fallback based on top-level protocol
    const topProtocol = packet.protocol

    if (topProtocol === 'IPv4' || topProtocol === 'IPv6') {
      return 'IP packet carrying an unknown upper-layer protocol.'
    }

    if (topProtocol === 'OTHER') {
      return 'Captured network frame.'
    }

    return `${topProtocol} packet.`
  } catch (error) {
    // Graceful degradation if summary generation fails
    console.warn('Failed to generate packet summary:', error)
    return 'Captured network packet.'
  }
}
