import type React from 'react'
import { useNetVisStore } from '../store'
import { CaptureToolbarActions, ReplaySpeedControl } from './CaptureToolbarActions'
import { FilterBar } from './FilterBar'
import { InterfaceSelector } from './InterfaceSelector'

const PAGE_LABELS = {
  capture: 'Capture',
  learn: 'Learn',
  challenges: 'Challenges',
  settings: 'Settings'
} as const

function CaptureToolbar(): React.JSX.Element {
  return (
    <>
      <CaptureToolbarActions />
      <InterfaceSelector />
      <div style={{ flex: 1, minWidth: 220, maxWidth: 560 }}>
        <FilterBar />
      </div>
      <ReplaySpeedControl />
    </>
  )
}

/**
 * Page-level toolbar. Navigation and app preferences live in the sidebar/pages.
 */
export function Toolbar(): React.JSX.Element {
  const activePage = useNetVisStore((s) => s.activePage)

  return (
    <header
      role="banner"
      aria-label={`${PAGE_LABELS[activePage]} toolbar`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 44,
        padding: '0 12px',
        backgroundColor: 'var(--nv-bg-surface-1)',
        borderBottom: '1px solid var(--nv-border-default)',
        flexShrink: 0,
        overflow: 'visible'
      }}
    >
      <div
        style={{
          width: 118,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'baseline',
          gap: 8
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--nv-text-primary)',
            letterSpacing: 0
          }}
        >
          Net<span style={{ color: 'var(--proto-tcp)' }}>Vis</span>
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--nv-text-tertiary)'
          }}
        >
          {PAGE_LABELS[activePage]}
        </span>
      </div>

      {activePage === 'capture' ? (
        <CaptureToolbar />
      ) : (
        <span style={{ color: 'var(--nv-text-secondary)', fontSize: 13, fontWeight: 600 }}>
          {activePage === 'learn'
            ? 'Browse concepts and jump back to live packets'
            : activePage === 'challenges'
              ? 'Choose a guided exercise, then prove it in capture'
              : 'Change app preferences and replay guides'}
        </span>
      )}
    </header>
  )
}
