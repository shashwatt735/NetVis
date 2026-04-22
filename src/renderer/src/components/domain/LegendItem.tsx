/**
 * LegendItem — Domain component
 * Legend items must pair swatch with text label.
 * Optional: line style for charts that use dashed/dotted strokes.
 */
import type React from 'react'
import { PROTOCOL_COLORS, protocolColorKey } from '../../constants/protocol-colors'
import type { ProtocolName } from '../../../../shared/capture-types'

export interface LegendItemProps {
    proto: ProtocolName
    count?: number
    pct?: number
    lineStyle?: 'solid' | 'dashed' | 'dotted'
    disabled?: boolean
}

export function LegendItem({
    proto,
    count,
    pct,
    lineStyle = 'solid',
    disabled = false
}: LegendItemProps): React.JSX.Element {
    const key = protocolColorKey(proto)
    const c = PROTOCOL_COLORS[key]
    const strokeDash = lineStyle === 'dashed' ? '4,3' : lineStyle === 'dotted' ? '1,3' : undefined

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--nv-space-2)',
                opacity: disabled ? 0.35 : 1,
                transition: 'opacity 0.15s'
            }}
        >
            {/* Non-color cue: line style marker */}
            <svg width={20} height={12} aria-hidden="true">
                <line
                    x1="0"
                    y1="6"
                    x2="20"
                    y2="6"
                    stroke={c.color}
                    strokeWidth="2.5"
                    strokeDasharray={strokeDash}
                    strokeLinecap="round"
                />
                <circle cx="10" cy="6" r="3" fill={c.color} />
            </svg>
            {/* Required: text label */}
            <span
                style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: 'var(--nv-text-label)',
                    fontWeight: 500,
                    color: disabled ? 'var(--nv-text-tertiary)' : 'var(--nv-text-primary)'
                }}
            >
                {proto}
            </span>
            {pct !== undefined && (
                <span
                    style={{
                        fontFamily: 'var(--font-data)',
                        fontSize: 'var(--nv-text-mono)',
                        color: 'var(--nv-text-secondary)'
                    }}
                >
                    {pct}%
                </span>
            )}
            {count !== undefined && (
                <span
                    style={{
                        fontFamily: 'var(--font-data)',
                        fontSize: 'var(--nv-text-label)',
                        color: 'var(--nv-text-tertiary)'
                    }}
                >
                    {count.toLocaleString()}
                </span>
            )}
        </div>
    )
}
