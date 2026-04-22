import { FileText } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import type { CaptureStatus } from '../../../shared/capture-types'
import { useNetVisStore } from '../store'
import { StatusPill } from './domain'

function formatElapsed(startedAt: number): string {
  const secs = Math.floor((Date.now() - startedAt) / 1000)
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Plain-English status message for the current capture state.
 * Req 20.3 (idle), Req 20.4 (active)
 */
function CaptureStatusMessage({ status }: { status: CaptureStatus }): React.JSX.Element {
  const [elapsed, setElapsed] = useState('')
  const interfaces = useNetVisStore((s) => s.interfaces)
  const hasInterfaces = interfaces.length > 0

  useEffect(() => {
    if (status.state !== 'active') {
      setElapsed('')
      return
    }

    const tick = (): void => setElapsed(formatElapsed(status.startedAt))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [status])

  let message: string

  switch (status.state) {
    case 'idle':
      message = hasInterfaces
        ? 'Select a network interface and press Start to begin capturing packets.'
        : 'Live capture unavailable — use Import or Replay to load a saved PCAP file.'
      break
    case 'active':
      message = `Capturing on ${status.iface} (${elapsed})`
      break
    case 'file':
      message = 'Reading file'
      break
    case 'simulated':
      message = `Simulated replay at ${status.speed}x speed`
      break
    case 'error':
      message = status.message
      break
    case 'stopped':
      message = 'Capture stopped. Buffer retained — press Start to capture again.'
      break
    default:
      message = ''
  }

  if (status.state === 'error') {
    const fullMessage = status.platformHint ? `${message} - ${status.platformHint}` : message
    return <StatusPill status="error" label={fullMessage} />
  }

  return (
    <span
      style={{
        fontSize: 11,
        fontFamily: 'var(--font-ui)',
        color: 'var(--nv-text-secondary)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: 420
      }}
    >
      {message}
    </span>
  )
}

/**
 * Shows current buffer fill as "N / M packets (X%)".
 * Req 12.3 - updated at most every 500 ms (driven by IPC push).
 */
function BufferOccupancy(): React.JSX.Element {
  const { count, capacity, percentage } = useNetVisStore((s) => s.bufferStats)

  return (
    <span
      aria-label={`Buffer: ${count} of ${capacity} packets (${Math.round(percentage)}%)`}
      style={{
        fontSize: 11,
        fontFamily: 'var(--font-data)',
        color: 'var(--nv-text-tertiary)',
        whiteSpace: 'nowrap',
        flexShrink: 0
      }}
    >
      {count.toLocaleString()} / {capacity.toLocaleString()} pkts ({Math.round(percentage)}%)
    </span>
  )
}

/**
 * Shows file name, packet count, and file size after a PCAP import or during file/simulated mode.
 * Req 7.4
 */
function FileInfo(): React.JSX.Element | null {
  const captureStatus = useNetVisStore((s) => s.captureStatus)
  const importResult = useNetVisStore((s) => s.importResult)

  if (importResult !== null) {
    const sizeLabel =
      importResult.fileSizeBytes > 0 ? `${(importResult.fileSizeBytes / 1024).toFixed(1)} KB` : null

    return (
      <span
        aria-label={`Imported ${importResult.packetCount.toLocaleString()} packets${sizeLabel ? ` (${sizeLabel})` : ''}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          fontFamily: 'var(--font-data)',
          color: 'var(--nv-text-tertiary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 260
        }}
      >
        <FileText size={12} aria-hidden />
        <span>
          Imported {importResult.packetCount.toLocaleString()} pkts
          {sizeLabel ? ` (${sizeLabel})` : ''}
        </span>
      </span>
    )
  }

  if (captureStatus.state !== 'file' && captureStatus.state !== 'simulated') {
    return null
  }

  const filePath = captureStatus.path
  const filename = filePath.split(/[\\/]/).pop() ?? filePath

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontFamily: 'var(--font-data)',
        color: 'var(--nv-text-tertiary)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: 220
      }}
      title={filePath}
    >
      <FileText size={12} aria-hidden />
      <span>{filename}</span>
    </span>
  )
}

/**
 * Bottom status bar with capture status, buffer occupancy, and file info.
 * Req 20.3, 20.4, 12.3, 7.4
 */
export function StatusBar(): React.JSX.Element {
  const captureStatus = useNetVisStore((s) => s.captureStatus)
  const bufferOverflowCount = useNetVisStore((s) => s.bufferOverflowCount)
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

  return (
    <footer
      role="contentinfo"
      aria-label="Status bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        height: 32,
        padding: '0 16px',
        backgroundColor: 'var(--nv-bg-surface-2)',
        borderTop: '1px solid var(--nv-border-subtle)',
        flexShrink: 0,
        overflow: 'hidden'
      }}
    >
      <CaptureStatusMessage status={captureStatus} />

      <span aria-hidden style={{ color: 'var(--nv-border-default)', flexShrink: 0 }}>
        |
      </span>

      <BufferOccupancy />
      <FileInfo />

      {overflowVisible && (
        <StatusPill status="warning" label="Buffer full - oldest packets dropped" />
      )}
    </footer>
  )
}
