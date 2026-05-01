// @vitest-environment jsdom

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OnboardingHints } from '../../renderer/src/components/OnboardingHints'
import { ProtocolAnimations } from '../../renderer/src/components/ProtocolAnimations'
import {
  fireEvent,
  makeAnonPacket,
  mockElectronAPI,
  renderWithStore,
  resetStore,
  screen,
  useNetVisStore
} from './test-utils'

function installLocalStorageStub(): Storage {
  const values = new Map<string, string>()
  const storage: Storage = {
    get length() {
      return values.size
    },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      values.delete(key)
    }),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value)
    })
  }

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage
  })
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage
  })
  return storage
}

describe('Phase E/F refinements', () => {
  beforeEach(() => {
    resetStore()
    mockElectronAPI()
    installLocalStorageStub()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('resets educational animation controls when the animation topic changes', () => {
    const { rerender } = renderWithStore(<ProtocolAnimations animationId="dns-flow" />)

    fireEvent.click(screen.getByRole('button', { name: 'Next animation step' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next animation step' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next animation step' }))

    expect(screen.getByText('4/4')).toBeInTheDocument()

    rerender(<ProtocolAnimations animationId="tcp-handshake" />)

    expect(screen.getByText('1/3')).toBeInTheDocument()
    expect(screen.getAllByText('SYN').length).toBeGreaterThan(0)
  })

  it('enables live animation mode when matching capture packets exist', () => {
    const packet = makeAnonPacket({ protocol: 'DNS' })
    useNetVisStore.setState({
      packets: [packet],
      filteredPackets: [packet]
    })

    renderWithStore(<ProtocolAnimations animationId="dns-flow" />)

    const liveMode = screen.getByRole('button', { name: 'My Capture' })
    expect(liveMode).toBeEnabled()

    fireEvent.click(liveMode)
    expect(liveMode).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows and persists one-time onboarding hints', () => {
    useNetVisStore.setState({
      welcomeSeen: true,
      captureStatus: { state: 'active', iface: 'en0', startedAt: Date.now() }
    })

    renderWithStore(<OnboardingHints />)

    expect(screen.getByText('This Is Your Network Interface')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Got It' }))

    expect(window.localStorage.getItem('nv-hint-seen:first-capture-interface')).toBe('true')
  })

  it('dismisses the filter tip after user interaction', () => {
    useNetVisStore.setState({
      welcomeSeen: true,
      filterExpression: 'proto == DNS'
    })

    renderWithStore(<OnboardingHints />)

    expect(screen.getByText('Filter Tip')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(window.localStorage.getItem('nv-hint-seen:filter-tip')).toBe('true')
  })
})
