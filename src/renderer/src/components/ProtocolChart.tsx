import { useMemo } from 'react'
import type React from 'react'
import type { ProtocolName } from '../../../shared/capture-types'
import { PROTOCOL_COLORS, protocolColorKey } from '../constants/protocol-colors'
import { useNetVisStore } from '../store'

const PROTOCOL_ORDER: ProtocolName[] = ['TCP', 'UDP', 'DNS', 'ICMP', 'ARP', 'OTHER']

interface ProtocolEntry {
  name: ProtocolName
  count: number
  percentage: number
  color: string
}

function colorFor(protocol: ProtocolName): string {
  return PROTOCOL_COLORS[protocolColorKey(protocol)].color
}

function filterFor(protocol: ProtocolName): string {
  return `proto == ${protocol}`
}

function protocolDescription(protocol: ProtocolName): string {
  switch (protocol) {
    case 'TCP':
      return 'Connection-based traffic such as web sessions, app requests, and reliable streams.'
    case 'UDP':
      return 'Connectionless traffic often used for DNS, discovery, streaming, or lightweight messages.'
    case 'DNS':
      return 'Name lookups that translate domain names into addresses.'
    case 'ICMP':
      return 'Diagnostic traffic such as ping or delivery errors.'
    case 'ARP':
      return 'Local address lookup traffic used on the same network.'
    default:
      return 'Traffic NetVis could not classify into a more specific protocol.'
  }
}

function distributionInterpretation(entries: ProtocolEntry[]): string {
  const dominant = entries.reduce(
    (best, entry) => (entry.count > best.count ? entry : best),
    entries[0]!
  )
  const udp = entries.find((entry) => entry.name === 'UDP')
  const dns = entries.find((entry) => entry.name === 'DNS')

  if (dominant.count === 0) return 'No protocol distribution is available yet.'
  if (dominant.name === 'TCP') {
    return 'TCP dominates this capture, suggesting connection-based application traffic.'
  }
  if (dominant.name === 'UDP' && (dns?.count ?? 0) === 0) {
    return 'UDP packets are present, but no DNS packets were decoded.'
  }
  if ((udp?.count ?? 0) > 0 && (dns?.count ?? 0) > 0) {
    return 'UDP and DNS appear together, which often means name lookups are part of the capture.'
  }
  return `${dominant.name} is the largest share of this capture at ${dominant.percentage}%.`
}

export function ProtocolChart(): React.JSX.Element {
  const packets = useNetVisStore((s) => s.packets)
  const filterExpression = useNetVisStore((s) => s.filterExpression)
  const setFilter = useNetVisStore((s) => s.setFilter)

  const entries = useMemo<ProtocolEntry[]>(() => {
    const counts = new Map<ProtocolName, number>()
    for (const packet of packets) {
      const protocol = PROTOCOL_ORDER.includes(packet.protocol) ? packet.protocol : 'OTHER'
      counts.set(protocol, (counts.get(protocol) ?? 0) + 1)
    }
    const total = packets.length
    return PROTOCOL_ORDER.map((name) => {
      const count = counts.get(name) ?? 0
      return {
        name,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        color: colorFor(name)
      }
    })
  }, [packets])

  if (packets.length === 0) {
    return (
      <div
        role="status"
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--nv-text-tertiary)',
          fontSize: 13
        }}
      >
        no data yet
      </div>
    )
  }

  return (
    <div
      aria-label="Protocol distribution"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        gap: 7,
        padding: 12,
        overflowY: 'auto'
      }}
    >
      {entries.map((entry) => {
        const filter = filterFor(entry.name)
        const isActive = filterExpression.trim().toUpperCase() === filter.toUpperCase()
        return (
          <button
            key={entry.name}
            type="button"
            title={protocolDescription(entry.name)}
            onClick={() => setFilter(isActive ? '' : filter)}
            className="nv-focus"
            aria-pressed={isActive}
            style={{
              display: 'grid',
              gridTemplateColumns: '10px 44px minmax(0, 1fr) 42px',
              alignItems: 'center',
              gap: 8,
              minHeight: 24,
              width: '100%',
              border: `1px solid ${isActive ? entry.color : 'transparent'}`,
              borderRadius: 'var(--nv-radius-md)',
              backgroundColor: isActive
                ? PROTOCOL_COLORS[protocolColorKey(entry.name)].dim
                : 'transparent',
              padding: '2px 6px',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: entry.color
              }}
            />
            <span
              style={{
                color: 'var(--nv-text-primary)',
                fontFamily: 'var(--font-data)',
                fontSize: 11
              }}
            >
              {entry.name}
            </span>
            <span
              aria-hidden
              style={{
                height: 7,
                borderRadius: 999,
                backgroundColor: 'var(--nv-bg-surface-3)',
                overflow: 'hidden'
              }}
            >
              <span
                style={{
                  display: 'block',
                  width: `${entry.percentage}%`,
                  height: '100%',
                  borderRadius: 999,
                  backgroundColor: entry.color,
                  transition: 'width var(--nv-duration-chart) var(--nv-ease-enter)'
                }}
              />
            </span>
            <span
              style={{
                color: 'var(--nv-text-tertiary)',
                fontFamily: 'var(--font-data)',
                fontSize: 11,
                textAlign: 'right'
              }}
            >
              {entry.percentage}%
            </span>
          </button>
        )
      })}
      <p
        style={{
          margin: '2px 0 0',
          color: 'var(--nv-text-tertiary)',
          fontSize: 11,
          lineHeight: 1.35
        }}
      >
        {distributionInterpretation(entries)}
      </p>
    </div>
  )
}
