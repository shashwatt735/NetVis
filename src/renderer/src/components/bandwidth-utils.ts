/**
 * Utility functions for BandwidthChart.
 * Extracted to a separate file so BandwidthChart.tsx only exports
 * React components — required for Vite Fast Refresh compatibility.
 */

import type { AnonPacket, ProtocolName } from '../../../shared/capture-types'
import { protocolColorKey } from '../constants/protocol-colors'

export const BANDWIDTH_PROTOCOLS: ProtocolName[] = [
  'TCP', 'UDP', 'ICMP', 'DNS', 'ARP', 'IPv4', 'IPv6', 'OTHER'
]

export interface BandwidthBucket {
  /** Unix timestamp of the bucket start (floored to second) */
  time: number
  /** HH:MM:SS label */
  label: string
  /** Bytes per protocol in this bucket */
  [proto: string]: number | string
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toTimeString().slice(0, 8) // HH:MM:SS
}

/**
 * Build 60 one-second bandwidth buckets from the packet list.
 * Anchored to the latest packet timestamp so imported PCAPs are always visible.
 * Req 28.1, 28.2
 */
export function buildBandwidthBuckets(packets: AnonPacket[]): BandwidthBucket[] {
  if (packets.length === 0) return []

  const latestTs = packets.reduce((max, p) => (p.timestamp > max ? p.timestamp : max), 0)
  const windowEnd = Math.floor(latestTs / 1000) * 1000 + 1000
  const windowStart = windowEnd - 60_000

  const buckets: BandwidthBucket[] = Array.from({ length: 60 }, (_, i) => {
    const time = windowStart + i * 1000
    const bucket: BandwidthBucket = { time, label: formatTime(time) }
    for (const proto of BANDWIDTH_PROTOCOLS) bucket[proto] = 0
    return bucket
  })

  for (const pkt of packets) {
    const bucketIndex = Math.floor((pkt.timestamp - windowStart) / 1000)
    if (bucketIndex < 0 || bucketIndex >= 60) continue
    const key = protocolColorKey(pkt.protocol)
    buckets[bucketIndex][key] = (buckets[bucketIndex][key] as number) + pkt.length
  }

  return buckets
}
