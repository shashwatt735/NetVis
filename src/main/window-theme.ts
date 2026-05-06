import { nativeTheme, type BrowserWindow, type BrowserWindowConstructorOptions } from 'electron'
import type { ResolvedTheme, Theme } from '../shared/capture-types'

const TITLE_BAR_HEIGHT = 40

const TITLE_BAR_THEMES = {
  light: {
    color: '#fefcfa',
    symbolColor: '#5c5650',
    height: TITLE_BAR_HEIGHT
  },
  dark: {
    color: '#18181c',
    symbolColor: '#8a8a9a',
    height: TITLE_BAR_HEIGHT
  },
  'warm-dark': {
    color: '#1c1815',
    symbolColor: '#a89e96',
    height: TITLE_BAR_HEIGHT
  }
} satisfies Record<
  ResolvedTheme,
  {
    color: string
    symbolColor: string
    height: number
  }
>

export function resolveTitleBarTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  }
  return theme
}

export function titleBarWindowOptions(
  theme: ResolvedTheme
): Pick<BrowserWindowConstructorOptions, 'backgroundColor' | 'titleBarOverlay' | 'titleBarStyle'> {
  const overlay = TITLE_BAR_THEMES[theme]

  if (process.platform === 'darwin') {
    return {
      backgroundColor: overlay.color,
      titleBarStyle: 'hidden'
    }
  }

  return {
    backgroundColor: overlay.color,
    titleBarStyle: 'hidden',
    titleBarOverlay: overlay
  }
}

export function applyTitleBarTheme(window: BrowserWindow | null, theme: ResolvedTheme): void {
  if (!window) return

  const overlay = TITLE_BAR_THEMES[theme]
  window.setBackgroundColor(overlay.color)

  if (process.platform !== 'darwin') {
    window.setTitleBarOverlay(overlay)
  }
}
