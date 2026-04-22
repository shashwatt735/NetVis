import { useMemo } from 'react'
import type React from 'react'
import { useNetVisStore } from '../store'
import { PROTOCOL_COLORS, protocolColorKey } from '../constants/protocol-colors'
import { ANIMATION } from '../constants/animations'
import type { ProtocolName } from '../../../shared/capture-types'
import {
  ChartContainer,
  ChartPieChart,
  ChartPie,
  ChartCell,
  ChartTooltip,
  type ChartConfig
} from './ui/chart'
import { VisualizationPanel } from './domain'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChartEntry {
  name: ProtocolName
  count: number
  percentage: number
  color: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map ProtocolName → hex color, falling back to OTHER for unknown protocols. */
function colorFor(proto: ProtocolName): string {
  const key = protocolColorKey(proto)
  return PROTOCOL_COLORS[key].color
}

/** Build sorted chart entries from a protocol count map. */
function buildEntries(counts: Map<ProtocolName, number>, total: number): ChartEntry[] {
  return Array.from(counts.entries())
    .map(([name, count]) => ({
      name,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      color: colorFor(name)
    }))
    .sort((a, b) => b.count - a.count)
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

interface TooltipPayloadItem {
  payload: ChartEntry
}

function ChartTooltipCustom({
  active,
  payload
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
}): React.JSX.Element | null {
  if (!active || !payload?.length) return null
  const entry = payload[0]?.payload
  if (!entry) return null

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
        opacity: 1,
        boxShadow: 'var(--nv-shadow-md)'
      }}
    >
      <span style={{ color: entry.color, fontWeight: 600 }}>{entry.name}</span>
      <span style={{ color: 'var(--nv-text-secondary)', marginLeft: 8 }}>
        {entry.count.toLocaleString()} pkts · {entry.percentage}%
      </span>
    </div>
  )
}

// ─── Custom label ─────────────────────────────────────────────────────────────

interface LabelProps {
  cx: number
  cy: number
  midAngle: number
  outerRadius: number
  name: ProtocolName
  percentage: number
}

const RADIAN = Math.PI / 180

function ChartLabel({
  cx,
  cy,
  midAngle,
  outerRadius,
  name,
  percentage
}: LabelProps): React.JSX.Element | null {
  // Only render labels for segments ≥5% to avoid clutter
  if (percentage < 5) return null

  const radius = outerRadius + 18
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return (
    <text
      x={x}
      y={y}
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      style={{
        fontFamily: 'var(--font-ui)',
        fontSize: 11,
        fill: 'var(--nv-text-secondary)'
      }}
    >
      {name} {percentage}%
    </text>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Protocol distribution pie chart.
 * Req 6.1–6.4, 16.3, 21.2, 24.1
 */
export function ProtocolChart(): React.JSX.Element {
  const filteredPackets = useNetVisStore((s) => s.filteredPackets)

  // Derive protocol counts — recomputed only when filteredPackets changes
  const { entries, total } = useMemo(() => {
    const counts = new Map<ProtocolName, number>()
    for (const pkt of filteredPackets) {
      counts.set(pkt.protocol, (counts.get(pkt.protocol) ?? 0) + 1)
    }
    const t = filteredPackets.length
    return { entries: buildEntries(counts, t), total: t }
  }, [filteredPackets])

  // ── Chart + accessible table ─────────────────────────────────────────────

  // Build ChartConfig for ChartContainer
  const chartConfig: ChartConfig = Object.fromEntries(
    entries.map((e) => [e.name, { label: e.name, color: e.color }])
  )

  return (
    <VisualizationPanel
      title="Protocol Distribution"
      ariaLabel={`Protocol distribution across ${total.toLocaleString()} packets`}
      empty={total === 0}
    >
      {/* Pie chart — visual representation */}
      <ChartContainer config={chartConfig} style={{ height: 180 }}>
        <ChartPieChart>
          <ChartPie
            data={entries}
            dataKey="count"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={68}
            innerRadius={32}
            paddingAngle={2}
            isAnimationActive
            animationDuration={ANIMATION.CHART_TRANSITION_MS}
            animationEasing="ease-out"
            labelLine={false}
            label={(props: unknown) => <ChartLabel {...(props as LabelProps)} />}
          >
            {entries.map((entry) => (
              <ChartCell key={entry.name} fill={entry.color} stroke="none" opacity={0.9} />
            ))}
          </ChartPie>
          <ChartTooltip content={<ChartTooltipCustom />} />
        </ChartPieChart>
      </ChartContainer>

      {/* Accessible data table — WCAG 2.1 AA */}
      <table
        aria-label="Protocol distribution"
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 11,
          fontFamily: 'var(--font-ui)'
        }}
      >
        <caption className="sr-only">
          Protocol distribution across {total.toLocaleString()} packets
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
                borderBottom: '1px solid var(--nv-border-subtle)'
              }}
            >
              Protocol
            </th>
            <th
              scope="col"
              style={{
                textAlign: 'right',
                padding: '2px 6px',
                color: 'var(--nv-text-tertiary)',
                fontWeight: 500,
                borderBottom: '1px solid var(--nv-border-subtle)'
              }}
            >
              Packets
            </th>
            <th
              scope="col"
              style={{
                textAlign: 'right',
                padding: '2px 6px',
                color: 'var(--nv-text-tertiary)',
                fontWeight: 500,
                borderBottom: '1px solid var(--nv-border-subtle)'
              }}
            >
              %
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.name}>
              <td style={{ padding: '3px 6px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span
                    aria-hidden
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      backgroundColor: entry.color,
                      flexShrink: 0,
                      display: 'inline-block'
                    }}
                  />
                  <span style={{ color: 'var(--nv-text-primary)' }}>{entry.name}</span>
                </span>
              </td>
              <td
                style={{
                  padding: '3px 6px',
                  textAlign: 'right',
                  color: 'var(--nv-text-secondary)',
                  fontFamily: 'var(--font-data)'
                }}
              >
                {entry.count.toLocaleString()}
              </td>
              <td
                style={{
                  padding: '3px 6px',
                  textAlign: 'right',
                  color: 'var(--nv-text-tertiary)',
                  fontFamily: 'var(--font-data)'
                }}
              >
                {entry.percentage}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </VisualizationPanel>
  )
}
