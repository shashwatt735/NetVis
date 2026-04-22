/**
 * ProtocolBadge — Domain component
 * Non-color cue: text label (required) + dot shape (secondary)
 * Never use color alone. Text label is mandatory in all normal UI surfaces.
 */
import type React from 'react'
import { PROTOCOL_COLORS, protocolColorKey } from '../../constants/protocol-colors'
import type { ProtocolName } from '../../../../shared/capture-types'

export interface ProtocolBadgeProps {
    proto: ProtocolName
    size?: 'sm' | 'md' | 'lg'
}

export function ProtocolBadge({ proto, size = 'md' }: ProtocolBadgeProps): React.JSX.Element {
    const key = protocolColorKey(proto)
    const c = PROTOCOL_COLORS[key]

    // Size variants map to density token scale
    const fontSize =
        size === 'lg'
            ? 'var(--nv-text-label)'
            : size === 'sm'
                ? 'var(--nv-text-label)'
                : 'var(--nv-text-mono)'

    // Badge padding is a compact fixed scale intentional to the badge visual design
    // No spacing token maps to sub-4px badge insets — documented exception
    const padding = size === 'lg' ? '3px 10px' : size === 'sm' ? '2px 5px' : '2px 7px'

    // Dot size is a visual indicator, not a spacing value — fixed by design intent
    const dotSize = size === 'lg' ? 6 : 5

    return (
        <span
            style={{
                fontFamily: 'var(--font-data)',
                fontSize,
                fontWeight: 700,
                padding,
                borderRadius: 'var(--nv-radius-sm)',
                border: `1px solid ${c.border}`,
                background: c.dim,
                color: c.color,
                letterSpacing: '0.04em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--nv-space-1)'
            }}
        >
            {/* Non-color cue: dot shape */}
            <span
                style={{
                    width: dotSize,
                    height: dotSize,
                    borderRadius: '50%',
                    background: c.color,
                    flexShrink: 0
                }}
                aria-hidden="true"
            />
            {/* Required: text label */}
            {proto}
        </span>
    )
}
