/**
 * PacketMetadataCell — Domain component
 * A single field/value pair in the packet inspector.
 * Used inside InspectorSection to display protocol field details.
 * Monospace values, optional byte offset annotation.
 */
import type React from 'react'

export interface PacketMetadataCellProps {
    name: string
    value: string
    offset?: string
    /** Highlight the value with a protocol color */
    color?: string
}

export function PacketMetadataCell({
    name,
    value,
    offset,
    color
}: PacketMetadataCellProps): React.JSX.Element {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 'var(--nv-gap-inline)',
                padding: '3px 0' /* sub-token row micro-padding — 4px (--nv-space-1) would be too tall for dense inspector field rhythm */
            }}
        >
            <span
                style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: 'var(--nv-text-mono)',
                    color: 'var(--nv-text-secondary)',
                    width: '90px',
                    flexShrink: 0
                }}
            >
                {name}
            </span>
            <span
                style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: 'var(--nv-text-mono)',
                    color: color ?? 'var(--nv-text-primary)',
                    flex: 1
                }}
            >
                {value}
            </span>
            {offset && (
                <span
                    style={{
                        fontFamily: 'var(--font-data)',
                        fontSize: 'var(--nv-text-label)',
                        color: 'var(--nv-text-tertiary)'
                    }}
                >
                    {offset}
                </span>
            )}
        </div>
    )
}
