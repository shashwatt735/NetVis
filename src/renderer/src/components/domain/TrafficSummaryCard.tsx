/**
 * TrafficSummaryCard — Domain component
 * Summary metric card with optional protocol accent and trend indicator.
 * Protocol identity always shown by text, never color alone.
 */
import type React from 'react'
import { PROTOCOL_COLORS, protocolColorKey } from '../../constants/protocol-colors'
import type { ProtocolName } from '../../../../shared/capture-types'

export interface TrafficSummaryCardProps {
    title: string
    value: string
    unit?: string
    sub?: string
    proto?: ProtocolName
    trend?: 'up' | 'down' | 'stable'
}

export function TrafficSummaryCard({
    title,
    value,
    unit,
    sub,
    proto,
    trend
}: TrafficSummaryCardProps): React.JSX.Element {
    const trendColor =
        trend === 'up'
            ? 'var(--nv-status-success)'
            : trend === 'down'
                ? 'var(--nv-status-error)'
                : 'var(--nv-text-tertiary)'
    const trendLabel = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'

    const borderColor = proto ? PROTOCOL_COLORS[protocolColorKey(proto)].color : 'var(--nv-accent)'

    return (
        <div
            style={{
                padding: 'var(--nv-panel-padding)',
                background: 'var(--nv-bg-surface-1)',
                border: '1px solid var(--nv-border-subtle)',
                borderRadius: 'var(--nv-radius-lg)',
                borderTop: `2px solid ${borderColor}`
            }}
        >
            <div
                style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: 'var(--nv-text-label)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--nv-text-tertiary)',
                    marginBottom: 'var(--nv-space-2)'
                }}
            >
                {title}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--nv-gap-inline)' }}>
                <span
                    style={{
                        fontFamily: 'var(--font-data)',
                        fontSize: '24px',
                        fontWeight: 700,
                        color: proto ? PROTOCOL_COLORS[protocolColorKey(proto)].color : 'var(--nv-text-primary)',
                        letterSpacing: '-0.5px'
                    }}
                >
                    {value}
                </span>
                {unit && (
                    <span
                        style={{
                            fontFamily: 'var(--font-data)',
                            fontSize: 'var(--nv-text-label)',
                            color: 'var(--nv-text-tertiary)'
                        }}
                    >
                        {unit}
                    </span>
                )}
                {trend && (
                    <span
                        style={{
                            fontFamily: 'var(--font-data)',
                            fontSize: 'var(--nv-text-label)',
                            color: trendColor,
                            marginLeft: 'var(--nv-space-1)'
                        }}
                    >
                        {trendLabel}
                    </span>
                )}
            </div>
            {sub && (
                <div
                    style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: 'var(--nv-text-label)',
                        color: 'var(--nv-text-tertiary)',
                        marginTop: 'var(--nv-space-1)'
                    }}
                >
                    {sub}
                </div>
            )}
        </div>
    )
}
