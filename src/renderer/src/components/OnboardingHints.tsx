import {
  AlertTriangle,
  Filter,
  ListTree,
  MousePointerClick,
  Network,
  PanelRight,
  X
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { useNetVisStore } from '../store'
import { Button } from './ui/button'

type HintKind =
  | 'first-capture-interface'
  | 'first-capture-packet'
  | 'first-capture-protocol'
  | 'first-capture-inspector'
  | 'buffer-overflow'
  | 'filter-tip'
  | 'pcap-import'
  | 'challenges-first-visit'

interface HintCopy {
  title: string
  body: string
  icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>
  anchor: string
}

const HINTS: Record<HintKind, HintCopy> = {
  'first-capture-interface': {
    title: 'This Is Your Network Interface',
    body: 'Packets captured here come from your Wi-Fi, Ethernet, or another selected adapter.',
    icon: Network,
    anchor: 'Toolbar'
  },
  'first-capture-packet': {
    title: 'Your First Packet',
    body: 'Each row is one packet. It is a small chunk of data your computer sent or received.',
    icon: ListTree,
    anchor: 'Packet List'
  },
  'first-capture-protocol': {
    title: 'This Is The Protocol',
    body: 'Protocols are the rules for how data is formatted and sent.',
    icon: Filter,
    anchor: 'Protocol Badge'
  },
  'first-capture-inspector': {
    title: 'This Is The Packet Inspector',
    body: 'It breaks down exactly what is inside the packet you selected.',
    icon: PanelRight,
    anchor: 'Inspector'
  },
  'buffer-overflow': {
    title: 'Buffer Overflow',
    body: 'Older packets were dropped because the buffer was full. Increase the buffer capacity in Settings if you need more history.',
    icon: AlertTriangle,
    anchor: 'Status Bar'
  },
  'filter-tip': {
    title: 'Filter Tip',
    body: 'Click a protocol row in the chart to filter automatically.',
    icon: Filter,
    anchor: 'Filter Bar'
  },
  'pcap-import': {
    title: 'Imported PCAP File',
    body: 'Packets came from a saved capture. This is not live traffic.',
    icon: MousePointerClick,
    anchor: 'Inspector'
  },
  'challenges-first-visit': {
    title: 'Challenges Use Real Packets',
    body: 'Start a capture first, then come back here, or open a challenge and it will guide you in Capture.',
    icon: ListTree,
    anchor: 'Challenges'
  }
}

function storageKey(kind: HintKind): string {
  return `nv-hint-seen:${kind}`
}

function hasSeen(kind: HintKind): boolean {
  try {
    return localStorage.getItem(storageKey(kind)) === 'true'
  } catch {
    return false
  }
}

function markSeen(kind: HintKind): void {
  try {
    localStorage.setItem(storageKey(kind), 'true')
  } catch {
    // Ignore private-mode storage failures.
  }
}

function hintPosition(kind: HintKind): React.CSSProperties {
  switch (kind) {
    case 'first-capture-interface':
      return { top: 58, left: 172 }
    case 'first-capture-packet':
    case 'first-capture-protocol':
      return { top: 128, left: 92 }
    case 'first-capture-inspector':
    case 'pcap-import':
      return { top: 86, right: 18 }
    case 'filter-tip':
      return { top: 58, left: 620 }
    case 'challenges-first-visit':
      return { top: 76, left: 112 }
    case 'buffer-overflow':
    default:
      return { right: 18, bottom: 38 }
  }
}

export function OnboardingHints(): React.JSX.Element | null {
  const welcomeSeen = useNetVisStore((s) => s.welcomeSeen)
  const activePage = useNetVisStore((s) => s.activePage)
  const captureStatus = useNetVisStore((s) => s.captureStatus)
  const packets = useNetVisStore((s) => s.packets)
  const selectedPacketId = useNetVisStore((s) => s.selectedPacketId)
  const filterExpression = useNetVisStore((s) => s.filterExpression)
  const bufferOverflowCount = useNetVisStore((s) => s.bufferOverflowCount)
  const importResult = useNetVisStore((s) => s.importResult)
  const [dismissed, setDismissed] = useState<Set<HintKind>>(() => new Set())

  const firstCaptureActive =
    activePage === 'capture' &&
    (captureStatus.state === 'active' || captureStatus.state === 'simulated')

  const nextHint = useMemo<HintKind | null>(() => {
    if (!welcomeSeen) return null

    const candidates: HintKind[] = []

    if (firstCaptureActive && !hasSeen('first-capture-interface')) {
      candidates.push('first-capture-interface')
    }
    if (firstCaptureActive && packets.length > 0 && !hasSeen('first-capture-packet')) {
      candidates.push('first-capture-packet')
    }
    if (firstCaptureActive && packets.length > 0 && !hasSeen('first-capture-protocol')) {
      candidates.push('first-capture-protocol')
    }
    if (selectedPacketId && !hasSeen('first-capture-inspector')) {
      candidates.push('first-capture-inspector')
    }
    if (bufferOverflowCount > 0 && !hasSeen('buffer-overflow')) {
      candidates.push('buffer-overflow')
    }
    if (filterExpression.trim() && !hasSeen('filter-tip')) {
      candidates.push('filter-tip')
    }
    if (importResult && !hasSeen('pcap-import')) {
      candidates.push('pcap-import')
    }
    if (activePage === 'challenges' && !hasSeen('challenges-first-visit')) {
      candidates.push('challenges-first-visit')
    }

    return candidates.find((kind) => !dismissed.has(kind)) ?? null
  }, [
    activePage,
    bufferOverflowCount,
    dismissed,
    filterExpression,
    firstCaptureActive,
    importResult,
    packets.length,
    selectedPacketId,
    welcomeSeen
  ])

  useEffect(() => {
    if (nextHint !== 'filter-tip') return
    const timer = window.setTimeout(() => {
      markSeen(nextHint)
      setDismissed((current) => new Set(current).add(nextHint))
    }, 4000)

    const dismissOnInteraction = (): void => {
      markSeen(nextHint)
      setDismissed((current) => new Set(current).add(nextHint))
    }

    window.addEventListener('pointerdown', dismissOnInteraction, { once: true })
    window.addEventListener('keydown', dismissOnInteraction, { once: true })

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', dismissOnInteraction)
      window.removeEventListener('keydown', dismissOnInteraction)
    }
  }, [nextHint])

  if (!nextHint) return null

  const hint = HINTS[nextHint]
  const Icon = hint.icon
  const position = hintPosition(nextHint)

  const dismiss = (): void => {
    markSeen(nextHint)
    setDismissed((current) => new Set(current).add(nextHint))
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        ...position,
        zIndex: 'var(--nv-z-popover)',
        width: 320,
        maxWidth: 'calc(100vw - 36px)',
        padding: 14,
        border: '1px solid var(--nv-accent-border)',
        borderRadius: 'var(--nv-radius-lg)',
        backgroundColor: 'var(--nv-bg-surface-1)',
        boxShadow: 'var(--nv-shadow-overlay)',
        display: 'grid',
        gap: 10
      }}
    >
      <div style={{ display: 'flex', alignItems: 'start', gap: 10 }}>
        <span
          aria-hidden
          style={{
            width: 30,
            height: 30,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 'var(--nv-radius-md)',
            backgroundColor: 'var(--nv-accent-dim)',
            color: 'var(--nv-accent)'
          }}
        >
          <Icon size={16} aria-hidden />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: 'var(--nv-text-tertiary)', fontSize: 11 }}>{hint.anchor}</div>
          <h2 style={{ margin: '2px 0 4px', color: 'var(--nv-text-primary)', fontSize: 14 }}>
            {hint.title}
          </h2>
          <p
            style={{ margin: 0, color: 'var(--nv-text-secondary)', fontSize: 12, lineHeight: 1.5 }}
          >
            {hint.body}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss hint"
          className="nv-focus"
          style={{
            width: 24,
            height: 24,
            display: 'grid',
            placeItems: 'center',
            border: '1px solid transparent',
            borderRadius: 'var(--nv-radius-sm)',
            background: 'transparent',
            color: 'var(--nv-text-tertiary)',
            cursor: 'pointer'
          }}
        >
          <X size={14} aria-hidden />
        </button>
      </div>
      <Button size="sm" variant="outline" onClick={dismiss} style={{ justifyContent: 'center' }}>
        Got It
      </Button>
    </aside>
  )
}
