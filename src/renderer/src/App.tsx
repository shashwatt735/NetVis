import { useCallback, useEffect, useState } from 'react'
import type React from 'react'
import { AppShell } from './components/AppShell'
import { ChallengePanel } from './components/ChallengePanel'
import { WelcomeScreen } from './components/WelcomeScreen'
import { LoadingSplash } from './components/LoadingSplash'
import { Toaster } from './components/ui/sonner'
import { useNetVisStore, initializeTheme } from './store'

function App(): React.JSX.Element {
  const {
    addPackets,
    setCaptureStatus,
    setBufferStats,
    notifyBufferOverflow,
    setTheme,
    setWelcomeSeen,
    setCompletedChallenges
  } = useNetVisStore()

  // Loading state for splash screen
  const [isLoading, setIsLoading] = useState(true)
  const [showSplash, setShowSplash] = useState(true)

  const handleSplashComplete = useCallback(() => setShowSplash(false), [])

  // welcomeSeen drives whether the overlay is shown (Req 19.1)
  const welcomeSeen = useNetVisStore((s) => s.welcomeSeen)

  useEffect(() => {
    // Initialize theme from system preference
    const cleanupTheme = initializeTheme()

    // Load initial settings and packets
    const loadInitialData = async (): Promise<void> => {
      try {
        // Load settings first — apply persisted theme immediately to avoid flash (GAP-5)
        const settings = await window.electronAPI.getSettings()
        setTheme(settings.theme)
        setWelcomeSeen(settings.welcomeSeen)
        setCompletedChallenges(settings.completedChallenges)

        // Note: Interface enumeration is owned by InterfaceSelector component (ARCH-07)
        // to avoid duplicate getInterfaces() calls and lifecycle drift

        // Load existing packets from buffer
        const packets = await window.electronAPI.getAllPackets()
        if (packets.length > 0) {
          addPackets(packets)
        }

        // Mark loading as complete
        setIsLoading(false)
      } catch (err) {
        console.error('Failed to load initial data:', err)
        // Still mark as loaded even on error to show the app
        setIsLoading(false)
      }
    }

    loadInitialData()

    // Wire up IPC push channels
    const unsubscribePacketBatch = window.electronAPI.onPacketBatch((packets) => {
      try {
        addPackets(packets)
      } catch (err) {
        console.error('[App] onPacketBatch error:', err)
      }
    })

    const unsubscribeCaptureStatus = window.electronAPI.onCaptureStatus((status) => {
      try {
        setCaptureStatus(status)
      } catch (err) {
        console.error('[App] onCaptureStatus error:', err)
      }
    })

    const unsubscribeBufferOverflow = window.electronAPI.onBufferOverflow((info) => {
      notifyBufferOverflow(info.dropped)
    })

    const unsubscribeBufferStats = window.electronAPI.onBufferStats((stats) => {
      setBufferStats(stats)
    })

    // Cleanup on unmount
    return () => {
      cleanupTheme()
      unsubscribePacketBatch()
      unsubscribeCaptureStatus()
      unsubscribeBufferOverflow()
      unsubscribeBufferStats()
    }
  }, [
    addPackets,
    setCaptureStatus,
    setBufferStats,
    notifyBufferOverflow,
    setTheme,
    setWelcomeSeen,
    setCompletedChallenges
  ])

  return (
    <>
      {/* Loading splash screen - shows during initial data load */}
      {showSplash && (
        <LoadingSplash
          isReady={!isLoading}
          onComplete={handleSplashComplete}
        />
      )}

      <AppShell />
      <ChallengePanel />
      <Toaster />
      {/* Req 19.1: show on first launch; Req 19.3: dismissed state persisted */}
      {!welcomeSeen && (
        <WelcomeScreen
          onClose={async () => {
            // Persist to Settings_Store via IPC (canonical source of truth)
            await window.electronAPI.setSettings({ welcomeSeen: true })
            // Update renderer store to reflect persisted state
            setWelcomeSeen(true)
          }}
        />
      )}
    </>
  )
}

export default App
