/**
 * ChartAnnotationChip — Domain component
 * Inline annotation chip for chart callouts.
 * Pairs text label with optional protocol color dot.
 */
import type React from 'react'
import { PROTOCOL_COLORS, protocolColorKey } from '../../constants/protocol-colors'
import type { ProtocolName } from '../../../../shared/capture-types'

export interface ChartAnnotationChipProps {
    label: string
    proto?: ProtocolName
    value?: string
}

export function ChartAnnotationChip({
    label,
    proto,
    value
}: ChartAnnotationChipProps): React.JSX.Element {
    const key = proto ? protocolColorKey(proto) : 'TCP'
    const c = PROTOCOL_COLORS[key]

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--nv-space-1)',
                padding: '2px var(--nv-space-2)',
                borderRadius: 'var(--nv-radius-sm)',
                background: c.dim,
                border: `1px solid ${c.border}`,
                fontFamily: 'var(--font-ui)',
                fontSize: 'var(--nv-text-label)',
                fontWeight: 500,
                color: c.color
            }}
        >
            {proto && (
                <span
                    style={{ width: 5, height: 5, borderRadius: '50%', background: c.color }}
                    aria-hidden="true"
                />
            )}
            <span>{label}</span>
            {value && (
                <span style={{ fontFamily: 'var(--font-data)', fontSize: 'var(--nv-text-label)' }}>
                    {value}
                </span>
            )}
        </span>
    )
}
