import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
    children: ReactNode
}

interface State {
    error: Error | null
}

/**
 * Top-level error boundary — catches render errors that would otherwise
 * produce a blank screen with no feedback.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { error: null }
    }

    static getDerivedStateFromError(error: Error): State {
        return { error }
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error('[ErrorBoundary] Render error:', error)
        console.error('[ErrorBoundary] Component stack:', info.componentStack)
    }

    render(): ReactNode {
        const { error } = this.state
        if (error) {
            return (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 16,
                        backgroundColor: 'var(--nv-bg-base, #0f1117)',
                        color: 'var(--nv-text-primary, #e2e8f0)',
                        fontFamily: 'monospace',
                        padding: 32
                    }}
                >
                    <div style={{ fontSize: 32 }}>⚠</div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                        A render error occurred
                    </h2>
                    <pre
                        style={{
                            maxWidth: 720,
                            width: '100%',
                            padding: '12px 16px',
                            backgroundColor: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: 8,
                            fontSize: 12,
                            lineHeight: 1.6,
                            overflowX: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            color: '#fca5a5'
                        }}
                    >
                        {error.message}
                        {error.stack ? `\n\n${error.stack}` : ''}
                    </pre>
                    <button
                        onClick={() => this.setState({ error: null })}
                        style={{
                            padding: '8px 20px',
                            borderRadius: 6,
                            border: '1px solid rgba(255,255,255,0.2)',
                            backgroundColor: 'rgba(255,255,255,0.08)',
                            color: 'inherit',
                            cursor: 'pointer',
                            fontSize: 13
                        }}
                    >
                        Try to recover
                    </button>
                </div>
            )
        }

        return this.props.children
    }
}
