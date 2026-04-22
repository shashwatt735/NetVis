/**
 * FilterChip — Domain component
 * Removable filter chip for active filter expressions.
 * Close button meets minimum 24×24px target size.
 */
import type React from 'react'
import { Filter, X } from 'lucide-react'

export interface FilterChipProps {
    label: string
    onRemove?: () => void
}

export function FilterChip({ label, onRemove }: FilterChipProps): React.JSX.Element {
    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--nv-space-1)',
                padding: 'var(--nv-space-1) var(--nv-space-1) var(--nv-space-1) var(--nv-space-3)',
                borderRadius: '9999px',
                background: 'var(--proto-tcp-dim)',
                border: '1px solid var(--proto-tcp-border)',
                fontFamily: 'var(--font-data)',
                fontSize: 'var(--nv-text-label)',
                fontWeight: 700,
                color: 'var(--proto-tcp)'
            }}
        >
            <Filter size={10} aria-hidden="true" />
            <span>{label}</span>
            {onRemove && (
                <button
                    onClick={onRemove}
                    aria-label={`Remove filter: ${label}`}
                    className="nv-focus"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        marginLeft: 'var(--nv-space-1)',
                        background: 'rgba(59,130,246,0.15)',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--proto-tcp)',
                        flexShrink: 0
                    }}
                >
                    <X size={10} />
                </button>
            )}
        </span>
    )
}
