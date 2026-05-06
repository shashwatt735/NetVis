import { Download, FileDown, Search, X } from 'lucide-react'
import { useState } from 'react'
import type React from 'react'
import { useNetVisStore } from '../store'
import { Button } from './ui/button'
import { toast } from 'sonner'

const PAGE_LABELS = {
  capture: 'Capture',
  learn: 'Learn',
  challenges: 'Challenges',
  settings: 'Settings'
} as const

const BACKEND_COMMAND_TIMEOUT_MS = 35_000
const FILE_PICKER_TIMEOUT_MS = 120_000

type PendingTitleAction = 'import' | 'export' | null

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timeoutId)
        resolve(value)
      },
      (error) => {
        clearTimeout(timeoutId)
        reject(error)
      }
    )
  })
}

function formatFileSizeLabel(sizeBytes: number): string | null {
  return sizeBytes > 0 ? `${(sizeBytes / 1024).toFixed(1)} KB` : null
}

function isMacPlatform(): boolean {
  return navigator.platform.toLowerCase().startsWith('mac')
}

export function AppTitleBar(): React.JSX.Element {
  const activePage = useNetVisStore((s) => s.activePage)
  const captureStatus = useNetVisStore((s) => s.captureStatus)
  const packets = useNetVisStore((s) => s.packets)
  const setActivePage = useNetVisStore((s) => s.setActivePage)
  const clearPackets = useNetVisStore((s) => s.clearPackets)
  const addPackets = useNetVisStore((s) => s.addPackets)
  const setFilter = useNetVisStore((s) => s.setFilter)
  const setImportResult = useNetVisStore((s) => s.setImportResult)
  const [pendingAction, setPendingAction] = useState<PendingTitleAction>(null)
  const [globalQuery, setGlobalQuery] = useState('')

  const isMac = isMacPlatform()
  const isCapturing =
    captureStatus.state === 'active' ||
    captureStatus.state === 'file' ||
    captureStatus.state === 'simulated'
  const hasPackets = packets.length > 0

  const actionButtonStyle: React.CSSProperties = {
    height: 28,
    padding: '0 10px',
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap'
  }

  const handleImport = async (): Promise<void> => {
    setPendingAction('import')
    setImportResult(null)
    try {
      const fileChoice = await withTimeout(
        window.electronAPI.selectPcapFile(),
        FILE_PICKER_TIMEOUT_MS,
        'File picker did not open in time. Please retry.'
      )
      if (!fileChoice.ok) return

      const result = await withTimeout(
        window.electronAPI.importPcapFromPath(fileChoice.path),
        BACKEND_COMMAND_TIMEOUT_MS,
        'Import timed out before completion. Please retry.'
      )
      if (!result.ok) {
        if (result.error && result.error !== 'User canceled') {
          toast.error('Import failed', { description: result.error })
        }
        return
      }

      const importedPackets = await window.electronAPI.getAllPackets()
      clearPackets()
      setFilter('')
      if (importedPackets.length > 0) addPackets(importedPackets)

      const count = result.packetCount ?? importedPackets.length
      const sizeBytes = result.fileSizeBytes ?? 0
      setImportResult({ packetCount: count, fileSizeBytes: sizeBytes })

      const sizeLabel = formatFileSizeLabel(sizeBytes)
      toast.success('Import complete', {
        description: `Loaded ${count.toLocaleString()} packets${sizeLabel ? ` from a ${sizeLabel} capture` : ''}.`
      })
    } catch (err: unknown) {
      toast.error('Import failed', {
        description: err instanceof Error ? err.message : 'Import failed'
      })
    } finally {
      setPendingAction(null)
    }
  }

  const handleExport = async (): Promise<void> => {
    setPendingAction('export')
    try {
      const result = await withTimeout(
        window.electronAPI.exportPcap(),
        BACKEND_COMMAND_TIMEOUT_MS,
        'Export timed out before completion. Please retry.'
      )
      if (!result.ok) {
        toast.error('Export failed', { description: result.error ?? 'Could not export packets.' })
        return
      }
      toast.success('Export complete', {
        description: 'Packets were written to the file you selected.'
      })
    } catch (err: unknown) {
      toast.error('Export failed', {
        description: err instanceof Error ? err.message : 'Export failed'
      })
    } finally {
      setPendingAction(null)
    }
  }

  const handleGlobalSearchSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const query = globalQuery.trim()
    if (!query) return

    const normalized = query.toLowerCase()
    const pageMatch = Object.entries(PAGE_LABELS).find(
      ([page, label]) => page.includes(normalized) || label.toLowerCase().includes(normalized)
    )

    if (pageMatch) {
      setActivePage(pageMatch[0] as keyof typeof PAGE_LABELS)
      setGlobalQuery('')
      return
    }

    const protocol = ['tcp', 'udp', 'dns', 'arp', 'icmp', 'ipv4', 'ipv6'].find(
      (candidate) => candidate === normalized
    )
    setFilter(protocol ? `proto == ${protocol.toUpperCase()}` : query)
    setActivePage('capture')
    setGlobalQuery('')
  }

  return (
    <header
      className="nv-titlebar-drag"
      aria-label="Application title bar"
      style={{
        height: 'var(--nv-titlebar-height)',
        flexShrink: 0,
        display: 'grid',
        gridTemplateColumns: 'minmax(180px, 1fr) minmax(320px, 560px) minmax(210px, 1fr)',
        alignItems: 'center',
        gap: 10,
        paddingLeft: isMac ? 80 : 12,
        paddingRight: isMac ? 12 : 150,
        backgroundColor: 'var(--nv-bg-surface-1)',
        borderBottom: '1px solid var(--nv-border-subtle)',
        userSelect: 'none'
      }}
    >
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'baseline',
          gap: 7,
          minWidth: 0,
          justifySelf: 'start'
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 750,
            color: 'var(--nv-text-primary)'
          }}
        >
          Net<span style={{ color: 'var(--nv-accent)' }}>Vis</span>
        </span>
        <span style={{ color: 'var(--nv-text-tertiary)', fontSize: 12 }}>›</span>
        <span
          style={{
            color: 'var(--nv-text-secondary)',
            fontSize: 12,
            fontWeight: 600
          }}
        >
          {PAGE_LABELS[activePage]}
        </span>
      </div>

      <form
        className="nv-titlebar-no-drag"
        role="search"
        onSubmit={handleGlobalSearchSubmit}
        style={{
          width: '100%',
          minWidth: 0,
          position: 'relative',
          justifySelf: 'center'
        }}
      >
        <Search
          aria-hidden
          size={13}
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--nv-text-tertiary)',
            pointerEvents: 'none'
          }}
        />
        <input
          type="text"
          value={globalQuery}
          onChange={(event) => setGlobalQuery(event.target.value)}
          aria-label="Search NetVis or filter packets"
          placeholder="Search NetVis or type tcp, dns, proto == TCP"
          className="nv-focus"
          style={{
            width: '100%',
            height: 28,
            padding: '0 30px',
            borderRadius: 'var(--nv-radius-md)',
            border: '1px solid var(--nv-border-subtle)',
            backgroundColor: 'var(--input-background)',
            color: 'var(--nv-text-primary)',
            fontFamily: 'var(--font-ui)',
            fontSize: 12,
            outline: 'none'
          }}
        />
        {globalQuery && (
          <button
            type="button"
            onClick={() => setGlobalQuery('')}
            aria-label="Clear global search"
            style={{
              position: 'absolute',
              right: 7,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 18,
              height: 18,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
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
        )}
      </form>

      <div
        className="nv-titlebar-no-drag"
        style={{
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 6
        }}
      >
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void handleImport()}
          disabled={pendingAction !== null || isCapturing}
          aria-label="Import PCAP file"
          aria-busy={pendingAction === 'import'}
          style={{
            ...actionButtonStyle,
            borderColor: 'var(--nv-accent-border)',
            color: 'var(--nv-accent)'
          }}
        >
          <FileDown size={13} aria-hidden />
          {pendingAction === 'import' ? 'Importing' : 'Import PCAP'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void handleExport()}
          disabled={pendingAction !== null || !hasPackets}
          aria-label="Export packets"
          aria-busy={pendingAction === 'export'}
          style={actionButtonStyle}
        >
          <Download size={13} aria-hidden />
          {pendingAction === 'export' ? 'Exporting' : 'Export'}
        </Button>
      </div>
    </header>
  )
}
