import { useMemo, useRef, useEffect } from 'react'
import type React from 'react'
import { useNetVisStore } from '../store'
import { PROTOCOL_COLORS, protocolColorKey } from '../constants/protocol-colors'
import type { ProtocolName } from '../../../shared/capture-types'
import {
  ChartContainer,
  ChartBarChart,
  ChartBar,
  ChartCell,
  ChartTooltip,
  ChartXAxis,
  ChartYAxis,
  type ChartConfig
} from './ui/chart'
import { VisualizationPanel } from './domain'

// ─── Constants ────────────────────────────────────────────────────────────────

const BUCKET_COUNT = 60 // 60 one-second buckets
const BUCKET_WIDTH_MS = 1000

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimelineBucket {
  /** Bucket start time as Unix ms */
  startMs: number
  /** HH:MM:SS label for x-axis */
  label: string
  /** Total packet count in this bucket */
  count: number
  /** Dominant protocol in this bucket (most packets) */
  dominantProtocol: ProtocolName
  /** Per-protocol counts for the accessible table */
  protocolCounts: Partial<Record<ProtocolName, number>>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHHMMSS(ms: number): string {
  const d = new Date(ms)
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  const ss = d.getSeconds().toString().padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function colorFor(proto: ProtocolName): string {
  const key = protocolColorKey(proto)
  return PROTOCOL_COLORS[key].color
}

/**
 * Build 60 one-second buckets anchored to the most recent packet's second.
 * Buckets with no packets get count=0 and dominantProtocol='OTHER'.
 */
function buildBuckets(packets: { timestamp: number; protocol: ProtocolName }[]): TimelineBucket[] {
  if (packets.length === 0) return []

  // Anchor to the latest packet's second boundary
  let latestMs = 0
  for (const p of packets) {
    if (p.timestamp > latestMs) latestMs = p.timestamp
  }
  const latestBucketStart = Math.floor(latestMs / BUCKET_WIDTH_MS) * BUCKET_WIDTH_MS
  const firstBucketStart = latestBucketStart - (BUCKET_COUNT - 1) * BUCKET_WIDTH_MS

  // Initialize all 60 buckets
  const buckets: TimelineBucket[] = Array.from({ length: BUCKET_COUNT }, (_, i) => {
    const startMs = firstBucketStart + i * BUCKET_WIDTH_MS
    return {
      startMs,
      label: formatHHMMSS(startMs),
      count: 0,
      dominantProtocol: 'OTHER' as ProtocolName,
      protocolCounts: {}
    }
  })

  // Distribute packets into buckets
  for (const pkt of packets) {
    const bucketIndex = Math.floor((pkt.timestamp - firstBucketStart) / BUCKET_WIDTH_MS)
    if (bucketIndex < 0 || bucketIndex >= BUCKET_COUNT) continue
    const bucket = buckets[bucketIndex]
    if (!bucket) continue
    bucket.count++
    bucket.protocolCounts[pkt.protocol] = (bucket.protocolCounts[pkt.protocol] ?? 0) + 1
  }

  // Compute dominant protocol for each bucket
  for (const bucket of buckets) {
    if (bucket.count === 0) continue
    let maxCount = 0
    let dominant: ProtocolName = 'OTHER'
    for (const [proto, cnt] of Object.entries(bucket.protocolCounts) as [ProtocolName, number][]) {
      if (cnt > maxCount) {
        maxCount = cnt
        dominant = proto
      }
    }
    bucket.dominantProtocol = dominant
  }

  return buckets
}

/**
 * Build a filter expression that matches packets within a 1-second bucket.
 * Used by Req 22.4 click handler.
 */
function timeRangeFilter(startMs: number): string {
  const endMs = startMs + BUCKET_WIDTH_MS
  return `ts >= ${startMs} AND ts < ${endMs}`
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

interface TooltipPayloadItem {
  payload: TimelineBucket
}

function TimelineTooltipCustom({
  active,
  payload
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
}): React.JSX.Element | null {
  if (!active || !payload?.length) return null
  const bucket = payload[0]?.payload
  if (!bucket) return null

  return (
    <div
      role="tooltip"
      style={{
        backgroundColor: 'var(--nv-bg-surface-2)',
        border: '1px solid var(--nv-border-emphasis)',
        borderRadius: 6,
        padding: '6px 10px',
        fontFamily: 'var(--font-ui)',
        fontSize: 12,
        minWidth: 140,
        opacity: 1,
        boxShadow: 'var(--nv-shadow-md)'
      }}
    >
      <div style={{ color: 'var(--nv-text-secondary)', marginBottom: 4 }}>{bucket.label}</div>
      <div style={{ color: 'var(--nv-text-primary)', fontWeight: 600 }}>
        {bucket.count.toLocaleString()} packets
      </div>
      {bucket.count > 0 && (
        <div style={{ color: colorFor(bucket.dominantProtocol), marginTop: 2, fontSize: 11 }}>
          dominant: {bucket.dominantProtocol}
        </div>
      )}
    </div>
  )
}

// ─── X-axis tick — only show every 10th label to avoid crowding ───────────────

interface TickProps {
  x?: number | string
  y?: number | string
  payload?: { value: string; index: number }
}

function XAxisTick({ x = 0, y = 0, payload }: TickProps): React.JSX.Element | null {
  const numX = typeof x === 'string' ? parseFloat(x) : x
  const numY = typeof y === 'string' ? parseFloat(y) : y
  if (!payload) return null
  // Show label every 10 buckets
  if (payload.index % 10 !== 0 && payload.index !== BUCKET_COUNT - 1) return null
  return (
    <text
      x={numX}
      y={(numY ?? 0) + 10}
      textAnchor="middle"
      style={{ fontFamily: 'var(--font-data)', fontSize: 10, fill: 'var(--nv-text-tertiary)' }}
    >
      {payload.value}
    </text>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Packet flow timeline — 60 one-second buckets as a bar chart.
 * Req 22.1–22.6, 16.3, 24.1
 */
export function PacketFlowTimeline(): React.JSX.Element {
  const filteredPackets = useNetVisStore((s) => s.filteredPackets)
  const setFilter = useNetVisStore((s) => s.setFilter)
  const scrollRef = useRef<HTMLDivElement>(null)

  const buckets = useMemo(
    () =>
      buildBuckets(filteredPackets.map((p) => ({ timestamp: p.timestamp, protocol: p.protocol }))),
    [filteredPackets]
  )

  // Scroll to keep latest bucket visible (Req 22.2)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [buckets])

  // ── Chart + accessible table ─────────────────────────────────────────────

  const chartConfig: ChartConfig = Object.fromEntries(
    Object.keys(PROTOCOL_COLORS).map((k) => [k, { label: k, color: PROTOCOL_COLORS[k as keyof typeof PROTOCOL_COLORS].color }])
  )

  return (
    <VisualizationPanel
      title="Packet Flow Timeline"
      ariaLabel={`Packet flow over the last ${BUCKET_COUNT} seconds`}
      empty={filteredPackets.length === 0}
    >
      {/* Scrollable chart container — keeps latest bucket visible */}
      <div ref={scrollRef} style={{ overflowX: 'auto', overflowY: 'hidden' }} aria-hidden>
        <div style={{ width: Math.max(buckets.length * 14, 400), height: 120 }}>
          <ChartContainer config={chartConfig} style={{ height: 120 }}>
            <ChartBarChart
              data={buckets}
              margin={{ top: 4, right: 4, bottom: 20, left: 0 }}
              barCategoryGap={1}
            >
              <ChartXAxis
                dataKey="label"
                tick={(props: unknown) => <XAxisTick {...(props as TickProps)} />}
              />
              <ChartYAxis hide />
              <ChartTooltip content={<TimelineTooltipCustom />} cursor={{ fill: 'var(--nv-bg-surface-3)' }} />
              <ChartBar
                dataKey="count"
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
                onClick={(data: unknown) => {
                  if (!data || typeof data !== 'object' || !('payload' in data)) return
                  const payload = (data as { payload?: unknown }).payload
                  if (!payload || typeof payload !== 'object' || !('startMs' in payload)) return
                  const startMs = (payload as { startMs: number }).startMs
                  setFilter(timeRangeFilter(startMs))
                }}
                style={{ cursor: 'pointer' }}
              >
                {buckets.map((bucket) => (
                  <ChartCell
                    key={bucket.startMs}
                    fill={colorFor(bucket.dominantProtocol)}
                    opacity={bucket.count === 0 ? 0.15 : 0.85}
                  />
                ))}
              </ChartBar>
            </ChartBarChart>
          </ChartContainer>
        </div>
      </div>

      {/* Accessible data table — WCAG 2.1 AA */}
      <details style={{ marginTop: 2 }}>
        <summary
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-ui)',
            color: 'var(--nv-text-tertiary)',
            cursor: 'pointer',
            userSelect: 'none',
            listStyle: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <span aria-hidden>▸</span> Show data table
        </summary>
        <div style={{ maxHeight: 160, overflowY: 'auto', marginTop: 4 }}>
          <table
            aria-label="Packet flow timeline data"
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 11,
              fontFamily: 'var(--font-ui)'
            }}
          >
            <caption className="sr-only">
              Packet counts per second over the last {BUCKET_COUNT} seconds
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  style={{
                    textAlign: 'left',
                    padding: '2px 6px',
                    color: 'var(--nv-text-tertiary)',
                    fontWeight: 500,
                    borderBottom: '1px solid var(--nv-border-subtle)',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'var(--nv-bg-surface-1)'
                  }}
                >
                  Time
                </th>
                <th
                  scope="col"
                  style={{
                    textAlign: 'right',
                    padding: '2px 6px',
                    color: 'var(--nv-text-tertiary)',
                    fontWeight: 500,
                    borderBottom: '1px solid var(--nv-border-subtle)',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'var(--nv-bg-surface-1)'
                  }}
                >
                  Packets
                </th>
                <th
                  scope="col"
                  style={{
                    textAlign: 'left',
                    padding: '2px 6px',
                    color: 'var(--nv-text-tertiary)',
                    fontWeight: 500,
                    borderBottom: '1px solid var(--nv-border-subtle)',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'var(--nv-bg-surface-1)'
                  }}
                >
                  Dominant
                </th>
              </tr>
            </thead>
            <tbody>
              {buckets
                .filter((b) => b.count > 0)
                .map((bucket) => (
                  <tr key={bucket.startMs}>
                    <td style={{ padding: 0 }} colSpan={3}>
                      <button
                        type="button"
                        onClick={() => setFilter(timeRangeFilter(bucket.startMs))}
                        aria-label={`Filter to ${bucket.label}: ${bucket.count} packets`}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto 1fr',
                          width: '100%',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          padding: 0
                        }}
                      >
                        <span
                          style={{
                            padding: '3px 6px',
                            color: 'var(--nv-text-secondary)',
                            fontFamily: 'var(--font-data)',
                            fontSize: 11
                          }}
                        >
                          {bucket.label}
                        </span>
                        <span
                          style={{
                            padding: '3px 6px',
                            textAlign: 'right',
                            color: 'var(--nv-text-primary)',
                            fontFamily: 'var(--font-data)',
                            fontSize: 11
                          }}
                        >
                          {bucket.count.toLocaleString()}
                        </span>
                        <span
                          style={{
                            padding: '3px 6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5
                          }}
                        >
                          <span
                            aria-hidden
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: 2,
                              backgroundColor: colorFor(bucket.dominantProtocol),
                              flexShrink: 0,
                              display: 'inline-block'
                            }}
                          />
                          <span style={{ color: 'var(--nv-text-secondary)', fontSize: 11 }}>
                            {bucket.dominantProtocol}
                          </span>
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </VisualizationPanel>
  )
}
