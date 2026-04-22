import { useEffect, useState } from 'react'
import type React from 'react'
import { AlertTriangle, CircleHelp, RefreshCw } from 'lucide-react'
import type { NetworkInterface } from '../../../shared/capture-types'
import { useNetVisStore } from '../store'
import { HelpIcon } from './HelpIcon'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { toast } from 'sonner'

function interfacePriority(iface: NetworkInterface): number {
  const label = `${iface.displayName} ${iface.name}`.toLowerCase()

  if (label.includes('loopback') || label.includes('npf_loopback') || label === 'lo') {
    return 4
  }

  if (
    label.includes('virtual') ||
    label.includes('vmware') ||
    label.includes('hyper-v') ||
    label.includes('docker') ||
    label.includes('vbox') ||
    label.includes('tunnel') ||
    label.includes('teredo') ||
    label.includes('bluetooth')
  ) {
    return 3
  }

  if (/\bwi-?fi\b|\bwlan\b/.test(label)) {
    return 1
  }

  if (/\bethernet\b|\blan\b/.test(label)) {
    return 0
  }

  return 2
}

function sortInterfacesForSelection(interfaces: NetworkInterface[]): NetworkInterface[] {
  return [...interfaces].sort((a, b) => {
    const priorityDiff = interfacePriority(a) - interfacePriority(b)
    if (priorityDiff !== 0) return priorityDiff
    return a.displayName.localeCompare(b.displayName)
  })
}

function pickRecommendedInterface(interfaces: NetworkInterface[]): string | null {
  const sorted = sortInterfacesForSelection(interfaces)
  return sorted[0]?.name ?? null
}

/**
 * Dropdown for selecting a network interface before capture.
 * Req 1.1, 1.4 - sorted alphabetically, calls getInterfaces() on mount.
 * BUGFIX-05: handles structured InterfaceResult, shows error state distinct from empty list.
 */
export function InterfaceSelector(): React.JSX.Element {
  const interfaces = useNetVisStore((s) => s.interfaces)
  const activeInterface = useNetVisStore((s) => s.activeInterface)
  const captureStatus = useNetVisStore((s) => s.captureStatus)
  const setInterfaces = useNetVisStore((s) => s.setInterfaces)
  const setActiveInterface = useNetVisStore((s) => s.setActiveInterface)
  const [enumError, setEnumError] = useState<string | null>(null)
  const [platformHint, setPlatformHint] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)

  const showUnavailableToast = (error: string, hint?: string | null): void => {
    toast.error('Live capture unavailable', {
      id: 'interface-enumeration-error',
      duration: 20000,
      description: hint ? `${error} ${hint}` : error
    })
  }

  const isCapturing =
    captureStatus.state === 'active' ||
    captureStatus.state === 'file' ||
    captureStatus.state === 'simulated'

  const doEnumerate = (cancelled: { value: boolean }): void => {
    // Do NOT call getInterfaces() while capture is active — Cap.deviceList() is not
    // safe to call concurrently with pcap_dispatch and will crash the worker process.
    if (useNetVisStore.getState().captureStatus.state === 'active') return

    window.electronAPI
      .getInterfaces()
      .then((result) => {
        if (cancelled.value) return

        if (result.ok) {
          const sorted = sortInterfacesForSelection(result.interfaces)
          setEnumError(null)
          setPlatformHint(null)
          setInterfaces(sorted)
          if (sorted.length === 0) {
            setActiveInterface(null)
          }
        } else {
          setInterfaces([])
          setActiveInterface(null)
          setEnumError(result.error)
          setPlatformHint(result.platformHint ?? null)
          showUnavailableToast(result.error, result.platformHint ?? null)
          console.error('Interface enumeration failed:', result.error)
        }
      })
      .catch((err: unknown) => {
        if (cancelled.value) return

        setInterfaces([])
        setActiveInterface(null)
        const message = err instanceof Error ? err.message : 'Unknown error'
        setEnumError(message)
        setPlatformHint(null)
        showUnavailableToast(message)
        console.error('Failed to enumerate interfaces:', err)
      })
  }

  useEffect(() => {
    const cancelled = { value: false }
    doEnumerate(cancelled)
    return () => {
      cancelled.value = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setActiveInterface, setInterfaces])

  useEffect(() => {
    if (
      interfaces.length > 0 &&
      !activeInterface &&
      captureStatus.state !== 'active' &&
      captureStatus.state !== 'file' &&
      captureStatus.state !== 'simulated'
    ) {
      const recommended = pickRecommendedInterface(interfaces)
      if (recommended) {
        setActiveInterface(recommended)
      }
    }
  }, [interfaces, activeInterface, captureStatus.state, setActiveInterface])

  const handleRetry = async (): Promise<void> => {
    setIsRetrying(true)
    setEnumError(null)
    setPlatformHint(null)
    try {
      const result = await window.electronAPI.getInterfaces()
      if (result.ok) {
        const sorted = sortInterfacesForSelection(result.interfaces)
        setEnumError(null)
        setPlatformHint(null)
        setInterfaces(sorted)
        if (sorted.length > 0) {
          toast.success('Interfaces found', {
            description: `${sorted.length} network interface${sorted.length > 1 ? 's' : ''} available.`
          })
        }
      } else {
        setInterfaces([])
        setActiveInterface(null)
        setEnumError(result.error)
        setPlatformHint(result.platformHint ?? null)
        showUnavailableToast(result.error, result.platformHint ?? null)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setEnumError(message)
      showUnavailableToast(message)
    } finally {
      setIsRetrying(false)
    }
  }

  const recommendedInterface = pickRecommendedInterface(interfaces)

  const selectedValue =
    activeInterface ?? (captureStatus.state === 'active' ? captureStatus.iface : undefined)

  if (enumError !== null) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          backgroundColor: 'rgba(207, 34, 46, 0.08)',
          border: '1px solid rgba(207, 34, 46, 0.3)',
          borderRadius: 'var(--nv-radius-md)',
          maxWidth: 320,
          minWidth: 0
        }}
        role="alert"
        aria-live="polite"
      >
        <AlertTriangle
          size={13}
          style={{ color: 'var(--nv-status-error)', flexShrink: 0 }}
          aria-hidden
        />
        <span
          style={{
            fontSize: 12,
            fontFamily: 'var(--font-ui)',
            color: 'var(--nv-status-error)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
            minWidth: 0
          }}
          title={platformHint ?? enumError}
        >
          Live capture unavailable
        </span>
        <button
          type="button"
          onClick={() => showUnavailableToast(enumError, platformHint)}
          aria-label="Why is live capture unavailable?"
          title={platformHint ?? enumError}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            padding: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--nv-status-error)',
            borderRadius: 'var(--nv-radius-sm)',
            flexShrink: 0
          }}
        >
          <CircleHelp size={12} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => void handleRetry()}
          disabled={isRetrying}
          aria-label="Retry interface detection"
          title={platformHint ?? 'Click to retry interface detection'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            padding: 0,
            background: 'none',
            border: 'none',
            cursor: isRetrying ? 'not-allowed' : 'pointer',
            color: 'var(--nv-status-error)',
            borderRadius: 'var(--nv-radius-sm)',
            flexShrink: 0,
            opacity: isRetrying ? 0.5 : 1,
            transition: 'opacity 150ms ease'
          }}
        >
          <RefreshCw
            size={12}
            aria-hidden
            style={{
              animation: isRetrying ? 'spin 1s linear infinite' : 'none'
            }}
          />
        </button>
        <HelpIcon helpId="interface-selector" side="bottom" />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={selectedValue ?? ''}
        onValueChange={(val) => {
          setActiveInterface(val)
        }}
        disabled={isCapturing}
      >
        <SelectTrigger
          size="sm"
          className="w-52 font-mono"
          aria-label="Select network interface"
          data-help-id="interface-selector"
        >
          <SelectValue placeholder="Select interface..." />
        </SelectTrigger>
        <SelectContent>
          {interfaces.length === 0 ? (
            <SelectItem value="__none__" disabled>
              No interfaces found
            </SelectItem>
          ) : (
            interfaces.map((iface) => {
              const isRecommended = iface.name === recommendedInterface
              return (
                <SelectItem key={iface.name} value={iface.name}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        flexShrink: 0,
                        backgroundColor: iface.isUp
                          ? 'var(--nv-status-success)'
                          : 'var(--nv-text-tertiary)'
                      }}
                    />
                    <span className="min-w-0">
                      <span
                        style={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {iface.displayName}
                        {isRecommended ? ' (recommended)' : ''}
                      </span>
                      {iface.displayName !== iface.name && (
                        <span
                          style={{
                            display: 'block',
                            maxWidth: 280,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: 11,
                            color: 'var(--nv-text-tertiary)'
                          }}
                        >
                          {iface.name}
                        </span>
                      )}
                    </span>
                  </span>
                </SelectItem>
              )
            })
          )}
        </SelectContent>
      </Select>
      <HelpIcon helpId="interface-selector" side="bottom" />
    </div>
  )
}

