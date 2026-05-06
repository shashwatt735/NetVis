import { CircleStop, FastForward, FileDown, FileUp, Play } from 'lucide-react'
import { useState } from 'react'
import type React from 'react'
import type { SpeedMultiplier } from '../../../shared/capture-types'
import { useNetVisStore } from '../store'
import { HelpIcon } from './HelpIcon'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { toast } from 'sonner'

const VALID_SPEEDS: SpeedMultiplier[] = [0.5, 1, 2, 5]
type PendingAction = 'start' | 'stop' | 'replay' | 'import' | 'export' | null
const BACKEND_COMMAND_TIMEOUT_MS = 35_000
const FILE_PICKER_TIMEOUT_MS = 120_000

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage))
    }, timeoutMs)

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

function extractFilename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath
}

/**
 * Start / Stop / Simulated capture buttons wired to IPC.
 * Import / Export PCAP buttons.
 * Req 1.1, 2.1, 2.2, 2.8, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4
 */
export function CaptureControls(): React.JSX.Element {
  const captureStatus = useNetVisStore((s) => s.captureStatus)
  const setCaptureStatus = useNetVisStore((s) => s.setCaptureStatus)
  const activeInterface = useNetVisStore((s) => s.activeInterface)
  const interfaces = useNetVisStore((s) => s.interfaces)
  const interfaceDetectionStatus = useNetVisStore((s) => s.interfaceDetectionStatus)
  const packets = useNetVisStore((s) => s.packets)
  const clearPackets = useNetVisStore((s) => s.clearPackets)
  const addPackets = useNetVisStore((s) => s.addPackets)
  const setImportResult = useNetVisStore((s) => s.setImportResult)
  const setFilter = useNetVisStore((s) => s.setFilter)
  const [speed, setSpeed] = useState<SpeedMultiplier>(1)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)

  const isCapturing =
    captureStatus.state === 'active' ||
    captureStatus.state === 'file' ||
    captureStatus.state === 'simulated'
  const liveCaptureUnavailable =
    interfaceDetectionStatus === 'unavailable' && interfaces.length === 0 && activeInterface === null
  const isBusy = pendingAction !== null
  const controlButtonBaseStyle: React.CSSProperties = {
    minHeight: 30,
    padding: '0 12px',
    fontSize: 13,
    fontWeight: 600
  }

  const handleStart = async (): Promise<void> => {
    if (!activeInterface) {
      toast.error('Live capture unavailable', {
        description:
          'No network interface is available. Use Import or Replay to inspect a saved PCAP file.'
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
      toast.success('Live capture starting', {
        description: `Connecting to ${activeInterface}. Packets will stream into the list as they arrive.`
      })
    } catch (err: unknown) {
      toast.error('Failed to start live capture', {
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
      // Immediately update local status — don't wait for the push channel which
      // may arrive after this handler completes due to IPC ordering.
      setCaptureStatus({ state: 'stopped' })
      toast.success('Capture stopped', {
        description: 'Buffer retained. Press Start to capture again.'
      })
    } catch (err: unknown) {
      toast.error('Failed to stop capture', {
        description: err instanceof Error ? err.message : 'Failed to stop capture'
      })
    } finally {
      setPendingAction(null)
    }
  }

  const handleSimulated = async (): Promise<void> => {
    setPendingAction('replay')
    setImportResult(null)

    try {
      // Long timeout guard prevents a permanent spinner if the OS dialog stalls.
      const result = await withTimeout(
        window.electronAPI.selectPcapFile(),
        FILE_PICKER_TIMEOUT_MS,
        'File picker did not open in time. Please retry.'
      )

      if (!result.ok) {
        // User cancelled the dialog — silent exit, no error toast needed
        return
      }

      await withTimeout(
        window.electronAPI.startSimulated(result.path, speed),
        BACKEND_COMMAND_TIMEOUT_MS,
        'Replay startup timed out. Please retry.'
      )
      toast.success('Replay started', {
        description: `Streaming ${extractFilename(result.path)} at ${speed}x speed.`
      })
    } catch (err: unknown) {
      toast.error('Failed to start replay', {
        description: err instanceof Error ? err.message : 'Failed to start simulated replay'
      })
    } finally {
      setPendingAction(null)
    }
  }

  const handleImport = async (): Promise<void> => {
    setPendingAction('import')
    setImportResult(null)

    try {
      // Long timeout guard prevents a permanent spinner if the OS dialog stalls.
      const fileChoice = await withTimeout(
        window.electronAPI.selectPcapFile(),
        FILE_PICKER_TIMEOUT_MS,
        'File picker did not open in time. Please retry.'
      )

      if (!fileChoice.ok) {
        // User cancelled the dialog — silent exit, no error toast needed
        return
      }

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
      // Clear any active filter — it likely won't match the new file's packets,
      // which would leave the list empty with no obvious reason (BUG: stale filter after import)
      setFilter('')
      if (importedPackets.length > 0) addPackets(importedPackets)

      const count = result.packetCount ?? 0
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
        if (result.error && result.error !== 'User canceled') {
          toast.error('Export failed', { description: result.error })
        }
        return
      }

      toast.success('Export complete', {
        description: 'Captured packets were written to a PCAP file.'
      })
    } catch (err: unknown) {
      toast.error('Export failed', {
        description: err instanceof Error ? err.message : 'Export failed'
      })
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Capture controls">
      {!isCapturing ? (
        <>
          <Button
            size="sm"
            variant="default"
            onClick={handleStart}
            disabled={isBusy || liveCaptureUnavailable}
            aria-label="Start live capture"
            aria-busy={pendingAction === 'start'}
            className="px-3"
            style={{
              ...controlButtonBaseStyle,
              backgroundColor: 'var(--nv-accent)',
              color: 'var(--nv-text-inverse)',
              border: 'none'
            }}
          >
            <Play size={14} aria-hidden />
            {pendingAction === 'start' ? 'Starting...' : 'Start Live'}
          </Button>

          <span
            aria-hidden
            style={{
              width: 1,
              height: 20,
              backgroundColor: 'var(--nv-border-default)',
              flexShrink: 0
            }}
          />

          <div
            className="flex items-center gap-2"
            style={{
              padding: '2px 4px',
              border: '1px solid var(--nv-border-subtle)',
              borderRadius: 'var(--nv-radius-md)',
              backgroundColor: 'var(--nv-bg-surface-2)'
            }}
          >
            <Select
              value={String(speed)}
              onValueChange={(val) => {
                const nextSpeed = Number(val)
                if ((VALID_SPEEDS as number[]).includes(nextSpeed)) {
                  setSpeed(nextSpeed as SpeedMultiplier)
                }
              }}
            >
              <SelectTrigger
                size="sm"
                className="w-[80px]"
                aria-label="Select replay speed"
                style={{ fontFamily: 'var(--font-data)', fontSize: 12 }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={{ minWidth: 92, padding: 2 }}>
                <SelectItem
                  value="0.5"
                  style={{ minHeight: 30, padding: '5px 28px 5px 9px', fontSize: 13, lineHeight: 1.35 }}
                >
                  0.5x
                </SelectItem>
                <SelectItem
                  value="1"
                  style={{ minHeight: 30, padding: '5px 28px 5px 9px', fontSize: 13, lineHeight: 1.35 }}
                >
                  1x
                </SelectItem>
                <SelectItem
                  value="2"
                  style={{ minHeight: 30, padding: '5px 28px 5px 9px', fontSize: 13, lineHeight: 1.35 }}
                >
                  2x
                </SelectItem>
                <SelectItem
                  value="5"
                  style={{ minHeight: 30, padding: '5px 28px 5px 9px', fontSize: 13, lineHeight: 1.35 }}
                >
                  5x
                </SelectItem>
              </SelectContent>
            </Select>
            <HelpIcon helpId="simulated-speed" side="bottom" />
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleSimulated}
            disabled={isBusy}
            aria-label="Load PCAP file for simulated replay"
            aria-busy={pendingAction === 'replay'}
            className="px-3"
            style={{
              ...controlButtonBaseStyle,
              borderColor: 'var(--proto-dns)',
              color: 'var(--proto-dns)'
            }}
          >
            <FastForward size={14} aria-hidden />
            {pendingAction === 'replay' ? 'Starting...' : 'Replay'}
          </Button>

          <span
            aria-hidden
            style={{
              width: 1,
              height: 20,
              backgroundColor: 'var(--nv-border-default)',
              flexShrink: 0
            }}
          />

          <Button
            size="sm"
            variant="outline"
            onClick={handleImport}
            disabled={isBusy}
            aria-label="Import PCAP file"
            aria-busy={pendingAction === 'import'}
            className="px-3"
            style={{
              ...controlButtonBaseStyle,
              borderColor: 'var(--proto-udp)',
              color: 'var(--proto-udp)'
            }}
          >
            <FileDown size={14} aria-hidden />
            {pendingAction === 'import' ? 'Importing...' : 'Import'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={isBusy || packets.length === 0}
            aria-label="Export captured packets to PCAP file"
            aria-busy={pendingAction === 'export'}
            className="px-3"
            style={
              packets.length > 0
                ? {
                  ...controlButtonBaseStyle,
                  borderColor: 'var(--proto-icmp)',
                  color: 'var(--proto-icmp)',
                  backgroundColor: 'rgba(245, 158, 11, 0.18)',
                  boxShadow:
                    '0 0 0 1px rgba(245, 158, 11, 0.22), inset 0 0 0 1px rgba(245, 158, 11, 0.5)'
                }
                : {
                  ...controlButtonBaseStyle,
                  borderColor: 'var(--proto-icmp-border)',
                  color: 'var(--proto-icmp)',
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  opacity: 0.58
                }
            }
          >
            <FileUp size={14} aria-hidden />
            {pendingAction === 'export' ? 'Exporting...' : 'Export'}
          </Button>
        </>
      ) : (
        <>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleStop}
            disabled={pendingAction === 'stop'}
            aria-label="Stop capture"
            aria-busy={pendingAction === 'stop'}
            className="px-3"
            style={controlButtonBaseStyle}
          >
            <CircleStop size={14} aria-hidden />
            {pendingAction === 'stop' ? 'Stopping...' : 'Stop'}
          </Button>

          {/* Speed selector — only shown during simulated replay so user can change speed */}
          {captureStatus.state === 'simulated' && (
            <>
              <span
                aria-hidden
                style={{
                  width: 1,
                  height: 20,
                  backgroundColor: 'var(--nv-border-default)',
                  flexShrink: 0
                }}
              />
              <div
                className="flex items-center gap-2"
                style={{
                  padding: '2px 4px',
                  border: '1px solid var(--nv-border-subtle)',
                  borderRadius: 'var(--nv-radius-md)',
                  backgroundColor: 'var(--nv-bg-surface-2)'
                }}
              >
                <Select
                  value={String(speed)}
                  onValueChange={async (val) => {
                    const nextSpeed = Number(val)
                    if (!(VALID_SPEEDS as number[]).includes(nextSpeed)) return
                    setSpeed(nextSpeed as SpeedMultiplier)
                    // Restart replay at new speed: stop then re-start with same file
                    if (captureStatus.state !== 'simulated') return
                    const filePath = captureStatus.path
                    setPendingAction('replay')
                    try {
                      await withTimeout(window.electronAPI.stopCapture(), BACKEND_COMMAND_TIMEOUT_MS, 'Stop timed out')
                      setCaptureStatus({ state: 'stopped' })
                      await withTimeout(
                        window.electronAPI.startSimulated(filePath, nextSpeed as SpeedMultiplier),
                        BACKEND_COMMAND_TIMEOUT_MS,
                        'Replay restart timed out'
                      )
                    } catch (err: unknown) {
                      toast.error('Failed to change speed', {
                        description: err instanceof Error ? err.message : 'Unknown error'
                      })
                    } finally {
                      setPendingAction(null)
                    }
                  }}
                  disabled={pendingAction !== null}
                >
                  <SelectTrigger
                    size="sm"
                    className="w-[80px]"
                    aria-label="Change replay speed"
                    style={{ fontFamily: 'var(--font-data)', fontSize: 12 }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ minWidth: 92, padding: 2 }}>
                    {VALID_SPEEDS.map((s) => (
                      <SelectItem
                        key={s}
                        value={String(s)}
                        style={{ minHeight: 30, padding: '5px 28px 5px 9px', fontSize: 13, lineHeight: 1.35 }}
                      >
                        {s}x
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <HelpIcon helpId="simulated-speed" side="bottom" />
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
