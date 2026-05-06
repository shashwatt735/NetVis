import type React from 'react'
import { X } from 'lucide-react'
import { useNetVisStore } from '../store'
import { CaptureToolbarActions } from './CaptureToolbarActions'
import { FilterBar } from './FilterBar'
import { InterfaceSelector } from './InterfaceSelector'
import { describeFilterExpression } from '../lib/packet-analysis'

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
      <span
        aria-hidden
        style={{
          width: 1,
          height: 20,
          backgroundColor: 'var(--nv-border-default)',
          flexShrink: 0
        }}
      />
      <div style={{ flexShrink: 0 }}>
        <InterfaceSelector />
      </div>
      <ActiveFilterChip />
      <div style={{ flex: '1 1 320px', minWidth: 180, maxWidth: 'none' }}>
        <FilterBar />
      </div>
    </>
  )
}

function ActiveFilterChip(): React.JSX.Element | null {
  const packets = useNetVisStore((s) => s.packets)
  const filteredPackets = useNetVisStore((s) => s.filteredPackets)
  const filterExpression = useNetVisStore((s) => s.filterExpression)
  const filterError = useNetVisStore((s) => s.filterError)
  const setFilter = useNetVisStore((s) => s.setFilter)
  const active = filterExpression.trim().length > 0

  if (!active) return null

  const filterLabel = describeFilterExpression(filterExpression)
  const visibleCount = filterError ? packets.length : filteredPackets.length

  return (
    <div
      role="status"
      aria-label={`Active filter: ${filterLabel}`}
      style={{
        minWidth: 0,
        maxWidth: 280,
        height: 30,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '0 7px 0 10px',
        border: '1px solid var(--nv-accent-border)',
        borderRadius: 'var(--nv-radius-md)',
        backgroundColor: 'var(--nv-accent-dim)',
        color: 'var(--nv-text-primary)',
        flexShrink: 1
      }}
    >
      <span
        style={{
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 12,
          fontWeight: 650
        }}
      >
        {filterLabel}
      </span>
      <span
        style={{
          color: 'var(--nv-text-secondary)',
          fontFamily: 'var(--font-data)',
          fontSize: 11,
          whiteSpace: 'nowrap'
        }}
      >
        {visibleCount.toLocaleString()}/{packets.length.toLocaleString()}
      </span>
      <button
        type="button"
        onClick={() => setFilter('')}
        aria-label="Clear active filter"
        className="nv-focus"
        style={{
          width: 18,
          height: 18,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          border: 'none',
          borderRadius: 'var(--nv-radius-sm)',
          background: 'transparent',
          color: 'var(--nv-text-tertiary)',
          cursor: 'pointer',
          padding: 0
        }}
      >
        <X size={12} aria-hidden />
      </button>
    </div>
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
        gap: 8,
        height: 42,
        padding: '0 12px',
        backgroundColor: 'var(--nv-bg-base)',
        borderBottom: '1px solid var(--nv-border-default)',
        flexShrink: 0,
        overflow: 'visible',
        minWidth: 0
      }}
    >

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
