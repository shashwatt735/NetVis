/**
 * WelcomeScreen - Req 19.1-19.5
 * First-launch onboarding overlay. Four-step walkthrough.
 * Persists completion via settings:set { welcomeSeen: true }.
 * Fully keyboard-navigable, WCAG 2.1 AA focus management.
 */
import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { BookOpen, FileDown, Radio, Trophy, X } from 'lucide-react'
import { Button } from './ui/button'

interface Step {
  title: string
  body: string
  icon: React.ComponentType<{ size?: number; color?: string; 'aria-hidden'?: boolean }>
  iconColor: string
}

const STEPS: Step[] = [
  {
    icon: Radio,
    iconColor: 'var(--proto-tcp)',
    title: 'Welcome to NetVis',
    body: 'NetVis helps you understand how computers communicate by showing real network traffic in plain language. You do not need networking knowledge to get started.'
  },
  {
    icon: FileDown,
    iconColor: 'var(--proto-dns)',
    title: 'Start or Import Traffic',
    body: 'Use Live capture to watch packets from your Wi-Fi or Ethernet interface. Use Import PCAP or Replay PCAP when you want to explore a saved capture.'
  },
  {
    icon: BookOpen,
    iconColor: 'var(--proto-icmp)',
    title: 'Learn as You Inspect',
    body: 'Click a packet to see its layers, fields, and a short summary. The Learn page explains filters, interfaces, protocols, and common packet patterns whenever you need a reference.'
  },
  {
    icon: Trophy,
    iconColor: 'var(--proto-udp)',
    title: 'Try Guided Challenges',
    body: 'Challenges ask you to find real evidence in the packet list, such as a DNS query or TCP handshake. They confirm what you found without points or pressure.'
  }
]

interface WelcomeScreenProps {
  /** Called when the user dismisses or completes the walkthrough. */
  onClose?: () => void
  /**
   * Optional ref to the element that triggered this overlay.
   * When provided, focus is returned to that element on close.
   */
  triggerRef?: React.RefObject<HTMLElement | null>
}

export function WelcomeScreen({ onClose, triggerRef }: WelcomeScreenProps): React.JSX.Element {
  const [step, setStep] = useState(0)
  const dialogRef = useRef<HTMLDivElement>(null)

  const isLast = step === STEPS.length - 1
  const current = STEPS[step]!
  const StepIcon = current.icon

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  const persistCompletion = (): void => {
    // Persistence is handled by the onClose callback in App.tsx so Settings_Store stays canonical.
  }

  const returnFocus = (): void => {
    triggerRef?.current?.focus()
  }

  const handleDismiss = (): void => {
    persistCompletion()
    returnFocus()
    onClose?.()
  }

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

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const handleNext = (): void => {
    if (isLast) {
      handleDismiss()
    } else {
      setStep((s) => s + 1)
    }
  }

  return (
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
        if (e.target === e.currentTarget) handleDismiss()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-labelledby="welcome-title"
        aria-describedby="welcome-body"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        style={{
          width: 500,
          maxWidth: 'calc(100vw - 32px)',
          backgroundColor: 'var(--nv-bg-surface-1)',
          border: '1px solid var(--nv-border-default)',
          borderRadius: 'var(--nv-radius-xl)',
          boxShadow: 'var(--nv-shadow-overlay)',
          outline: 'none',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px 0'
          }}
        >
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
                  backgroundColor: i === step ? 'var(--proto-tcp)' : 'var(--nv-border-default)',
                  transition: 'background-color 0.2s'
                }}
              />
            ))}
          </div>

          <button
            onClick={handleDismiss}
            aria-label="Dismiss welcome guide"
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 26,
              height: 26,
              background: 'transparent',
              border: '1px solid transparent',
              cursor: 'pointer',
              color: 'var(--nv-text-tertiary)',
              borderRadius: 'var(--nv-radius-sm)'
            }}
            className="nv-focus"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div style={{ padding: '24px 28px 20px' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--nv-radius-lg)',
              backgroundColor: 'var(--nv-bg-surface-2)',
              border: '1px solid var(--nv-border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 18
            }}
            aria-hidden="true"
          >
            <StepIcon size={22} color={current.iconColor} aria-hidden />
          </div>

          <h2
            id="welcome-title"
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--nv-text-primary)',
              margin: '0 0 12px'
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
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            aria-label="Previous step"
          >
            Back
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleNext}
            aria-label={isLast ? 'Open NetVis' : 'Next step'}
            style={
              isLast
                ? { backgroundColor: 'var(--proto-tcp)', border: 'none', color: '#fff' }
                : undefined
            }
          >
            {isLast ? 'Open NetVis' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  )
}
