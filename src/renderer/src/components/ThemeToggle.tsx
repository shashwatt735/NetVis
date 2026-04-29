import { Moon, Sun } from 'lucide-react'
import type React from 'react'
import { useNetVisStore } from '../store'
import { Button } from './ui/button'

export function ThemeToggle(): React.JSX.Element {
  const theme = useNetVisStore((s) => s.theme)
  const persistTheme = useNetVisStore((s) => s.persistTheme)
  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={nextTheme === 'dark' ? 'Switch to dark mode' : 'Switch to light mode'}
      onClick={() => {
        void persistTheme(nextTheme)
      }}
      style={{ width: 32, height: 32, padding: 0 }}
    >
      {nextTheme === 'dark' ? <Moon size={16} aria-hidden /> : <Sun size={16} aria-hidden />}
    </Button>
  )
}
