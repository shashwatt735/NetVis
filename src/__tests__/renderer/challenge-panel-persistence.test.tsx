// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn()
  }
}))

import { toast } from 'sonner'
import { ChallengePanel } from '../../renderer/src/components/ChallengePanel'
import {
  act,
  makeAnonPacket,
  mockElectronAPI,
  renderWithStore,
  resetStore,
  useNetVisStore,
  waitFor
} from './test-utils'

function activateFilterByPortChallenge(): void {
  useNetVisStore.setState({
    activeChallengeId: 'filter-by-port',
    filterExpression: 'port == 80',
    filteredPackets: [makeAnonPacket({ protocol: 'TCP' })]
  })
}

describe('ChallengePanel persistence', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('persists completed challenges before updating local completion state', async () => {
    const api = mockElectronAPI({
      setSettings: vi.fn().mockResolvedValue({
        bufferCapacity: 10000,
        theme: 'system',
        welcomeSeen: false,
        completedChallenges: ['filter-by-port'],
        reducedMotion: false
      })
    })

    activateFilterByPortChallenge()
    renderWithStore(<ChallengePanel />)

    expect(useNetVisStore.getState().completedChallengeIds).toEqual([])

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    await waitFor(() =>
      expect(api.setSettings).toHaveBeenCalledWith({
        completedChallenges: ['filter-by-port']
      })
    )

    expect(useNetVisStore.getState().completedChallengeIds).toEqual(['filter-by-port'])
    expect(useNetVisStore.getState().activeChallengeId).toBeNull()
    expect(toast.success).toHaveBeenCalledTimes(1)
  })

  it('does not mark a challenge complete when persistence fails', async () => {
    const api = mockElectronAPI({
      setSettings: vi.fn().mockRejectedValue(new Error('disk full'))
    })
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    activateFilterByPortChallenge()
    renderWithStore(<ChallengePanel />)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    await waitFor(() => expect(api.setSettings).toHaveBeenCalledTimes(1))

    expect(useNetVisStore.getState().completedChallengeIds).toEqual([])
    expect(useNetVisStore.getState().activeChallengeId).toBe('filter-by-port')
    expect(toast.success).not.toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('does not trigger duplicate persistence calls while completion is already in flight', async () => {
    let resolveSettings: (() => void) | null = null
    const setSettings = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSettings = () => resolve(undefined)
        })
    )

    mockElectronAPI({ setSettings })

    activateFilterByPortChallenge()
    renderWithStore(<ChallengePanel />)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(setSettings).toHaveBeenCalledTimes(1)

    act(() => {
      useNetVisStore.setState({
        filteredPackets: [
          makeAnonPacket({ protocol: 'TCP' }),
          makeAnonPacket({ protocol: 'TCP', srcAddress: '10.0.0.3' })
        ]
      })
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(setSettings).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveSettings?.()
      await Promise.resolve()
    })
  })
})
