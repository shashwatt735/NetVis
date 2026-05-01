import type React from 'react'
import type { Theme } from '../../../shared/capture-types'
import { useNetVisStore } from '../store'
import { Button } from './ui/button'

const THEMES: Array<{ value: Theme; label: string }> = [
  { value: 'dark', label: 'Dark' },
  { value: 'warm-dark', label: 'Warm Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' }
]

function SettingsCard({
  title,
  description,
  children,
  wide = false
}: {
  title: string
  description: string
  children: React.ReactNode
  wide?: boolean
}): React.JSX.Element {
  return (
    <section
      style={{
        gridColumn: wide ? '1 / -1' : undefined,
        padding: 24,
        border: '1px solid var(--nv-border-subtle)',
        borderRadius: 'var(--nv-radius-lg)',
        backgroundColor: 'var(--nv-bg-surface-1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        height: '100%'
      }}
    >
      <div>
        <h2
          style={{
            margin: '0 0 6px',
            fontSize: 16,
            fontWeight: 650,
            color: 'var(--nv-text-primary)'
          }}
        >
          {title}
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--nv-text-secondary)', lineHeight: 1.5 }}>
          {description}
        </p>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {children}
      </div>
    </section>
  )
}

export function SettingsPage(): React.JSX.Element {
  const theme = useNetVisStore((s) => s.theme)
  const persistTheme = useNetVisStore((s) => s.persistTheme)
  const setWelcomeSeen = useNetVisStore((s) => s.setWelcomeSeen)
  const activeInterface = useNetVisStore((s) => s.activeInterface)
  const interfaces = useNetVisStore((s) => s.interfaces)
  const bufferStats = useNetVisStore((s) => s.bufferStats)
  const previousPage = useNetVisStore((s) => s.previousPage)
  const goBack = useNetVisStore((s) => s.goBack)

  // Resolve interface display name
  const interfaceObj = interfaces.find((iface) => iface.name === activeInterface)
  const displayName = interfaceObj?.displayName ?? activeInterface ?? 'Not selected'

  return (
    <section
      aria-label="Settings"
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '28px 34px',
        backgroundColor: 'var(--nv-bg-base)'
      }}
    >
      <div style={{ maxWidth: 1180, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <header>
          {previousPage && (
            <button
              type="button"
              onClick={goBack}
              className="nv-focus"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 14,
                background: 'none',
                border: '1px solid var(--nv-border-subtle)',
                borderRadius: 'var(--nv-radius-md)',
                padding: '6px 10px',
                cursor: 'pointer',
                color: 'var(--nv-text-secondary)',
                fontFamily: 'var(--font-ui)',
                fontSize: 12,
                fontWeight: 500,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--nv-border-default)'
                e.currentTarget.style.backgroundColor = 'var(--nv-bg-surface-2)'
                e.currentTarget.style.color = 'var(--nv-text-primary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--nv-border-subtle)'
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = 'var(--nv-text-secondary)'
              }}
            >
              ← Back
            </button>
          )}
          <p style={{ margin: 0, color: 'var(--nv-text-tertiary)', fontSize: 12 }}>Settings</p>
          <h1
            style={{
              margin: '4px 0 8px',
              fontSize: 28,
              color: 'var(--nv-text-primary)',
              fontWeight: 650
            }}
          >
            App Preferences
          </h1>
          <p
            style={{ maxWidth: 620, margin: 0, color: 'var(--nv-text-secondary)', fontSize: 14, fontWeight: 600, lineHeight: 1.6 }}
          >
            Tune capture behavior, appearance, privacy notes, and local help from one place.
          </p>
        </header>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 20,
            alignItems: 'stretch'
          }}
        >
          <SettingsCard title="Capture" description="Live capture defaults and buffer status.">
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: '8px 14px',
                margin: 0,
                color: 'var(--nv-text-secondary)',
                fontSize: 13
              }}
            >
              <dt style={{ color: 'var(--nv-text-tertiary)' }}>Default Interface</dt>
              <dd style={{ margin: 0, fontFamily: 'var(--font-data)' }}>
                {displayName}
              </dd>
              <dt style={{ color: 'var(--nv-text-tertiary)' }}>Buffer Usage</dt>
              <dd style={{ margin: 0, fontFamily: 'var(--font-data)' }}>
                {bufferStats.count.toLocaleString()} / {bufferStats.capacity.toLocaleString()} packets ({bufferStats.percentage}%)
              </dd>
            </dl>

            <div style={{ marginTop: 4 }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--nv-text-secondary)'
                }}
              >
                Buffer Capacity
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <Button
                  size="sm"
                  variant={bufferStats.capacity === 1000 ? 'default' : 'outline'}
                  onClick={() => {
                    void window.electronAPI.setBufferCapacity(1000)
                  }}
                >
                  1K
                </Button>
                <Button
                  size="sm"
                  variant={bufferStats.capacity === 10000 ? 'default' : 'outline'}
                  onClick={() => {
                    void window.electronAPI.setBufferCapacity(10000)
                  }}
                >
                  10K
                </Button>
                <Button
                  size="sm"
                  variant={bufferStats.capacity === 50000 ? 'default' : 'outline'}
                  onClick={() => {
                    void window.electronAPI.setBufferCapacity(50000)
                  }}
                >
                  50K
                </Button>
                <Button
                  size="sm"
                  variant={bufferStats.capacity === 100000 ? 'default' : 'outline'}
                  onClick={() => {
                    void window.electronAPI.setBufferCapacity(100000)
                  }}
                >
                  100K
                </Button>
              </div>
            </div>

            <p
              style={{
                margin: 0,
                color: 'var(--nv-text-tertiary)',
                fontSize: 12,
                lineHeight: 1.55
              }}
            >
              Older packets are dropped when the buffer fills. A full buffer never stores packet
              payloads.
            </p>
          </SettingsCard>

          <SettingsCard
            title="Appearance"
            description="Choose the color theme used by the app shell."
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {THEMES.map((item) => {
                const isActive = theme === item.value
                return (
                  <Button
                    key={item.value}
                    size="sm"
                    variant={isActive ? 'default' : 'outline'}
                    onClick={() => void persistTheme(item.value)}
                    aria-pressed={isActive}
                  >
                    {item.label}
                  </Button>
                )
              })}
            </div>
          </SettingsCard>

          <SettingsCard
            title="Privacy"
            description="NetVis keeps local capture data private by design."
          >
            <p
              style={{
                margin: 0,
                color: 'var(--nv-text-secondary)',
                lineHeight: 1.6,
                fontSize: 13
              }}
            >
              IP addresses, MAC addresses, and payload bytes are anonymized by default. This cannot
              be disabled in the app. Imported and exported PCAP files stay wherever you choose
              them on disk.
            </p>
          </SettingsCard>

          <SettingsCard
            title="Help and Guides"
            description="Replay onboarding or open diagnostics."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button size="sm" variant="outline" onClick={() => setWelcomeSeen(false)}>
                Replay Getting Started Guide
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void window.electronAPI.openLogFolder()
                }}
              >
                Open Log Folder
              </Button>
            </div>
          </SettingsCard>

          <SettingsCard title="About" description="Local app information." wide>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                color: 'var(--nv-text-secondary)',
                fontSize: 13
              }}
            >
              <span>Version: local build</span>
              <span style={{ color: 'var(--nv-text-tertiary)' }}>
                Documentation: bundled Learn page
              </span>
            </div>
          </SettingsCard>
        </div>
      </div>
    </section>
  )
}
