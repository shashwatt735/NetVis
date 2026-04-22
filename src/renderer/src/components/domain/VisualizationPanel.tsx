/**
 * VisualizationPanel — Domain component
 * Wrapper panel for chart visualizations.
 * Enforces: title, accessible aria-label, optional text alternative.
 * Supports empty, loading, and error states.
 */
import type React from 'react'

export interface VisualizationPanelProps {
    title: string
    /** Short description for screen readers */
    ariaLabel: string
    /** Optional accessible text alternative rendered below the chart */
    textAlternative?: React.ReactNode
    /** Optional header-right slot for annotation chips, controls, etc. */
    headerRight?: React.ReactNode
    /** Loading state — renders a skeleton placeholder instead of children */
    loading?: boolean
    /** Error state — renders an error message instead of children */
    error?: string
    /** Empty state — renders a no-data message instead of children */
    empty?: boolean
    children: React.ReactNode
}

const PANEL_PLACEHOLDER_STYLE: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '120px', // fixed placeholder height — no token exists for panel placeholder geometry
    borderRadius: 'var(--nv-radius-md)',
    border: '1px dashed var(--nv-border-subtle)',
    fontFamily: 'var(--font-ui)',
    fontSize: 'var(--nv-text-label)',
    color: 'var(--nv-text-tertiary)'
}

export function VisualizationPanel({
    title,
    ariaLabel,
    textAlternative,
    headerRight,
    loading = false,
    error,
    empty = false,
    children
}: VisualizationPanelProps): React.JSX.Element {
    const renderContent = () => {
        if (loading) {
            return (
                <div
                    style={{
                        ...PANEL_PLACEHOLDER_STYLE,
                        background: 'var(--nv-bg-surface-2)',
                        animation: 'nv-pulse 0.9s ease-in-out infinite'
                    }}
                    role="status"
                    aria-label="Loading chart data"
                >
                    Loading…
                </div>
            )
        }
        if (error) {
            return (
                <div
                    style={{
                        ...PANEL_PLACEHOLDER_STYLE,
                        color: 'var(--nv-status-error)',
                        borderColor: 'var(--proto-arp-border)',
                        background: 'var(--proto-arp-dim)'
                    }}
                    role="alert"
                >
                    {error}
                </div>
            )
        }
        if (empty) {
            return (
                <div style={PANEL_PLACEHOLDER_STYLE} role="status" aria-label="No data available">
                    No data to display
                </div>
            )
        }
        return (
            <div aria-label={ariaLabel}>
                {children}
            </div>
        )
    }

    return (
        <div
            style={{
                padding: 'var(--nv-panel-padding)',
                background: 'var(--nv-bg-surface-1)',
                border: '1px solid var(--nv-border-subtle)',
                borderRadius: 'var(--nv-radius-lg)'
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: 'var(--nv-space-3)',
                    flexWrap: 'wrap',
                    gap: 'var(--nv-gap-inline)'
                }}
            >
                <div
                    style={{
                        fontFamily: 'var(--font-data)',
                        fontSize: 'var(--nv-text-label)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: 'var(--nv-text-tertiary)'
                    }}
                >
                    {title}
                </div>
                {headerRight && (
                    <div style={{ display: 'flex', gap: 'var(--nv-gap-inline)', flexWrap: 'wrap' }}>
                        {headerRight}
                    </div>
                )}
            </div>
            {renderContent()}
            {textAlternative && !loading && !error && !empty && (
                <details style={{ marginTop: 'var(--nv-space-3)' }}>
                    <summary
                        style={{
                            fontFamily: 'var(--font-ui)',
                            fontSize: 'var(--nv-text-label)',
                            color: 'var(--nv-text-tertiary)',
                            cursor: 'pointer'
                        }}
                    >
                        Text alternative (chart accessibility)
                    </summary>
                    <div style={{ marginTop: 'var(--nv-space-2)' }}>{textAlternative}</div>
                </details>
            )}
        </div>
    )
}
