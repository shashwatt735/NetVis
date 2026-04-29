// @vitest-environment jsdom

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CapturePage } from '../../renderer/src/components/CapturePage'
import { ChallengesPage } from '../../renderer/src/components/ChallengesPage'
import { PacketDetailInspector } from '../../renderer/src/components/PacketDetailInspector'
import {
  fireEvent,
  makeAnonPacket,
  mockElectronAPI,
  renderWithStore,
  resetStore,
  screen,
  useNetVisStore,
  within
} from './test-utils'

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

describe('Challenge page flow', () => {
  beforeEach(() => {
    resetStore()
    mockElectronAPI()
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('starts a challenge from the card grid and moves to Capture with its initial filter', () => {
    renderWithStore(<ChallengesPage />)

    const card = screen.getByText('Find A DNS Query').closest('article')
    expect(card).not.toBeNull()

    fireEvent.click(within(card!).getByRole('button', { name: /start challenge/i }))

    expect(useNetVisStore.getState().activeChallengeId).toBe('dns-query')
    expect(useNetVisStore.getState().filterExpression).toBe('proto == DNS')
    expect(useNetVisStore.getState().activePage).toBe('capture')
  })

  it('shows a Capture banner for the active challenge and lets the user exit it', () => {
    useNetVisStore.setState({ activeChallengeId: 'dns-query' })

    renderWithStore(<CapturePage />)

    expect(
      screen.getByRole('status', { name: /challenge active: find a dns query/i })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Exit challenge' }))

    expect(useNetVisStore.getState().activeChallengeId).toBeNull()
  })

  it('completes a selected-packet challenge from the inspector', () => {
    const packet = makeAnonPacket({
      protocol: 'DNS',
      layers: [
        {
          protocol: 'DNS',
          rawByteOffset: 42,
          rawByteLength: 32,
          fields: [
            {
              name: 'flags',
              label: 'Flags',
              value: 'Query',
              byteOffset: 42,
              byteLength: 2
            }
          ]
        }
      ]
    })

    useNetVisStore.setState({
      activeChallengeId: 'dns-query',
      packets: [packet],
      filteredPackets: [packet],
      selectedPacketId: packet.id
    })

    renderWithStore(<PacketDetailInspector />)

    fireEvent.click(screen.getByRole('button', { name: /i found one/i }))

    expect(screen.getByText('Challenge Complete')).toBeInTheDocument()
    expect(useNetVisStore.getState().completedChallengeIds).toContain('dns-query')
    expect(useNetVisStore.getState().activeChallengeId).toBeNull()
  })
})
