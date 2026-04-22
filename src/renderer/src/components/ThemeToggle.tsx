import { Monitor, Moon, Sun } from 'lucide-react'
import type React from 'react'
import { useNetVisStore } from '../store'
import { Button } from './ui/button'

/**
 * Dark / Light / System theme toggle wired to store.setTheme().
 * Req 18.3, 18.6
 */
export function ThemeToggle(): React.JSX.Element {
  const theme = useNetVisStore((s) => s.theme)
  const persistTheme = useNetVisStore((s) => s.persistTheme)

  const cycle = async (): Promise<void> => {
    const nextTheme = theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system'
    try {
      await persistTheme(nextTheme)
    } catch (err: unknown) {
      console.error('Failed to save theme from toolbar:', err)
    }
  }

  const label =
    theme === 'dark'
      ? 'Switch to light mode'
      : theme === 'light'
        ? 'Switch to system theme'
        : 'Switch to dark mode'

  const icon =
    theme === 'dark' ? (
      <Moon size={16} aria-hidden />
    ) : theme === 'light' ? (
      <Sun size={16} aria-hidden />
    ) : (
      <Monitor size={16} aria-hidden />
    )

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => {
        void cycle()
      }}
      aria-label={label}
      title={label}
      style={{
        height: 28,
        minWidth: 28,
        padding: '0 var(--nv-space-2)'
      }}
    >
      {icon}
    </Button>
  )
}
