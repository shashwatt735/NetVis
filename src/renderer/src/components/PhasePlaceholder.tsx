import type React from 'react'

interface PhasePlaceholderProps {
    componentName: string
    requiredPhase?: number
}

/**
 * Shown when VITE_PHASE < the required phase for a component.
 * Req 30.2, 30.4
 */
export function PhasePlaceholder({
    componentName,
    requiredPhase = 2
}: PhasePlaceholderProps): React.JSX.Element {
    return (
        <div
            role="status"
            aria-label={`${componentName} — Phase ${requiredPhase} feature`}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: 24,
                borderRadius: 8,
                border: '1px dashed var(--nv-border-subtle)',
                backgroundColor: 'var(--nv-bg-surface-2)',
                color: 'var(--nv-text-tertiary)',
                fontFamily: 'var(--font-ui)',
                fontSize: 12,
                textAlign: 'center',
                minHeight: 80
            }}
        >
            <span style={{ fontSize: 18, opacity: 0.4 }}>⬡</span>
            <span style={{ fontWeight: 500 }}>{componentName}</span>
            <span style={{ opacity: 0.7 }}>Available in Phase {requiredPhase}</span>
        </div>
    )
}
