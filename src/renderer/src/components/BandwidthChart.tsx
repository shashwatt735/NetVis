import type React from 'react'
import { useMemo, useCallback } from 'react'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts'
import { useNetVisStore } from '../store'
import { PROTOCOL_COLORS, protocolColorKey } from '../constants/protocol-colors'
import { PhasePlaceholder } from './PhasePlaceholder'
import { buildBandwidthBuckets, BANDWIDTH_PROTOCOLS, type BandwidthBucket } from './bandwidth-utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── BandwidthChart ───────────────────────────────────────────────────────────

declare const __VITE_PHASE__: number

/**
 * Bandwidth Chart — stacked area chart showing traffic volume in bytes over time,
 * broken down by protocol.
 *
 * Req 28.1–28.6, 30.2, 30.4
 * - Recharts AreaChart (stacked); 1-second buckets accumulating bytes per protocol
 * - Each area colored by PROTOCOL_COLORS
 * - Click region → time-range filter (Req 28.3)
 * - Accessible table alternative (Req 28.5)
 * - Placeholder when empty (Req 28.6)
 * - Renders PhasePlaceholder when VITE_PHASE < 2
 */
export function BandwidthChart(): React.JSX.Element {
    if (__VITE_PHASE__ < 2) {
        return <PhasePlaceholder componentName="Bandwidth Chart" />
    }

    return <BandwidthChartInner />
}

function BandwidthChartInner(): React.JSX.Element {
    const filteredPackets = useNetVisStore((s) => s.filteredPackets)
    const setFilter = useNetVisStore((s) => s.setFilter)

    const buckets = useMemo(() => buildBandwidthBuckets(filteredPackets), [filteredPackets])

    const totalBytes = useMemo(
        () =>
            buckets.reduce(
                (sum, b) => sum + BANDWIDTH_PROTOCOLS.reduce((s, p) => s + (b[p] as number), 0),
                0
            ),
        [buckets]
    )

    // Click on a chart region → time-range filter (Req 28.3)
    const handleClick = useCallback(
        (data: { activePayload?: Array<{ payload: BandwidthBucket }> }) => {
            const bucket = data?.activePayload?.[0]?.payload
            if (!bucket) return
            const start = bucket.time
            const end = start + 1000
            setFilter(`ts >= ${start} AND ts < ${end}`)
        },
        [setFilter]
    )

    // Placeholder when empty (Req 28.6)
    if (totalBytes === 0) {
        return (
            <div
                role="status"
                aria-label="Bandwidth chart — no data"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 120,
                    borderRadius: 8,
                    border: '1px dashed var(--nv-border-subtle)',
                    backgroundColor: 'var(--nv-bg-surface-2)',
                    color: 'var(--nv-text-tertiary)',
                    fontFamily: 'var(--font-ui)',
                    fontSize: 12
                }}
            >
                No bandwidth data yet
            </div>
        )
    }

    // Determine which protocols have any data
    const activeProtocols = BANDWIDTH_PROTOCOLS.filter((p) =>
        buckets.some((b) => (b[p] as number) > 0)
    )

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 4px'
                }}
            >
                <span
                    style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: 11,
                        fontWeight: 500,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        color: 'var(--nv-text-tertiary)'
                    }}
                >
                    Bandwidth (last 60s)
                </span>
                <span
                    style={{
                        fontFamily: 'var(--font-data)',
                        fontSize: 11,
                        color: 'var(--nv-text-tertiary)'
                    }}
                >
                    {formatBytes(totalBytes)} total
                </span>
            </div>

            {/* Chart */}
            <div style={{ height: 140 }} aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={buckets}
                        margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                        onClick={handleClick}
                        style={{ cursor: 'pointer' }}
                    >
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="var(--nv-border-subtle)"
                            vertical={false}
                        />
                        <XAxis
                            dataKey="label"
                            tick={{ fontSize: 9, fontFamily: 'var(--font-data)', fill: 'var(--nv-text-tertiary)' }}
                            interval={14}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            tickFormatter={formatBytes}
                            tick={{ fontSize: 9, fontFamily: 'var(--font-data)', fill: 'var(--nv-text-tertiary)' }}
                            tickLine={false}
                            axisLine={false}
                            width={48}
                        />
                        <Tooltip
                            formatter={(value: number, name: string) => [formatBytes(value), name]}
                            labelFormatter={(label: string) => `Time: ${label}`}
                            contentStyle={{
                                backgroundColor: 'var(--nv-bg-surface-2)',
                                border: '1px solid var(--nv-border-default)',
                                borderRadius: 6,
                                fontSize: 11,
                                fontFamily: 'var(--font-ui)'
                            }}
                        />
                        {activeProtocols.map((proto) => {
                            const key = protocolColorKey(proto)
                            const color = PROTOCOL_COLORS[key].color
                            return (
                                <Area
                                    key={proto}
                                    type="monotone"
                                    dataKey={proto}
                                    stackId="1"
                                    stroke={color}
                                    fill={color}
                                    fillOpacity={0.6}
                                    strokeWidth={1}
                                    dot={false}
                                    activeDot={{ r: 3 }}
                                    isAnimationActive={false}
                                />
                            )
                        })}
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Accessible table alternative (Req 28.5) */}
            <details style={{ marginTop: 4 }}>
                <summary
                    style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: 11,
                        color: 'var(--nv-text-tertiary)',
                        cursor: 'pointer',
                        userSelect: 'none'
                    }}
                >
                    Show data table
                </summary>
                <div style={{ overflowX: 'auto', marginTop: 6 }}>
                    <table
                        aria-label="Bandwidth data by protocol and time"
                        style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontFamily: 'var(--font-data)',
                            fontSize: 10
                        }}
                    >
                        <thead>
                            <tr>
                                <th
                                    scope="col"
                                    style={{
                                        textAlign: 'left',
                                        padding: '2px 6px',
                                        color: 'var(--nv-text-tertiary)',
                                        fontWeight: 600,
                                        borderBottom: '1px solid var(--nv-border-subtle)'
                                    }}
                                >
                                    Time
                                </th>
                                {activeProtocols.map((p) => (
                                    <th
                                        key={p}
                                        scope="col"
                                        style={{
                                            textAlign: 'right',
                                            padding: '2px 6px',
                                            color: PROTOCOL_COLORS[protocolColorKey(p)].color,
                                            fontWeight: 600,
                                            borderBottom: '1px solid var(--nv-border-subtle)'
                                        }}
                                    >
                                        {p}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {buckets
                                .filter((b) => activeProtocols.some((p) => (b[p] as number) > 0))
                                .map((b) => (
                                    <tr key={b.time}>
                                        <td
                                            style={{
                                                padding: '2px 6px',
                                                color: 'var(--nv-text-secondary)',
                                                borderBottom: '1px solid var(--nv-border-subtle)'
                                            }}
                                        >
                                            {b.label}
                                        </td>
                                        {activeProtocols.map((p) => (
                                            <td
                                                key={p}
                                                style={{
                                                    textAlign: 'right',
                                                    padding: '2px 6px',
                                                    color: 'var(--nv-text-secondary)',
                                                    borderBottom: '1px solid var(--nv-border-subtle)'
                                                }}
                                            >
                                                {(b[p] as number) > 0 ? formatBytes(b[p] as number) : '—'}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </details>
        </div>
    )
}
