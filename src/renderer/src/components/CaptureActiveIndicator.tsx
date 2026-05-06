import type React from 'react'
import { ANIMATION } from '../constants/animations'
import { useNetVisStore } from '../store'

/**
 * Pulsing dot shown in the Toolbar while a capture, file stream, or replay is active.
 * Req 21.4 - CSS @keyframes pulse, aria-label, role="status"
 */
export function CaptureActiveIndicator(): React.JSX.Element {
  const captureStatus = useNetVisStore((s) => s.captureStatus)

  const indicator =
    captureStatus.state === 'active'
      ? {
          label: 'Live',
          ariaLabel: `Live capture active on ${captureStatus.iface}`,
          title: `Live capture active on ${captureStatus.iface}`,
          color: 'var(--nv-status-success)'
        }
      : captureStatus.state === 'file'
        ? {
            label: 'File',
            ariaLabel: 'File playback active',
            title: 'File playback active',
            color: 'var(--nv-accent)'
          }
        : captureStatus.state === 'simulated'
          ? {
              label: 'Replay',
              ariaLabel: `Simulated replay active at ${captureStatus.speed}x speed`,
              title: `Simulated replay active at ${captureStatus.speed}x speed`,
              color: 'var(--nv-accent)'
            }
          : {
              label: 'Active',
              ariaLabel: 'Capture active',
              title: 'Capture active',
              color: 'var(--nv-status-success)'
            }

  return (
    <span
      role="status"
      aria-label={indicator.ariaLabel}
      title={indicator.title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontFamily: 'var(--font-ui)',
        fontWeight: 500,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: indicator.color
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: indicator.color,
          animation: `nv-pulse ${ANIMATION.CAPTURE_PULSE_MS}ms ease-in-out infinite`
        }}
      />
      {indicator.label}
    </span>
  )
}
