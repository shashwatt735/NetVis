/**
 * StatusPill — Domain component
 * Non-color cue: text label (required) + icon (secondary)
 * Error, warning, success must be identifiable without color alone.
 */
import type React from 'react'
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react'

export type StatusType = 'success' | 'warning' | 'error' | 'info'

export interface StatusPillProps {
    status: StatusType
    label: string
}

const STATUS_CONFIG: Record<
    StatusType,
    { color: string; bg: string; border: string; icon: React.ReactNode }
> = {
    success: {
        color: 'var(--nv-status-success)',
        bg: 'rgba(63,185,80,0.10)',
        border: 'rgba(63,185,80,0.28)',
        icon: <CheckCircle size={12} />
    },
    warning: {
        color: 'var(--nv-status-warning)',
        bg: 'rgba(210,153,34,0.10)',
        border: 'rgba(210,153,34,0.28)',
        icon: <AlertTriangle size={12} />
    },
    error: {
        color: 'var(--nv-status-error)',
        bg: 'rgba(248,81,73,0.10)',
        border: 'rgba(248,81,73,0.28)',
        icon: <XCircle size={12} />
    },
    info: {
        color: 'var(--nv-accent)',
        bg: 'var(--nv-accent-dim)',
        border: 'var(--nv-accent-border)',
        icon: <Info size={12} />
    }
}

export function StatusPill({ status, label }: StatusPillProps): React.JSX.Element {
    const cfg = STATUS_CONFIG[status]
    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--nv-space-1)',
                padding: 'var(--nv-space-1) var(--nv-space-3)',
                borderRadius: '9999px',
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                fontFamily: 'var(--font-ui)',
                fontSize: 'var(--nv-text-label)',
                fontWeight: 500,
                color: cfg.color
            }}
        >
            {/* Non-color cue: icon */}
            <span aria-hidden="true">{cfg.icon}</span>
            {/* Required: text label */}
            {label}
        </span>
    )
}
