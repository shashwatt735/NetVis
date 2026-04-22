// @vitest-environment jsdom

import React from 'react'
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { ThemeToggle } from '../../renderer/src/components/ThemeToggle'
import { initializeTheme } from '../../renderer/src/store'
import { mockElectronAPI, renderWithStore, resetStore, screen, useNetVisStore } from './test-utils'

function createMatchMediaMock(matches = false): MediaQueryList {
  return {
    matches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  } as unknown as MediaQueryList
}

describe('Theme persistence and initialization', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('persists the next theme when toggled from the toolbar', async () => {
    const api = mockElectronAPI()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue(createMatchMediaMock(false))
    })

    const { user } = renderWithStore(<ThemeToggle />)
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }))

    expect(api.setSettings).toHaveBeenCalledWith({ theme: 'dark' })
    expect(useNetVisStore.getState().theme).toBe('dark')
  })

  it('returns a cleanup function that removes the system theme listener', () => {
    const mediaQuery = createMatchMediaMock(false)
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue(mediaQuery)
    })

    useNetVisStore.setState({ theme: 'system' })

    const cleanup = initializeTheme()

    expect(mediaQuery.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))

    cleanup()

    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })
})
