import { useCallback, useEffect, useMemo, useRef } from 'react'
import type React from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { AnonPacket } from '../../../shared/capture-types'
import { PROTOCOL_COLORS, protocolColorKey } from '../constants/protocol-colors'
import { ANIMATION } from '../constants/animations'
import { formatRelativeTimestamp, getPacketRoleInfo } from '../lib/packet-analysis'
import { useNetVisStore } from '../store'
import { ProtocolBadge } from './domain'

function captureStartMs(packets: AnonPacket[]): number {
  if (packets.length === 0) return Date.now()
  return packets.reduce((min, packet) => Math.min(min, packet.timestamp), packets[0]!.timestamp)
}

function roleColors(packet: AnonPacket): { color: string; dim: string; border: string } {
  const token = PROTOCOL_COLORS[protocolColorKey(packet.protocol)]
  return { color: token.color, dim: token.dim, border: token.border }
}

interface RowProps {
  packet: AnonPacket
  index: number
  startMs: number
  isSelected: boolean
  isDimmed: boolean
  isNew: boolean
  totalPackets: number
  onSelect: (id: string) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>, index: number) => void
}

function RoleBadge({ packet }: { packet: AnonPacket }): React.JSX.Element {
  const roleInfo = getPacketRoleInfo(packet)
  const role = roleInfo.tableLabel
  if (!role) {
    return (
      <span aria-label="No role" style={{ color: 'var(--nv-text-tertiary)' }}>
        —
      </span>
    )
  }
  const token = PROTOCOL_COLORS[protocolColorKey(packet.protocol)]
  return (
    <span
      title={roleInfo.description}
      aria-label={roleInfo.description}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 18,
        maxWidth: '100%',
        padding: '0 5px',
        borderRadius: 'var(--nv-radius-sm)',
        border: `1px solid ${token.border}`,
        backgroundColor: token.dim,
        color: token.color,
        fontFamily: 'var(--font-data)',
        fontSize: 9.5,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}
    >
      {role}
    </span>
  )
}

function PacketRow({
  packet,
  index,
  startMs,
  isSelected,
  isDimmed,
  isNew,
  totalPackets,
  onSelect,
  onKeyDown
}: RowProps): React.JSX.Element {
  const colors = roleColors(packet)
  const roleInfo = getPacketRoleInfo(packet)
  const timeLabel = formatRelativeTimestamp(packet.timestamp, startMs)

  return (
    <div
      id={`packet-option-${packet.id}`}
      role="option"
      aria-selected={isSelected}
      aria-posinset={index + 1}
      aria-setsize={totalPackets}
      aria-label={`${packet.protocol} ${roleInfo.tableLabel} packet at ${timeLabel}, from ${packet.srcAddress} to ${packet.dstAddress}, ${packet.length} bytes`}
      tabIndex={isSelected ? 0 : -1}
      onClick={() => onSelect(packet.id)}
      onKeyDown={(event) => onKeyDown(event, index)}
      className="nv-focus"
      style={{
        display: 'grid',
        gridTemplateColumns: '72px 56px 92px 18px minmax(132px, 1fr) minmax(132px, 1fr) 52px',
        alignItems: 'center',
        minHeight: 32,
        padding: '0 8px',
        gap: 14,
        cursor: 'pointer',
        opacity: isDimmed ? 0.38 : 1,
        backgroundColor: isSelected ? colors.dim : 'transparent',
        borderLeft: isSelected ? `2px solid ${colors.color}` : '2px solid transparent',
        borderBottom: '1px solid var(--nv-border-subtle)',
        animation: isNew
          ? `nv-row-in ${ANIMATION.ROW_FADE_IN_MS}ms var(--nv-ease-enter) both`
          : undefined,
        transition: 'background-color 80ms ease, opacity 80ms ease'
      }}
    >
      <span
        title="Time since the first packet in this capture."
        style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--nv-text-tertiary)' }}
      >
        {timeLabel}
      </span>
      <ProtocolBadge proto={packet.protocol} size="sm" />
      <RoleBadge packet={packet} />
      <span aria-hidden style={{ width: 0 }} />
      <span
        style={{
          fontFamily: 'var(--font-data)',
          fontSize: 12,
          color: 'var(--nv-text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {packet.srcAddress}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-data)',
          fontSize: 12,
          color: 'var(--nv-text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {packet.dstAddress}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-data)',
          fontSize: 11,
          color: 'var(--nv-text-tertiary)',
          textAlign: 'right',
          whiteSpace: 'nowrap'
        }}
      >
        {packet.length}
      </span>
    </div>
  )
}

function PacketListHeader(): React.JSX.Element {
  const headers: Array<{ label: string; align: 'left' | 'center' | 'right'; title?: string }> = [
    {
      label: 'TIME',
      align: 'left' as const,
      title: 'Time since the first packet in this capture.'
    },
    { label: 'PROTOCOL', align: 'center' as const },
    { label: 'ROLE', align: 'center' as const },
    { label: '', align: 'left' as const }, // spacer
    { label: 'SOURCE', align: 'left' as const },
    { label: 'DESTINATION', align: 'left' as const },
    { label: 'LENGTH', align: 'right' as const }
  ]
  return (
    <div
      aria-hidden
      style={{
        display: 'grid',
        gridTemplateColumns: '72px 56px 92px 18px minmax(132px, 1fr) minmax(132px, 1fr) 52px',
        alignItems: 'center',
        height: 28,
        padding: '0 8px',
        gap: 14,
        backgroundColor: 'var(--nv-bg-surface-2)',
        borderBottom: '1px solid var(--nv-border-default)',
        flexShrink: 0
      }}
    >
      {headers.map((header, index) => (
        <span
          key={`${header.label}-${index}`}
          title={header.title}
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: 'var(--nv-text-tertiary)',
            textAlign: header.align
          }}
        >
          {header.label}
        </span>
      ))}
    </div>
  )
}

export function PacketList(): React.JSX.Element {
  const packets = useNetVisStore((s) => s.packets)
  const filteredPackets = useNetVisStore((s) => s.filteredPackets)
  const selectedPacketId = useNetVisStore((s) => s.selectedPacketId)
  const filterExpression = useNetVisStore((s) => s.filterExpression)
  const captureStatus = useNetVisStore((s) => s.captureStatus)
  const selectPacket = useNetVisStore((s) => s.selectPacket)
  const parentRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)
  const newIdsRef = useRef<Set<string>>(new Set())

  const filterActive = filterExpression.trim().length > 0
  const filteredIds = useMemo(
    () => new Set(filteredPackets.map((packet) => packet.id)),
    [filteredPackets]
  )
  const displayPackets = filterActive ? filteredPackets : packets
  const startMs = useMemo(() => captureStartMs(packets), [packets])
  const isCapturing =
    captureStatus.state === 'active' ||
    captureStatus.state === 'file' ||
    captureStatus.state === 'simulated'

  useEffect(() => {
    const prev = prevCountRef.current
    const curr = displayPackets.length
    if (curr > prev) {
      const newSlice = displayPackets.slice(prev)
      newSlice.forEach((packet) => newIdsRef.current.add(packet.id))
      const timer = setTimeout(() => {
        newSlice.forEach((packet) => newIdsRef.current.delete(packet.id))
      }, ANIMATION.ROW_FADE_IN_MS + 50)
      prevCountRef.current = curr
      return () => clearTimeout(timer)
    }
    prevCountRef.current = curr
    return undefined
  }, [displayPackets])

  const virtualizer = useVirtualizer({
    count: displayPackets.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 10
  })

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
    if (wasAtBottomRef.current && displayPackets.length > 0 && isCapturing) {
      virtualizer.scrollToIndex(displayPackets.length - 1, { align: 'end' })
    }
  }, [displayPackets.length, isCapturing, virtualizer])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, index: number) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter') return
      event.preventDefault()
      if (event.key === 'Enter') {
        const packet = displayPackets[index]
        if (packet) selectPacket(packet.id)
        return
      }
      const nextIndex =
        event.key === 'ArrowDown'
          ? Math.min(index + 1, displayPackets.length - 1)
          : Math.max(index - 1, 0)
      const nextPacket = displayPackets[nextIndex]
      if (nextPacket) {
        selectPacket(nextPacket.id)
        virtualizer.scrollToIndex(nextIndex, { align: 'auto' })
      }
    },
    [displayPackets, selectPacket, virtualizer]
  )

  if (packets.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <PacketListHeader />
        <div
          role="status"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: 'var(--nv-text-tertiary)',
            textAlign: 'center',
            fontSize: 13
          }}
        >
          <strong style={{ color: 'var(--nv-text-primary)', fontSize: 15, fontWeight: 600 }}>
            No packets yet
          </strong>
          <span>
            Start a live capture, replay, or import a PCAP file
            <br />
            to begin.
          </span>
        </div>
      </div>
    )
  }

  if (filterActive && filteredPackets.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <PacketListHeader />
        <div
          role="status"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: 'var(--nv-text-tertiary)',
            textAlign: 'center',
            fontSize: 13
          }}
        >
          <strong style={{ color: 'var(--nv-text-primary)', fontSize: 15, fontWeight: 600 }}>
            No packets match "{filterExpression}"
          </strong>
          <span>Clear the filter to see all packets</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PacketListHeader />
      <div
        ref={parentRef}
        role="listbox"
        aria-label="Packet list"
        aria-activedescendant={selectedPacketId ? `packet-option-${selectedPacketId}` : undefined}
        tabIndex={0}
        style={{ flex: 1, overflow: 'auto', outline: 'none' }}
        onKeyDown={(event) => {
          const selectedIndex = selectedPacketId
            ? displayPackets.findIndex((packet) => packet.id === selectedPacketId)
            : -1
          if (selectedIndex >= 0) handleKeyDown(event, selectedIndex)
        }}
      >
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const packet = displayPackets[virtualRow.index]
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
                  index={virtualRow.index}
                  startMs={startMs}
                  isSelected={packet.id === selectedPacketId}
                  isDimmed={filterActive && !filteredIds.has(packet.id)}
                  isNew={newIdsRef.current.has(packet.id)}
                  totalPackets={displayPackets.length}
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
