import { AlertTriangle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import type { CaptureStatus } from '../../../shared/capture-types'
import { useNetVisStore } from '../store'
import { hideInterfaceAddress } from '../lib/interface-display'

function modeLabel(status: CaptureStatus): string {
  switch (status.state) {
    case 'active':
      return 'live'
    case 'file':
      return 'file'
    case 'simulated':
      return 'replay'
    case 'error':
      return 'error'
    case 'stopped':
      return 'stopped'
    case 'idle':
    default:
      return 'idle'
  }
}

function dotColor(status: CaptureStatus): string {
  switch (status.state) {
    case 'active':
      return 'var(--nv-status-success)'
    case 'file':
    case 'simulated':
      return 'var(--nv-status-warning)'
    case 'error':
      return 'var(--nv-status-error)'
    default:
      return 'var(--color-idle, var(--nv-text-tertiary))'
  }
}

function sourceLabel(status: CaptureStatus, activeInterface: string | null, interfaces: { name: string; displayName: string }[]): string {
  const resolve = (raw: string): string => {
    const found = interfaces.find((iface) => iface.name === raw)
    return hideInterfaceAddress(found ? found.displayName : raw)
  }
  if (status.state === 'active') return resolve(status.iface)
  if (status.state === 'file' || status.state === 'simulated') {
    return status.path.split(/[\\/]/).pop() ?? status.path
  }
  return activeInterface ? resolve(activeInterface) : 'no interface'
}

function useLiveDataRateKb(): number {
  const packets = useNetVisStore((s) => s.packets)
  const captureStatus = useNetVisStore((s) => s.captureStatus)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (captureStatus.state !== 'active') return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [captureStatus.state])

  return useMemo(() => {
    if (captureStatus.state !== 'active') return 0
    const cutoff = now - 1000
    const bytes = packets.reduce((sum, packet) => {
      if (packet.timestamp < cutoff) return sum
      return sum + (packet.wireLength || packet.length || 0)
    }, 0)
    return bytes / 1024
  }, [captureStatus.state, now, packets])
}

export function StatusBar(): React.JSX.Element {
  const captureStatus = useNetVisStore((s) => s.captureStatus)
  const activeInterface = useNetVisStore((s) => s.activeInterface)
  const interfaces = useNetVisStore((s) => s.interfaces)
  const packets = useNetVisStore((s) => s.packets)
  const bufferStats = useNetVisStore((s) => s.bufferStats)
  const bufferOverflowCount = useNetVisStore((s) => s.bufferOverflowCount)
  const dataRateKb = useLiveDataRateKb()
  const [overflowVisible, setOverflowVisible] = useState(false)
  const overflowTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (bufferOverflowCount > 0) {
      setOverflowVisible(true)
      if (overflowTimer.current) clearTimeout(overflowTimer.current)
      overflowTimer.current = setTimeout(() => setOverflowVisible(false), 5000)
    }

    return () => {
      if (overflowTimer.current) {
        clearTimeout(overflowTimer.current)
        overflowTimer.current = null
      }
    }
  }, [bufferOverflowCount])

  const cellStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    color: 'var(--nv-text-secondary)',
    fontSize: 11,
    whiteSpace: 'nowrap'
  }

  return (
    <footer
      role="contentinfo"
      aria-label="Status bar"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
        alignItems: 'center',
        gap: 16,
        height: 28,
        padding: '0 12px',
        backgroundColor: 'var(--nv-bg-surface-1)',
        borderTop: '1px solid var(--nv-border-subtle)',
        flexShrink: 0,
        overflow: 'hidden'
      }}
    >
      <div style={{ ...cellStyle, justifyContent: 'flex-start' }}>
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            backgroundColor: dotColor(captureStatus),
            boxShadow: captureStatus.state === 'active' ? '0 0 0 3px rgba(63, 185, 80, 0.12)' : undefined,
            flexShrink: 0
          }}
        />
        <span style={{ color: 'var(--nv-text-primary)' }}>{modeLabel(captureStatus)}</span>
        <span
          title={sourceLabel(captureStatus, activeInterface, interfaces)}
          style={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {sourceLabel(captureStatus, activeInterface, interfaces)}
        </span>
      </div>

      <div style={{ ...cellStyle, justifyContent: 'center', fontFamily: 'var(--font-data)' }}>
        <span>{packets.length.toLocaleString()} packets</span>
        <span aria-hidden style={{ color: 'var(--nv-border-emphasis)' }}>
          ·
        </span>
        <span>{captureStatus.state === 'active' ? `${dataRateKb.toFixed(1)} KB/s` : '0.0 KB/s'}</span>
      </div>

      <div style={{ ...cellStyle, justifyContent: 'flex-end', fontFamily: 'var(--font-data)' }}>
        <span>buffer {Math.round(bufferStats.percentage)}%</span>
        {overflowVisible && (
          <span
            role="status"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              color: 'var(--nv-status-warning)',
              fontFamily: 'var(--font-ui)',
              fontSize: 11
            }}
          >
            <AlertTriangle size={12} aria-hidden />
            overflow
          </span>
        )}
      </div>
    </footer>
  )
}
