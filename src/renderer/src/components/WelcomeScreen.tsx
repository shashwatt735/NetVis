/**
 * WelcomeScreen — Req 19.1–19.5
 * First-launch onboarding overlay. Three-step walkthrough.
 * Persists completion via settings:set { welcomeSeen: true }.
 * Fully keyboard-navigable, WCAG 2.1 AA focus management.
 */
import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { Button } from './ui/button'

// ─── Step content ─────────────────────────────────────────────────────────────

interface Step {
    title: string
    body: string
    icon: string
}

const STEPS: Step[] = [
    {
        icon: '📡',
        title: 'Welcome to NetVis',
        body: 'NetVis is an educational packet capture tool. It lets you see the network traffic on your machine in real time — every TCP connection, DNS lookup, and ICMP ping — decoded into human-readable protocol fields.'
    },
    {
        icon: '▶',
        title: 'Start capturing',
        body: 'Select a network interface from the toolbar dropdown and press Start to begin a live capture. No network access? Use Import to load a saved .pcap file, or press Replay to stream one at adjustable speed.'
    },
    {
        icon: '🎯',
        title: 'Try the challenges',
        body: 'Open the Challenges panel to work through guided exercises — spot a TCP handshake, trace a DNS query, or filter by port. Each challenge walks you through what to look for and confirms when you have found it.'
    }
]

// ─── WelcomeScreen ────────────────────────────────────────────────────────────

interface WelcomeScreenProps {
    /** Called when the user dismisses or completes the walkthrough. */
    onClose?: () => void
    /**
     * Optional ref to the element that triggered this overlay.
     * When provided, focus is returned to that element on close (WCAG 2.1 AA).
     */
    triggerRef?: React.RefObject<HTMLElement | null>
}

export function WelcomeScreen({ onClose, triggerRef }: WelcomeScreenProps): React.JSX.Element {
    const [step, setStep] = useState(0)
    const dialogRef = useRef<HTMLDivElement>(null)

    const isLast = step === STEPS.length - 1
    const current = STEPS[step]!

    // Focus the dialog on mount — WCAG 2.1 AA focus management (Req 19.5)
    useEffect(() => {
        dialogRef.current?.focus()
    }, [])

    // Trap focus within the dialog (WCAG 2.1 AA — Req 19.5)
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
        if (e.key === 'Escape') {
            handleDismiss()
            return
        }
        if (e.key !== 'Tab') return

        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (!focusable || focusable.length === 0) return

        const first = focusable[0]!
        const last = focusable[focusable.length - 1]!

        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault()
                last.focus()
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault()
                first.focus()
            }
        }
    }

    const returnFocus = (): void => {
        // Return focus to the trigger element on close — WCAG 2.1 AA (Req 19.5)
        if (triggerRef?.current) {
            triggerRef.current.focus()
        }
    }

    const handleDismiss = (): void => {
        persistCompletion()
        returnFocus()
        onClose?.()
    }

    const handleNext = (): void => {
        if (isLast) {
            handleDismiss()
        } else {
            setStep((s) => s + 1)
        }
    }

    const handleBack = (): void => {
        setStep((s) => Math.max(0, s - 1))
    }

    const persistCompletion = (): void => {
        // Persistence is handled by the onClose callback in App.tsx
        // to ensure Settings_Store is the canonical source of truth (Req 19.3)
    }

    return (
        // Backdrop
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 'var(--nv-z-modal)',
                backgroundColor: 'rgba(0, 0, 0, 0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
            aria-modal="true"
            onClick={(e) => {
                // Dismiss on backdrop click
                if (e.target === e.currentTarget) handleDismiss()
            }}
        >
            {/* Dialog */}
            <div
                ref={dialogRef}
                role="dialog"
                aria-labelledby="welcome-title"
                aria-describedby="welcome-body"
                tabIndex={-1}
                onKeyDown={handleKeyDown}
                style={{
                    width: 480,
                    maxWidth: 'calc(100vw - 32px)',
                    backgroundColor: 'var(--nv-bg-surface-1)',
                    border: '1px solid var(--nv-border-default)',
                    borderRadius: 'var(--nv-radius-xl)',
                    boxShadow: 'var(--nv-shadow-overlay)',
                    outline: 'none',
                    overflow: 'hidden'
                }}
            >
                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px 20px 0'
                    }}
                >
                    {/* Step indicator dots — Req 19.2 */}
                    <div
                        role="status"
                        aria-live="polite"
                        aria-label={`Step ${step + 1} of ${STEPS.length}`}
                        style={{ display: 'flex', gap: 6 }}
                    >
                        {STEPS.map((_, i) => (
                            <span
                                key={i}
                                aria-hidden="true"
                                style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    backgroundColor:
                                        i === step ? 'var(--proto-tcp)' : 'var(--nv-border-default)',
                                    transition: 'background-color 0.2s'
                                }}
                            />
                        ))}
                    </div>

                    {/* Dismiss button */}
                    <button
                        onClick={handleDismiss}
                        aria-label="Dismiss welcome guide"
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--nv-text-tertiary)',
                            fontSize: 18,
                            lineHeight: 1,
                            padding: '2px 4px',
                            borderRadius: 'var(--nv-radius-sm)'
                        }}
                        className="nv-focus"
                    >
                        ×
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px 28px 20px' }}>
                    <div
                        style={{
                            fontSize: 36,
                            marginBottom: 16,
                            lineHeight: 1
                        }}
                        aria-hidden="true"
                    >
                        {current.icon}
                    </div>

                    <h2
                        id="welcome-title"
                        style={{
                            fontFamily: 'var(--font-ui)',
                            fontSize: 18,
                            fontWeight: 600,
                            color: 'var(--nv-text-primary)',
                            margin: '0 0 12px',
                            letterSpacing: '-0.3px'
                        }}
                    >
                        {current.title}
                    </h2>

                    <p
                        id="welcome-body"
                        style={{
                            fontFamily: 'var(--font-ui)',
                            fontSize: 14,
                            lineHeight: 1.6,
                            color: 'var(--nv-text-secondary)',
                            margin: 0
                        }}
                    >
                        {current.body}
                    </p>
                </div>

                {/* Footer */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0 20px 20px'
                    }}
                >
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleBack}
                        disabled={step === 0}
                        aria-label="Previous step"
                    >
                        ← Back
                    </Button>

                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleNext}
                        aria-label={isLast ? 'Get started' : 'Next step'}
                        style={
                            isLast
                                ? { backgroundColor: 'var(--proto-tcp)', border: 'none', color: '#fff' }
                                : undefined
                        }
                    >
                        {isLast ? 'Get started →' : 'Next →'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
