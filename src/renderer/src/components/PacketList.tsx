import { useCallback, useEffect, useRef } from 'react'
import type React from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useNetVisStore } from '../store'
import type { AnonPacket } from '../../../shared/capture-types'
import { PROTOCOL_COLORS, protocolColorKey } from '../constants/protocol-colors'
import { ANIMATION } from '../constants/animations'
import { ProtocolBadge } from './domain'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  const ss = d.getSeconds().toString().padStart(2, '0')
  const ms = d.getMilliseconds().toString().padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

function formatPacketAriaLabel(packet: AnonPacket): string {
  return `${formatTimestamp(packet.timestamp)}, from ${packet.srcAddress} to ${packet.dstAddress}, ${packet.protocol}, ${packet.length} bytes`
}

function protoColor(proto: string): string {
  const key = protocolColorKey(proto)
  return PROTOCOL_COLORS[key].color
}

function protoDim(proto: string): string {
  const key = protocolColorKey(proto)
  return PROTOCOL_COLORS[key].dim
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface RowProps {
  packet: AnonPacket
  isSelected: boolean
  isNew: boolean
  index: number
  totalPackets: number
  onSelect: (id: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, index: number) => void
}

function PacketRow({
  packet,
  isSelected,
  isNew,
  index,
  totalPackets,
  onSelect,
  onKeyDown
}: RowProps): React.JSX.Element {
  const color = protoColor(packet.protocol)
  const dim = protoDim(packet.protocol)

  return (
    <div
      id={`packet-option-${packet.id}`}
      role="option"
      aria-selected={isSelected}
      aria-posinset={index + 1}
      aria-setsize={totalPackets}
      aria-label={formatPacketAriaLabel(packet)}
      tabIndex={isSelected ? 0 : -1}
      onClick={() => onSelect(packet.id)}
      onKeyDown={(e) => onKeyDown(e, index)}
      style={{
        display: 'grid',
        gridTemplateColumns: '110px 1fr 1fr 60px 60px',
        alignItems: 'center',
        height: 36,
        padding: '0 12px',
        gap: 8,
        cursor: 'pointer',
        backgroundColor: isSelected ? dim : 'transparent',
        borderLeft: isSelected ? `2px solid ${color}` : '2px solid transparent',
        borderBottom: '1px solid var(--nv-border-subtle)',
        animation: isNew
          ? `nv-row-in ${ANIMATION.ROW_FADE_IN_MS}ms var(--nv-ease-enter) both`
          : undefined,
        outline: 'none',
        transition: 'background-color 80ms ease'
      }}
      // Focus ring via CSS class
      className="nv-focus"
    >
      {/* Timestamp */}
      <span
        style={{
          fontFamily: 'var(--font-data)',
          fontSize: 11,
          color: 'var(--nv-text-tertiary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {formatTimestamp(packet.timestamp)}
      </span>

      {/* Source */}
      <span
        style={{
          fontFamily: 'var(--font-data)',
          fontSize: 12,
          color: 'var(--nv-text-secondary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {packet.srcAddress}
      </span>

      {/* Destination */}
      <span
        style={{
          fontFamily: 'var(--font-data)',
          fontSize: 12,
          color: 'var(--nv-text-secondary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {packet.dstAddress}
      </span>

      {/* Protocol badge */}
      <span>
        <ProtocolBadge proto={packet.protocol} size="sm" />
      </span>

      {/* Length */}
      <span
        style={{
          fontFamily: 'var(--font-data)',
          fontSize: 11,
          color: 'var(--nv-text-tertiary)',
          textAlign: 'right',
          whiteSpace: 'nowrap'
        }}
      >
        {packet.length}B
      </span>
    </div>
  )
}

// ─── Header ──────────────────────────────────────────────────────────────────

function PacketListHeader(): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      style={{
        display: 'grid',
        gridTemplateColumns: '110px 1fr 1fr 60px 60px',
        alignItems: 'center',
        height: 28,
        padding: '0 12px',
        gap: 8,
        backgroundColor: 'var(--nv-bg-surface-2)',
        borderBottom: '1px solid var(--nv-border-default)',
        flexShrink: 0
      }}
    >
      {(['Time', 'Source', 'Destination', 'Proto', 'Len'] as const).map((label) => (
        <span
          key={label}
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--nv-text-tertiary)'
          }}
        >
          {label}
        </span>
      ))}
    </div>
  )
}

// ─── PacketList ───────────────────────────────────────────────────────────────

/**
 * Virtualized packet list.
 * Req 5.1–5.5, 16.1, 16.3, 21.1
 * - useVirtualizer: estimateSize 36, overscan 10
 * - Row fade-in animation on new packets
 * - Keyboard navigation: arrow keys + Enter
 * - Accessible listbox semantics for packet selection
 * - Empty placeholder (Req 5.4)
 * - Filter-empty message (Req 20.5)
 */
export function PacketList(): React.JSX.Element {
  const filteredPackets = useNetVisStore((s) => s.filteredPackets)
  const packets = useNetVisStore((s) => s.packets)
  const selectedPacketId = useNetVisStore((s) => s.selectedPacketId)
  const filterExpression = useNetVisStore((s) => s.filterExpression)
  const captureStatus = useNetVisStore((s) => s.captureStatus)
  const selectPacket = useNetVisStore((s) => s.selectPacket)

  const isCapturing =
    captureStatus.state === 'active' ||
    captureStatus.state === 'file' ||
    captureStatus.state === 'simulated'

  const parentRef = useRef<HTMLDivElement>(null)
  // Track which packet IDs are "new" for the fade-in animation
  const prevCountRef = useRef(0)
  const newIdsRef = useRef<Set<string>>(new Set())

  // Mark newly arrived packets
  useEffect(() => {
    const prev = prevCountRef.current
    const curr = filteredPackets.length
    if (curr > prev) {
      const newSlice = filteredPackets.slice(prev)
      newSlice.forEach((p) => newIdsRef.current.add(p.id))
      // Clear "new" flag after animation completes
      const timer = setTimeout(() => {
        newSlice.forEach((p) => newIdsRef.current.delete(p.id))
      }, ANIMATION.ROW_FADE_IN_MS + 50)
      prevCountRef.current = curr
      return () => clearTimeout(timer)
    }
    prevCountRef.current = curr
    return undefined
  }, [filteredPackets])

  const virtualizer = useVirtualizer({
    count: filteredPackets.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 10
  })

  // Auto-scroll to bottom when new packets arrive (only if already near bottom)
  const wasAtBottomRef = useRef(true)
  useEffect(() => {
    const el = parentRef.current
    if (!el) return
    const handleScroll = (): void => {
      wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (wasAtBottomRef.current && filteredPackets.length > 0 && isCapturing) {
      virtualizer.scrollToIndex(filteredPackets.length - 1, { align: 'end' })
    }
  }, [filteredPackets.length, virtualizer, isCapturing])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, index: number) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = Math.min(index + 1, filteredPackets.length - 1)
        const nextPacket = filteredPackets[next]
        if (nextPacket) {
          selectPacket(nextPacket.id)
          virtualizer.scrollToIndex(next, { align: 'auto' })
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = Math.max(index - 1, 0)
        const prevPacket = filteredPackets[prev]
        if (prevPacket) {
          selectPacket(prevPacket.id)
          virtualizer.scrollToIndex(prev, { align: 'auto' })
        }
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const packet = filteredPackets[index]
        if (packet) selectPacket(packet.id)
      }
    },
    [filteredPackets, selectPacket, virtualizer]
  )

  // ── Empty states ──────────────────────────────────────────────────────────

  // No packets at all (Req 5.4)
  if (packets.length === 0) {
    const waitingForTraffic = isCapturing
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden'
        }}
      >
        <PacketListHeader />
        <div
          role="status"
          aria-label="No packets captured"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: 'var(--nv-text-tertiary)',
            fontFamily: 'var(--font-ui)',
            fontSize: 13
          }}
        >
          <span style={{ fontSize: 28 }}>📡</span>
          <span>{waitingForTraffic ? 'Capture is running. Waiting for packets...' : 'No packets captured yet.'}</span>
          <span style={{ fontSize: 11, textAlign: 'center', maxWidth: 320 }}>
            {waitingForTraffic
              ? 'If this stays empty, choose a different adapter (prefer Ethernet/Wi-Fi over Loopback/virtual) and generate traffic by opening a website or running ping.'
              : 'Select an interface and press Start to begin.'}
          </span>
        </div>
      </div>
    )
  }

  // Packets exist but filter returns nothing (Req 20.5)
  if (filteredPackets.length === 0 && filterExpression.trim()) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden'
        }}
      >
        <PacketListHeader />
        <div
          role="status"
          aria-label="No packets match filter"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: 'var(--nv-text-tertiary)',
            fontFamily: 'var(--font-ui)',
            fontSize: 13
          }}
        >
          <span style={{ fontSize: 28 }}>🔍</span>
          <span>No packets match the current filter.</span>
          <span style={{ fontSize: 11 }}>Try clearing or modifying the filter expression.</span>
        </div>
      </div>
    )
  }

  // ── Virtualized list ──────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      <PacketListHeader />

      {/* Scrollable viewport */}
      <div
        ref={parentRef}
        role="listbox"
        aria-label="Packet list"
        aria-activedescendant={
          selectedPacketId ? `packet-option-${selectedPacketId}` : undefined
        }
        tabIndex={0}
        style={{
          flex: 1,
          overflow: 'auto',
          outline: 'none'
        }}
        onKeyDown={(e) => {
          // Handle keyboard nav when the grid container itself is focused
          const selectedIndex = selectedPacketId
            ? filteredPackets.findIndex((p) => p.id === selectedPacketId)
            : -1
          if (selectedIndex >= 0) {
            handleKeyDown(e, selectedIndex)
          } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && filteredPackets.length > 0) {
            e.preventDefault()
            const first = filteredPackets[0]
            if (first) selectPacket(first.id)
          }
        }}
      >
        {/* Total height spacer */}
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const packet = filteredPackets[virtualRow.index]
            if (!packet) return null
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                <PacketRow
                  packet={packet}
                  isSelected={packet.id === selectedPacketId}
                  isNew={newIdsRef.current.has(packet.id)}
                  index={virtualRow.index}
                  totalPackets={filteredPackets.length}
                  onSelect={selectPacket}
                  onKeyDown={handleKeyDown}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
