import { Download, FileDown, Play, RotateCcw, Square, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type React from 'react'
import type { SpeedMultiplier } from '../../../shared/capture-types'
import { useNetVisStore } from '../store'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { toast } from 'sonner'

const VALID_SPEEDS: SpeedMultiplier[] = [0.5, 1, 2, 5]
const BACKEND_COMMAND_TIMEOUT_MS = 35_000
const FILE_PICKER_TIMEOUT_MS = 120_000

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

type PendingAction = 'start' | 'stop' | 'import' | 'replay' | 'export' | 'clear' | 'speed' | null

export function CaptureToolbarActions(): React.JSX.Element {
  const captureStatus = useNetVisStore((s) => s.captureStatus)
  const activeInterface = useNetVisStore((s) => s.activeInterface)
  const interfaces = useNetVisStore((s) => s.interfaces)
  const setCaptureStatus = useNetVisStore((s) => s.setCaptureStatus)
  const clearPackets = useNetVisStore((s) => s.clearPackets)
  const addPackets = useNetVisStore((s) => s.addPackets)
  const setImportResult = useNetVisStore((s) => s.setImportResult)
  const setFilter = useNetVisStore((s) => s.setFilter)
  const packets = useNetVisStore((s) => s.packets)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [replaySpeed, setReplaySpeed] = useState<SpeedMultiplier>(1)

  const isCapturing =
    captureStatus.state === 'active' ||
    captureStatus.state === 'file' ||
    captureStatus.state === 'simulated'
  const liveCaptureUnavailable = interfaces.length === 0 && activeInterface === null
  const isBusy = pendingAction !== null
  const hasPackets = packets.length > 0

  // Dismiss the confirm-clear UI if a capture starts while it is showing
  useEffect(() => {
    if (isCapturing) setConfirmClear(false)
  }, [isCapturing])

  useEffect(() => {
    if (captureStatus.state === 'simulated') {
      setReplaySpeed(captureStatus.speed)
    }
  }, [captureStatus])

  const buttonStyle: React.CSSProperties = {
    minHeight: 30,
    padding: '0 12px',
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: 'nowrap'
  }

  const handleStart = async (): Promise<void> => {
    if (!activeInterface) {
      toast.error('Live capture unavailable', {
        description: 'No network interface is available. Import a saved PCAP file instead.'
      })
      return
    }

    setPendingAction('start')
    setImportResult(null)
    try {
      await withTimeout(
        window.electronAPI.startCapture(activeInterface),
        BACKEND_COMMAND_TIMEOUT_MS,
        'Start command timed out. Please try again.'
      )

      // Resolve interface display name for toast
      const interfaceObj = interfaces.find((iface) => iface.name === activeInterface)
      const displayName = interfaceObj?.displayName ?? activeInterface

      toast.success('Live capture starting', {
        description: `Listening on ${displayName}.`
      })
    } catch (err: unknown) {
      toast.error('Failed to start capture', {
        description: err instanceof Error ? err.message : 'Failed to start capture'
      })
    } finally {
      setPendingAction(null)
    }
  }

  const handleStop = async (): Promise<void> => {
    setPendingAction('stop')
    try {
      await withTimeout(
        window.electronAPI.stopCapture(),
        BACKEND_COMMAND_TIMEOUT_MS,
        'Stop command timed out. Please try again.'
      )
      setCaptureStatus({ state: 'stopped' })
      toast.success('Capture stopped')
    } catch (err: unknown) {
      toast.error('Failed to stop capture', {
        description: err instanceof Error ? err.message : 'Failed to stop capture'
      })
    } finally {
      setPendingAction(null)
    }
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

  const handleReplay = async (): Promise<void> => {
    setPendingAction('replay')
    setImportResult(null)
    try {
      const fileChoice = await withTimeout(
        window.electronAPI.selectPcapFile(),
        FILE_PICKER_TIMEOUT_MS,
        'File picker did not open in time. Please retry.'
      )
      if (!fileChoice.ok) return

      clearPackets()
      setFilter('')
      await withTimeout(
        window.electronAPI.startSimulated(fileChoice.path, replaySpeed),
        BACKEND_COMMAND_TIMEOUT_MS,
        'Replay did not start before the timeout.'
      )
      setCaptureStatus({ state: 'simulated', path: fileChoice.path, speed: replaySpeed })
      toast.success('Replay starting', {
        description: `Streaming the selected PCAP at ${replaySpeed}x speed.`
      })
    } catch (err: unknown) {
      toast.error('Replay failed', {
        description: err instanceof Error ? err.message : 'Replay failed'
      })
    } finally {
      setPendingAction(null)
    }
  }

  const handleReplaySpeedChange = async (value: string): Promise<void> => {
    const nextSpeed = Number(value)
    if (!(VALID_SPEEDS as number[]).includes(nextSpeed)) return

    const typedSpeed = nextSpeed as SpeedMultiplier
    setReplaySpeed(typedSpeed)

    if (captureStatus.state !== 'simulated') return

    const filePath = captureStatus.path
    setPendingAction('speed')
    try {
      await withTimeout(window.electronAPI.stopCapture(), BACKEND_COMMAND_TIMEOUT_MS, 'Stop timed out')
      setCaptureStatus({ state: 'stopped' })
      await withTimeout(
        window.electronAPI.startSimulated(filePath, typedSpeed),
        BACKEND_COMMAND_TIMEOUT_MS,
        'Replay restart timed out'
      )
      setCaptureStatus({ state: 'simulated', path: filePath, speed: typedSpeed })
      toast.success('Replay speed changed', {
        description: `Streaming at ${typedSpeed}x speed.`
      })
    } catch (err: unknown) {
      toast.error('Failed to change replay speed', {
        description: err instanceof Error ? err.message : 'Unknown error'
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

  const handleClear = async (): Promise<void> => {
    setPendingAction('clear')
    try {
      await withTimeout(
        window.electronAPI.clearBuffer(),
        BACKEND_COMMAND_TIMEOUT_MS,
        'Clear command timed out. Please try again.'
      )
      clearPackets()
      setFilter('')
      setCaptureStatus({ state: 'stopped' })
      toast.success('Packet buffer cleared')
    } catch (err: unknown) {
      toast.error('Failed to clear buffer', {
        description: err instanceof Error ? err.message : 'Failed to clear buffer'
      })
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <div
      role="group"
      aria-label="Capture actions"
      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
    >
      <Button
        size="sm"
        variant="default"
        onClick={() => void handleStart()}
        disabled={isBusy || isCapturing || liveCaptureUnavailable}
        aria-label="Start live capture"
        aria-busy={pendingAction === 'start'}
        style={{
          ...buttonStyle,
          backgroundColor: 'var(--proto-tcp)',
          color: '#fff',
          border: 'none'
        }}
      >
        <Play size={14} aria-hidden />
        {pendingAction === 'start' ? 'Starting' : 'Live capture'}
      </Button>

      <Button
        size="sm"
        variant="default"
        onClick={() => void handleStop()}
        disabled={isBusy || !isCapturing}
        aria-label="Stop capture"
        aria-busy={pendingAction === 'stop'}
        style={{
          ...buttonStyle,
          backgroundColor: isCapturing ? 'var(--color-error)' : 'transparent',
          color: isCapturing ? '#fff' : 'var(--nv-text-secondary)',
          borderColor: isCapturing ? 'var(--color-error)' : 'var(--nv-border-default)'
        }}
      >
        <Square size={13} aria-hidden />
        {pendingAction === 'stop' ? 'Stopping' : 'Stop'}
      </Button>

      <Button
        size="sm"
        variant="secondary"
        onClick={() => void handleImport()}
        disabled={isBusy || isCapturing}
        aria-label="Import PCAP file"
        aria-busy={pendingAction === 'import'}
        style={{
          ...buttonStyle,
          borderColor: 'var(--proto-icmp-border)',
          color: 'var(--proto-icmp)'
        }}
      >
        <FileDown size={14} aria-hidden />
        {pendingAction === 'import' ? 'Importing' : 'Import PCAP'}
      </Button>

      <Button
        size="sm"
        variant="secondary"
        onClick={() => void handleReplay()}
        disabled={isBusy || isCapturing}
        aria-label="Start simulated replay"
        aria-busy={pendingAction === 'replay'}
        style={{
          ...buttonStyle,
          borderColor: 'var(--proto-udp-border)',
          color: 'var(--proto-udp)'
        }}
      >
        <RotateCcw size={14} aria-hidden />
        {pendingAction === 'replay' ? 'Starting replay' : 'Replay PCAP'}
      </Button>

      <Select
        value={String(replaySpeed)}
        disabled={isBusy || (isCapturing && captureStatus.state !== 'simulated')}
        onValueChange={(value) => {
          void handleReplaySpeedChange(value)
        }}
      >
        <SelectTrigger
          size="sm"
          aria-label="Replay speed"
          style={{
            width: 88,
            fontFamily: 'var(--font-data)',
            fontSize: 12,
            borderColor:
              captureStatus.state === 'simulated'
                ? 'var(--proto-udp-border)'
                : 'var(--nv-border-subtle)'
          }}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent style={{ minWidth: 92, padding: 2 }}>
          {VALID_SPEEDS.map((speed) => (
            <SelectItem
              key={speed}
              value={String(speed)}
              style={{ minHeight: 30, padding: '5px 28px 5px 9px', fontSize: 13, lineHeight: 1.35 }}
            >
              {speed}x
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        size="sm"
        variant="outline"
        onClick={() => void handleExport()}
        disabled={isBusy || !hasPackets}
        aria-label="Export packets"
        aria-busy={pendingAction === 'export'}
        style={buttonStyle}
      >
        <Download size={14} aria-hidden />
        {pendingAction === 'export' ? 'Exporting' : 'Export'}
      </Button>

      {/* Clear — two-step confirmation to prevent accidental data loss */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginLeft: 4,
          paddingLeft: 8,
          borderLeft: '1px solid var(--nv-border-subtle)'
        }}
      >
        {confirmClear ? (
          <>
            <span
              style={{
                fontSize: 12,
                color: 'var(--nv-text-secondary)',
                whiteSpace: 'nowrap',
                fontFamily: 'var(--font-ui)'
              }}
            >
              Clear {packets.length.toLocaleString()} packets?
            </span>
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                setConfirmClear(false)
                void handleClear()
              }}
              disabled={isBusy}
              aria-label="Confirm clear packet buffer"
              style={{
                ...buttonStyle,
                backgroundColor: 'var(--nv-status-error)',
                color: '#fff',
                border: 'none'
              }}
            >
              Clear
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmClear(false)}
              aria-label="Cancel clear"
              style={buttonStyle}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmClear(true)}
            disabled={isBusy || isCapturing || !hasPackets}
            aria-label="Clear packet buffer"
            style={{
              ...buttonStyle,
              color: hasPackets ? 'var(--nv-text-secondary)' : 'var(--nv-text-tertiary)'
            }}
          >
            <Trash2 size={14} aria-hidden />
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}

export function ReplaySpeedControl(): React.JSX.Element | null {
  const captureStatus = useNetVisStore((s) => s.captureStatus)
  const setCaptureStatus = useNetVisStore((s) => s.setCaptureStatus)
  const [pending, setPending] = useState(false)

  if (captureStatus.state !== 'simulated') return null

  return (
    <Select
      value={String(captureStatus.speed)}
      disabled={pending}
      onValueChange={(value) => {
        const nextSpeed = Number(value)
        if (!(VALID_SPEEDS as number[]).includes(nextSpeed)) return

        setPending(true)
        void (async () => {
          try {
            await withTimeout(
              window.electronAPI.stopCapture(),
              BACKEND_COMMAND_TIMEOUT_MS,
              'Stop timed out'
            )
            setCaptureStatus({ state: 'stopped' })
            await withTimeout(
              window.electronAPI.startSimulated(captureStatus.path, nextSpeed as SpeedMultiplier),
              BACKEND_COMMAND_TIMEOUT_MS,
              'Replay restart timed out'
            )
          } catch (err: unknown) {
            toast.error('Failed to change replay speed', {
              description: err instanceof Error ? err.message : 'Unknown error'
            })
          } finally {
            setPending(false)
          }
        })()
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label="Replay speed"
        style={{ width: 88, fontFamily: 'var(--font-data)', fontSize: 12 }}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent style={{ minWidth: 92, padding: 2 }}>
        {VALID_SPEEDS.map((speed) => (
          <SelectItem
            key={speed}
            value={String(speed)}
            style={{ minHeight: 30, padding: '5px 28px 5px 9px', fontSize: 13, lineHeight: 1.35 }}
          >
            {speed}x
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
