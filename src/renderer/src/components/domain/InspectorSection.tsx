/**
 * InspectorSection - Domain component
 * A collapsible protocol layer section in the packet inspector.
 * Uses the ui/collapsible wrapper for keyboard-accessible expand/collapse.
 * Protocol identity shown by color dot + text label.
 */
import { useState } from 'react'
import type React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible'
import { PacketMetadataCell, type PacketMetadataCellProps } from './PacketMetadataCell'

export interface InspectorSectionProps {
    label: string
    badge?: string
    /** Protocol accent color - if provided, dot and label use this color */
    color?: string
    fields: PacketMetadataCellProps[]
    defaultOpen?: boolean
}

export function InspectorSection({
    label,
    badge,
    color,
    fields,
    defaultOpen = false
}: InspectorSectionProps): React.JSX.Element {
    const [open, setOpen] = useState(defaultOpen)
    const dotColor = color ?? 'var(--nv-text-tertiary)'

    return (
        <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger
                style={{
                    borderRadius: 0
                }}
                aria-label={`${label} - ${open ? 'collapse' : 'expand'}`}
            >
                <div
                    style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: dotColor,
                        flexShrink: 0
                    }}
                />
                <span
                    style={{
                        flex: 1,
                        textAlign: 'left',
                        fontWeight: 500,
                        color: color ?? 'var(--nv-text-primary)'
                    }}
                >
                    {label}
                </span>
                {badge && (
                    <span
                        style={{
                            fontFamily: 'var(--font-data)',
                            fontSize: 'var(--nv-text-label)',
                            color: 'var(--nv-text-tertiary)'
                        }}
                    >
                        {badge}
                    </span>
                )}
                <span style={{ color: 'var(--nv-text-tertiary)', marginLeft: 'var(--nv-space-2)' }}>
                    {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div
                    style={{
                        padding: 'var(--nv-space-1) 0 var(--nv-space-3) var(--nv-space-8)',
                        borderBottom: '1px solid var(--nv-border-subtle)'
                    }}
                >
                    {fields.map((field) => (
                        <PacketMetadataCell key={field.name} {...field} />
                    ))}
                </div>
            </CollapsibleContent>
        </Collapsible>
    )
}
