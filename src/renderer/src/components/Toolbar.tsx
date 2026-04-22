import type React from 'react'
import { HelpCircle } from 'lucide-react'
import { useNetVisStore } from '../store'
import { AdvancedSettingsPanel } from './AdvancedSettingsPanel'
import { CaptureActiveIndicator } from './CaptureActiveIndicator'
import { CaptureControls } from './CaptureControls'
import { ChallengeSelector } from './ChallengeSelector'
import { FilterBar } from './FilterBar'
import { InterfaceSelector } from './InterfaceSelector'
import { ThemeToggle } from './ThemeToggle'
import { Button } from './ui/button'

/**
 * Top application toolbar.
 * Contains: logo, InterfaceSelector, CaptureControls, CaptureActiveIndicator,
 * FilterBar, ThemeToggle, Show Welcome Guide button.
 * Req 1.1, 1.4, 19.4, 21.4, 24.1, 24.2
 */
export function Toolbar(): React.JSX.Element {
  const captureStatus = useNetVisStore((s) => s.captureStatus)
  const setWelcomeSeen = useNetVisStore((s) => s.setWelcomeSeen)
  const isCapturing =
    captureStatus.state === 'active' ||
    captureStatus.state === 'file' ||
    captureStatus.state === 'simulated'

  const handleShowWelcome = (): void => {
    setWelcomeSeen(false)
  }

  return (
    <header
      role="banner"
      aria-label="Application toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 52,
        padding: '0 12px',
        backgroundColor: 'var(--nv-bg-surface-2)',
        borderBottom: '1px solid var(--nv-border-default)',
        flexShrink: 0,
        overflow: 'visible'
      }}
    >
      {/* ── Logo ── */}
      <div
        aria-label="NetVis branding"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
          paddingRight: 4
        }}
      >
        <span
          aria-label="NetVis"
          style={{
            fontFamily: 'var(--font-ui)',
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: '-0.3px',
            color: 'var(--nv-text-primary)',
            userSelect: 'none',
            whiteSpace: 'nowrap'
          }}
        >
          Net<span style={{ color: 'var(--proto-tcp)' }}>Vis</span>
        </span>
      </div>

      {/* ── Divider ── */}
      <span
        aria-hidden
        style={{ width: 1, height: 24, backgroundColor: 'var(--nv-border-default)', flexShrink: 0 }}
      />

      {/* ── Capture group: interface + controls + active indicator ── */}
      <div
        role="group"
        aria-label="Capture setup and controls"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
          minWidth: 0
        }}
      >
        <InterfaceSelector />
        <CaptureControls />
        {isCapturing && <CaptureActiveIndicator />}
      </div>

      {/* ── Filter bar (centered, flexible) ── */}
      <div
        style={{
          flex: 1,
          minWidth: 200,
          display: 'flex',
          justifyContent: 'center',
          padding: '0 4px'
        }}
      >
        <FilterBar />
      </div>

      {/* ── Utility group: challenges, guide, theme, settings ── */}
      <div
        role="group"
        aria-label="Utility controls"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          flexShrink: 0
        }}
      >
        <ChallengeSelector />

        <Button
          variant="ghost"
          size="sm"
          onClick={handleShowWelcome}
          aria-label="Open capture guide"
          title="Open capture guide"
          style={{
            height: 28,
            padding: '0 8px',
            gap: 5,
            fontSize: 13
          }}
        >
          <HelpCircle size={14} aria-hidden />
          Guide
        </Button>

        <ThemeToggle />
        <AdvancedSettingsPanel />
      </div>
    </header>
  )
}
