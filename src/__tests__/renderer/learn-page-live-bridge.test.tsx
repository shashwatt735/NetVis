// @vitest-environment jsdom

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LearnPage } from '../../renderer/src/components/LearnPage'
import {
  fireEvent,
  mockElectronAPI,
  renderWithStore,
  resetStore,
  screen,
  useNetVisStore
} from './test-utils'

describe('Learn page', () => {
  beforeEach(() => {
    resetStore()
    mockElectronAPI()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('searches across topic body text and field terms', async () => {
    renderWithStore(<LearnPage />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Search learning topics' }), {
      target: { value: 'ttl' }
    })

    expect(screen.getByRole('button', { name: 'IP (IPv4)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ICMP' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ethernet' })).not.toBeInTheDocument()
  })

  it('bridges a protocol topic back to Capture with filter and challenge context', async () => {
    renderWithStore(<LearnPage />)

    fireEvent.click(screen.getByRole('button', { name: 'DNS' }))
    fireEvent.click(screen.getByRole('button', { name: /find a dns query/i }))

    expect(useNetVisStore.getState().filterExpression).toBe('proto == DNS')
    expect(useNetVisStore.getState().activeChallengeId).toBe('dns-query')
    expect(useNetVisStore.getState().activePage).toBe('capture')
  })
})
