import { useEffect, useState } from 'react'
import type React from 'react'
import { AlertTriangle, CircleHelp, RefreshCw } from 'lucide-react'
import type { NetworkInterface } from '../../../shared/capture-types'
import {
  classifyInterfaceKind,
  semanticInterfaceLabel,
  withInterfaceRecommendation
} from '../../../shared/interface-classification'
import { useNetVisStore } from '../store'
import { hideInterfaceAddress } from '../lib/interface-display'
import { HelpIcon } from './HelpIcon'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { toast } from 'sonner'

function sortInterfacesForSelection(interfaces: NetworkInterface[]): NetworkInterface[] {
  return withInterfaceRecommendation(interfaces).sort((a, b) => {
    if (a.isRecommended !== b.isRecommended) return a.isRecommended ? -1 : 1
    const scoreDiff = (b.recommendationScore ?? 0) - (a.recommendationScore ?? 0)
    if (scoreDiff !== 0) return scoreDiff
    return hideInterfaceAddress(a.displayName).localeCompare(hideInterfaceAddress(b.displayName))
  })
}

function pickRecommendedInterface(interfaces: NetworkInterface[]): string | null {
  const sorted = sortInterfacesForSelection(interfaces)
  return sorted.find((iface) => iface.isRecommended)?.name ?? sorted[0]?.name ?? null
}

function interfaceKindLabel(iface: NetworkInterface): string {
  return iface.semanticLabel ?? semanticInterfaceLabel(iface.kind ?? classifyInterfaceKind(iface))
}

function displayInterfaceName(iface: NetworkInterface): string {
  const adapterName = hideInterfaceAddress(iface.displayName)
  const label = interfaceKindLabel(iface)
  return label === 'Interface' ? adapterName : `${label} · ${adapterName}`
}

function statusBadges(iface: NetworkInterface, isRecommended: boolean): string[] {
  const badges: string[] = []
  if (isRecommended) badges.push('Recommended')
  if (iface.isDefaultRoute) badges.push('Primary route')
  if (iface.kind === 'vpn' || iface.kind === 'virtual' || iface.kind === 'bluetooth') {
    badges.push('Specialized')
  }
  if (iface.kind === 'loopback') badges.push('Local only')
  if (iface.hasAddress === false) badges.push('No address')
  badges.push('Local address hidden')
  return badges
}

/**
 * Dropdown for selecting a network interface before capture.
 * Req 1.1, 1.4 - sorted alphabetically, calls getInterfaces() on mount.
 * BUGFIX-05: handles structured InterfaceResult, shows error state distinct from empty list.
 */
export function InterfaceSelector(): React.JSX.Element {
  const interfaces = useNetVisStore((s) => s.interfaces)
  const activeInterface = useNetVisStore((s) => s.activeInterface)
  const preferredInterfaceName = useNetVisStore((s) => s.preferredInterfaceName)
  const autoSelectInterface = useNetVisStore((s) => s.autoSelectInterface)
  const captureStatus = useNetVisStore((s) => s.captureStatus)
  const setInterfaces = useNetVisStore((s) => s.setInterfaces)
  const setActiveInterface = useNetVisStore((s) => s.setActiveInterface)
  const setPreferredInterfaceName = useNetVisStore((s) => s.setPreferredInterfaceName)
  const setAutoSelectInterface = useNetVisStore((s) => s.setAutoSelectInterface)
  const setInterfaceDetectionStatus = useNetVisStore((s) => s.setInterfaceDetectionStatus)
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

    setInterfaceDetectionStatus('loading')
    window.electronAPI
      .getInterfaces()
      .then((result) => {
        if (cancelled.value) return

        if (result.ok) {
          const sorted = sortInterfacesForSelection(result.interfaces)
          setEnumError(null)
          setPlatformHint(null)
          setInterfaces(sorted)
          setInterfaceDetectionStatus(sorted.length > 0 ? 'ready' : 'unavailable')
          if (sorted.length === 0) {
            setActiveInterface(null)
          }
        } else {
          setInterfaces([])
          setActiveInterface(null)
          setEnumError(result.error)
          setPlatformHint(result.platformHint ?? null)
          setInterfaceDetectionStatus('unavailable')
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
        setInterfaceDetectionStatus('unavailable')
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
  }, [setActiveInterface, setInterfaces, setInterfaceDetectionStatus])

  useEffect(() => {
    if (
      interfaces.length > 0 &&
      captureStatus.state !== 'active' &&
      captureStatus.state !== 'file' &&
      captureStatus.state !== 'simulated'
    ) {
      const preferredIsAvailable =
        preferredInterfaceName !== null &&
        interfaces.some((iface) => iface.name === preferredInterfaceName)

      if (!autoSelectInterface && preferredIsAvailable) {
        if (activeInterface !== preferredInterfaceName) {
          setActiveInterface(preferredInterfaceName)
        }
        return
      }

      const recommended = pickRecommendedInterface(interfaces)
      const activeStillAvailable =
        activeInterface !== null && interfaces.some((iface) => iface.name === activeInterface)

      if (
        recommended &&
        (autoSelectInterface || !activeStillAvailable) &&
        activeInterface !== recommended
      ) {
        setActiveInterface(recommended)
      }
    }
  }, [
    interfaces,
    activeInterface,
    preferredInterfaceName,
    autoSelectInterface,
    captureStatus.state,
    setActiveInterface
  ])

  const handleRetry = async (): Promise<void> => {
    setIsRetrying(true)
    setEnumError(null)
    setPlatformHint(null)
    setInterfaceDetectionStatus('loading')
    try {
      const result = await window.electronAPI.getInterfaces()
      if (result.ok) {
        const sorted = sortInterfacesForSelection(result.interfaces)
        setEnumError(null)
        setPlatformHint(null)
        setInterfaces(sorted)
        setInterfaceDetectionStatus(sorted.length > 0 ? 'ready' : 'unavailable')
        if (sorted.length > 0) {
          toast.success('Interfaces found', {
            description: `${sorted.length} network interface${sorted.length > 1 ? 's' : ''} available.`
          })
        } else {
          setActiveInterface(null)
        }
      } else {
        setInterfaces([])
        setActiveInterface(null)
        setEnumError(result.error)
        setPlatformHint(result.platformHint ?? null)
        setInterfaceDetectionStatus('unavailable')
        showUnavailableToast(result.error, result.platformHint ?? null)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setEnumError(message)
      setInterfaceDetectionStatus('unavailable')
      showUnavailableToast(message)
    } finally {
      setIsRetrying(false)
    }
  }

  const selectedValue =
    activeInterface ?? (captureStatus.state === 'active' ? captureStatus.iface : undefined)
  const recommendedInterface = pickRecommendedInterface(interfaces)
  const selectedInterface = interfaces.find((iface) => iface.name === selectedValue)

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
          maxWidth: 240,
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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4
      }}
    >
      <Select
        value={selectedValue ?? ''}
        onValueChange={(val) => {
          setActiveInterface(val)
          setPreferredInterfaceName(val)
          setAutoSelectInterface(false)
          void window.electronAPI.setSettings({
            preferredInterfaceName: val,
            autoSelectInterface: false
          })
        }}
        disabled={isCapturing}
      >
        <SelectTrigger
          size="sm"
          className="font-mono"
          aria-label="Select network interface"
          data-help-id="interface-selector"
          style={{
            width: 160,
            maxWidth: 160,
            borderColor: 'var(--nv-border-subtle)',
            backgroundColor: 'var(--nv-bg-base)',
            fontSize: 12,
            fontFamily: 'var(--font-ui)',
            paddingLeft: 10
          }}
        >
          <SelectValue placeholder="Select interface…">
            {selectedInterface
              ? displayInterfaceName(selectedInterface)
              : selectedValue
                ? selectedValue
                : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent style={{ minWidth: 360, maxWidth: 400 }}>
          {interfaces.length === 0 ? (
            <SelectItem value="__none__" disabled>
              No interfaces found
            </SelectItem>
          ) : (
            interfaces.map((iface) => {
              const isRecommended = iface.name === recommendedInterface
              const badges = statusBadges(iface, isRecommended)
              return (
                <SelectItem key={iface.name} value={iface.name}>
                  <span
                    className="flex min-w-0 items-center gap-3"
                    style={{ padding: '6px 0 6px 8px', width: '100%' }}
                  >
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
                    <span className="min-w-0" style={{ flex: 1 }}>
                      <span
                        style={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 13,
                          fontWeight: 500,
                          color: 'var(--nv-text-primary)',
                          lineHeight: 1.3
                        }}
                        title={hideInterfaceAddress(iface.displayName)}
                      >
                        {displayInterfaceName(iface)}
                      </span>
                      <span
                        style={{
                          display: 'flex',
                          gap: 6,
                          marginTop: 6,
                          flexWrap: 'wrap',
                          alignItems: 'center'
                        }}
                      >
                        {badges.map((badge) => (
                          <span
                            key={badge}
                            style={{
                              fontSize: 10,
                              color:
                                badge === 'Recommended'
                                  ? 'var(--proto-dns)'
                                  : 'var(--nv-text-secondary)',
                              border:
                                badge === 'Recommended'
                                  ? '1px solid var(--proto-dns-border)'
                                  : '1px solid var(--nv-border-subtle)',
                              borderRadius: 'var(--nv-radius-sm)',
                              padding: '2px 6px',
                              backgroundColor:
                                badge === 'Recommended' ? 'var(--proto-dns-dim)' : 'transparent',
                              fontWeight: 500,
                              lineHeight: 1
                            }}
                          >
                            {badge}
                          </span>
                        ))}
                      </span>
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
