import { useEffect, useState } from 'react'
import type React from 'react'

/**
 * LoadingSplash — Minimal splash screen shown during app initialization.
 *
 * Features:
 * - Shows NetVis branding with loading indicator
 * - Fades out smoothly once ready
 * - Minimum 300ms display time for smooth UX
 * - Uses NetVis design tokens
 * - Respects reduced motion preference
 */

interface LoadingSplashProps {
  /** Whether the app is ready (data loaded) */
  isReady: boolean
  /** Callback when splash animation completes */
  onComplete: () => void
}

export function LoadingSplash({ isReady, onComplete }: LoadingSplashProps): React.JSX.Element {
  const [shouldFadeOut, setShouldFadeOut] = useState(false)
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)

  // Ensure minimum display time of 300ms for smooth UX
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true)
    }, 300)

    return () => clearTimeout(timer)
  }, [])

  // Trigger fade out when both ready and minimum time elapsed
  useEffect(() => {
    if (!isReady || !minTimeElapsed) {
      return undefined
    }

    setShouldFadeOut(true)
    // Wait for fade animation to complete before calling onComplete
    const timer = setTimeout(() => {
      onComplete()
    }, 400) // Match fade-out duration

    return () => clearTimeout(timer)
  }, [isReady, minTimeElapsed, onComplete])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'var(--nv-bg-base)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: shouldFadeOut ? 0 : 1,
        transition: 'opacity 400ms var(--nv-ease-exit)',
        pointerEvents: shouldFadeOut ? 'none' : 'auto'
      }}
      role="status"
      aria-live="polite"
      aria-label="Loading NetVis"
    >
      {/* NetVis Logo/Branding */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--nv-space-6)',
          animation: 'fadeInUp 600ms var(--nv-ease-enter)'
        }}
      >
        {/* Logo Icon - Network visualization symbol */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 'var(--nv-radius-xl)',
            backgroundColor: 'var(--nv-bg-surface-1)',
            border: '2px solid var(--nv-border-emphasis)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--nv-shadow-lg)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Network nodes visualization */}
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {/* Center node */}
            <circle cx="24" cy="24" r="4" fill="var(--proto-tcp)" opacity="0.9" />
            {/* Outer nodes */}
            <circle cx="12" cy="12" r="3" fill="var(--proto-udp)" opacity="0.8" />
            <circle cx="36" cy="12" r="3" fill="var(--proto-dns)" opacity="0.8" />
            <circle cx="12" cy="36" r="3" fill="var(--proto-icmp)" opacity="0.8" />
            <circle cx="36" cy="36" r="3" fill="var(--proto-arp)" opacity="0.8" />
            {/* Connection lines */}
            <line
              x1="24"
              y1="24"
              x2="12"
              y2="12"
              stroke="var(--nv-border-emphasis)"
              strokeWidth="1.5"
              opacity="0.4"
            />
            <line
              x1="24"
              y1="24"
              x2="36"
              y2="12"
              stroke="var(--nv-border-emphasis)"
              strokeWidth="1.5"
              opacity="0.4"
            />
            <line
              x1="24"
              y1="24"
              x2="12"
              y2="36"
              stroke="var(--nv-border-emphasis)"
              strokeWidth="1.5"
              opacity="0.4"
            />
            <line
              x1="24"
              y1="24"
              x2="36"
              y2="36"
              stroke="var(--nv-border-emphasis)"
              strokeWidth="1.5"
              opacity="0.4"
            />
          </svg>

          {/* Pulse animation overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              border: '2px solid var(--proto-tcp)',
              opacity: 0,
              animation: 'pulse-ring 2s var(--nv-ease-spring) infinite'
            }}
          />
        </div>

        {/* App Name */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--nv-space-2)'
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: 32,
              fontWeight: 600,
              color: 'var(--nv-text-primary)',
              margin: 0,
              letterSpacing: '-0.02em'
            }}
          >
            NetVis
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: 14,
              color: 'var(--nv-text-secondary)',
              margin: 0,
              letterSpacing: '0.02em'
            }}
          >
            Network Packet Visualization
          </p>
        </div>

        {/* Loading Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--nv-space-2)',
            marginTop: 'var(--nv-space-4)'
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: 'var(--proto-tcp)',
              animation: 'dot-pulse 1.4s ease-in-out infinite',
              animationDelay: '0s'
            }}
          />
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: 'var(--proto-udp)',
              animation: 'dot-pulse 1.4s ease-in-out infinite',
              animationDelay: '0.2s'
            }}
          />
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: 'var(--proto-dns)',
              animation: 'dot-pulse 1.4s ease-in-out infinite',
              animationDelay: '0.4s'
            }}
          />
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse-ring {
          0% {
            transform: scale(1);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.15);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }

        @keyframes dot-pulse {
          0%, 80%, 100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          40% {
            opacity: 1;
            transform: scale(1.2);
          }
        }

        /* Respect reduced motion preference */
        @media (prefers-reduced-motion: reduce) {
          @keyframes fadeInUp {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes pulse-ring {
            0%, 100% { opacity: 0; }
          }
          @keyframes dot-pulse {
            0%, 100% { opacity: 0.5; }
          }
        }
      `}</style>
    </div>
  )
}
