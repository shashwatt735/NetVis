import { useMemo } from 'react'
import type React from 'react'
import type { ProtocolName } from '../../../shared/capture-types'
import { PROTOCOL_COLORS, protocolColorKey } from '../constants/protocol-colors'
import { useNetVisStore } from '../store'

const BUCKET_COUNT = 36
const BUCKET_WIDTH_MS = 1000

interface TimelineBucket {
  startMs: number
  label: string
  count: number
  dominantProtocol: ProtocolName
}

function formatTime(ms: number): string {
  const date = new Date(ms)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
}

function colorFor(protocol: ProtocolName): string {
  return PROTOCOL_COLORS[protocolColorKey(protocol)].color
}

function buildBuckets(packets: Array<{ timestamp: number; protocol: ProtocolName }>): TimelineBucket[] {
  if (packets.length === 0) return []

  const latestMs = packets.reduce((max, packet) => Math.max(max, packet.timestamp), 0)
  const latestStart = Math.floor(latestMs / BUCKET_WIDTH_MS) * BUCKET_WIDTH_MS
  const firstStart = latestStart - (BUCKET_COUNT - 1) * BUCKET_WIDTH_MS
  const buckets = Array.from({ length: BUCKET_COUNT }, (_, index): TimelineBucket => ({
    startMs: firstStart + index * BUCKET_WIDTH_MS,
    label: formatTime(firstStart + index * BUCKET_WIDTH_MS),
    count: 0,
    dominantProtocol: 'OTHER'
  }))
  const protocolCounts = new Map<number, Map<ProtocolName, number>>()

  for (const packet of packets) {
    const bucketIndex = Math.floor((packet.timestamp - firstStart) / BUCKET_WIDTH_MS)
    const bucket = buckets[bucketIndex]
    if (!bucket) continue
    bucket.count++
    const counts = protocolCounts.get(bucketIndex) ?? new Map<ProtocolName, number>()
    counts.set(packet.protocol, (counts.get(packet.protocol) ?? 0) + 1)
    protocolCounts.set(bucketIndex, counts)
  }

  for (const [bucketIndex, counts] of protocolCounts) {
    let dominant: ProtocolName = 'OTHER'
    let max = 0
    for (const [protocol, count] of counts) {
      if (count > max) {
        dominant = protocol
        max = count
      }
    }
    const bucket = buckets[bucketIndex]
    if (bucket) bucket.dominantProtocol = dominant
  }

  return buckets
}

export function timeRangeFilter(startMs: number): string {
  return `ts >= ${startMs} AND ts < ${startMs + BUCKET_WIDTH_MS}`
}

export function PacketFlowTimeline(): React.JSX.Element {
  const packets = useNetVisStore((s) => s.packets)
  const filterExpression = useNetVisStore((s) => s.filterExpression)
  const setFilter = useNetVisStore((s) => s.setFilter)

  const buckets = useMemo(
    () => buildBuckets(packets.map((packet) => ({ timestamp: packet.timestamp, protocol: packet.protocol }))),
    [packets]
  )
  const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count))

  if (packets.length === 0) {
    return (
      <div
        role="status"
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--nv-text-tertiary)',
          fontSize: 13
        }}
      >
        no data yet
      </div>
    )
  }

  return (
    <div
      aria-label="Packet flow timeline"
      style={{
        height: '100%',
        display: 'grid',
        gridTemplateRows: '1fr 18px',
        gap: 8,
        padding: '12px 12px 8px'
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${BUCKET_COUNT}, minmax(5px, 1fr))`,
          alignItems: 'end',
          gap: 3,
          minHeight: 0
        }}
      >
        {buckets.map((bucket) => {
          const filter = timeRangeFilter(bucket.startMs)
          const isActive = filterExpression.trim() === filter
          return (
            <button
              key={bucket.startMs}
              type="button"
              title={`${bucket.label}: ${bucket.count} packets`}
              aria-label={`Filter to ${bucket.label}, ${bucket.count} packets`}
              aria-pressed={isActive}
              onClick={() => setFilter(isActive ? '' : filter)}
              className="nv-focus"
              style={{
                height: '100%',
                minWidth: 0,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                border: isActive ? '1px solid var(--nv-text-primary)' : '1px solid transparent',
                borderRadius: 'var(--nv-radius-sm)',
                backgroundColor: isActive ? 'var(--nv-bg-surface-3)' : 'transparent',
                padding: '2px 1px',
                cursor: 'pointer'
              }}
            >
              <span
                aria-hidden
                style={{
                  display: 'block',
                  width: '100%',
                  height: `${Math.max(4, (bucket.count / maxCount) * 100)}%`,
                  borderRadius: '2px 2px 0 0',
                  backgroundColor: colorFor(bucket.dominantProtocol),
                  opacity: bucket.count === 0 ? 0.18 : 0.88
                }}
              />
            </button>
          )
        })}
      </div>
      <div
        aria-hidden
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          color: 'var(--nv-text-tertiary)',
          fontFamily: 'var(--font-data)',
          fontSize: 10
        }}
      >
        <span>{buckets[0]?.label}</span>
        <span>{buckets[buckets.length - 1]?.label}</span>
      </div>
    </div>
  )
}
