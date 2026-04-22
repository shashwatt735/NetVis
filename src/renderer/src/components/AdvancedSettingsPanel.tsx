import { Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import type React from 'react'
import { useNetVisStore } from '../store'
import { HelpIcon } from './HelpIcon'
import { Button } from './ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet'
import { Slider } from './ui/slider'
import { Switch } from './ui/switch'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'

/**
 * Slide-in settings panel anchored to the right.
 * Req 12.1, 13.4, 18.3, 18.6, 19.4, 20.2
 *
 * Controls:
 * - Theme toggle (light / dark / system)
 * - Buffer capacity slider
 * - Reduced motion switch
 * - Open log folder
 */
export function AdvancedSettingsPanel(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [bufferCapacity, setBufferCapacity] = useState(10000)
  const [reducedMotion, setReducedMotion] = useState(false)

  const theme = useNetVisStore((s) => s.theme)
  const persistTheme = useNetVisStore((s) => s.persistTheme)

  useEffect(() => {
    if (!open) return

    window.electronAPI
      .getSettings()
      .then((settings) => {
        setBufferCapacity(settings.bufferCapacity)
        setReducedMotion(settings.reducedMotion ?? false)
      })
      .catch((err: unknown) => {
        console.error('Failed to load settings:', err)
      })
  }, [open])

  const handleCapacityCommit = async (value: number[]): Promise<void> => {
    const capacity = value[0] ?? bufferCapacity
    setBufferCapacity(capacity)
    try {
      await window.electronAPI.setSettings({ bufferCapacity: capacity })
      await window.electronAPI.setBufferCapacity(capacity)
    } catch (err: unknown) {
      console.error('Failed to update buffer capacity:', err)
    }
  }

  const handleThemeChange = async (value: string): Promise<void> => {
    const nextTheme = value as 'light' | 'dark' | 'system'
    try {
      await persistTheme(nextTheme)
    } catch (err: unknown) {
      console.error('Failed to save theme:', err)
    }
  }

  const handleReducedMotionChange = async (checked: boolean): Promise<void> => {
    setReducedMotion(checked)
    document.documentElement.setAttribute('data-reduced-motion', checked ? 'true' : 'false')
    try {
      await window.electronAPI.setSettings({ reducedMotion: checked })
    } catch (err: unknown) {
      console.error('Failed to save reduced motion:', err)
    }
  }

  const handleOpenLogFolder = async (): Promise<void> => {
    try {
      await window.electronAPI.openLogFolder()
    } catch (err: unknown) {
      console.error('Failed to open log folder:', err)
    }
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-ui)',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--nv-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em'
  }

  const sectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  }

  const sectionCardStyle: React.CSSProperties = {
    ...sectionStyle,
    padding: '12px 14px',
    borderRadius: 'var(--nv-radius-lg)',
    border: '1px solid var(--nv-border-subtle)',
    backgroundColor: 'var(--nv-bg-surface-2)'
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Open advanced settings"
            style={{
              height: 'calc(var(--nv-control-height) - 4px)',
              minWidth: 'calc(var(--nv-control-height) - 4px)',
              padding: 0
            }}
          >
            <Settings size={14} aria-hidden />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          style={{
            width: 380,
            backgroundColor: 'var(--nv-bg-surface-1)',
            borderLeft: '1px solid var(--nv-border-default)',
            padding: '20px'
          }}
        >
          <SheetHeader style={{ marginBottom: 20 }}>
            <SheetTitle
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--nv-text-primary)'
              }}
            >
              Settings
            </SheetTitle>
          </SheetHeader>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14
            }}
          >
            <section style={sectionCardStyle}>
              <span style={labelStyle}>Appearance</span>
              <Tabs value={theme} onValueChange={handleThemeChange}>
                <TabsList style={{ width: '100%' }}>
                  <TabsTrigger value="light" style={{ flex: 1 }}>
                    Light
                  </TabsTrigger>
                  <TabsTrigger value="system" style={{ flex: 1 }}>
                    System
                  </TabsTrigger>
                  <TabsTrigger value="dark" style={{ flex: 1 }}>
                    Dark
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </section>

            <section style={sectionCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label htmlFor="buffer-capacity-slider" style={labelStyle}>
                  Buffer Capacity
                </label>
                <HelpIcon helpId="buffer-capacity" side="right" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Slider
                  id="buffer-capacity-slider"
                  min={1000}
                  max={100000}
                  step={1000}
                  value={[bufferCapacity]}
                  onValueChange={(value) => setBufferCapacity(value[0] ?? bufferCapacity)}
                  onValueCommit={handleCapacityCommit}
                  aria-label="Buffer capacity"
                  aria-valuemin={1000}
                  aria-valuemax={100000}
                  aria-valuenow={bufferCapacity}
                  style={{ flex: 1 }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: 11,
                    color: 'var(--nv-text-tertiary)',
                    minWidth: 52,
                    textAlign: 'right'
                  }}
                >
                  {bufferCapacity.toLocaleString()}
                </span>
              </div>
            </section>

            <section style={sectionCardStyle}>
              <div style={rowStyle}>
                <span style={labelStyle}>Reduce motion</span>
                <Switch
                  id="reduced-motion-switch"
                  checked={reducedMotion}
                  onCheckedChange={handleReducedMotionChange}
                  aria-label="Reduce motion"
                />
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: 12,
                  color: 'var(--nv-text-secondary)',
                  lineHeight: 1.5
                }}
              >
                Disables animations and transitions throughout the app.
              </span>
            </section>

            <section style={sectionCardStyle}>
              <span style={labelStyle}>Diagnostics</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenLogFolder}
                aria-label="Open log folder"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Open log folder
              </Button>
            </section>

          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
