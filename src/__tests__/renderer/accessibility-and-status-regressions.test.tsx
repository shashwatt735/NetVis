// @vitest-environment jsdom

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CaptureActiveIndicator } from '../../renderer/src/components/CaptureActiveIndicator'
import { HelpIcon } from '../../renderer/src/components/HelpIcon'
import { PacketDetailInspector } from '../../renderer/src/components/PacketDetailInspector'
import { PacketList } from '../../renderer/src/components/PacketList'
import { renderWithStore, resetStore, screen, useNetVisStore, makeAnonPacket } from './test-utils'

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

describe('Status and accessibility regressions', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  })

  it('shows a mode-accurate status label for simulated replay', () => {
    useNetVisStore.setState({
      captureStatus: { state: 'simulated', path: '/tmp/replay.pcap', speed: 2 }
    })

    renderWithStore(<CaptureActiveIndicator />)

    expect(screen.getByRole('status', { name: 'Simulated replay active at 2x speed' })).toHaveTextContent(
      'Replay'
    )
  })

  it('uses listbox semantics for the packet list instead of an incomplete grid', () => {
    const packet = makeAnonPacket()
    useNetVisStore.setState({
      packets: [packet],
      filteredPackets: [packet],
      selectedPacketId: packet.id
    })

    const { container } = renderWithStore(<PacketList />)

    expect(screen.getByRole('listbox', { name: 'Packet list' })).toBeInTheDocument()
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
    expect(container.querySelector('[aria-rowindex="0"]')).toBeNull()
  })

  it('removes incomplete grid semantics from the packet inspector while keeping field labels accessible', () => {
    const packet = makeAnonPacket({
      layers: [
        {
          protocol: 'TCP',
          rawByteOffset: 0,
          rawByteLength: 20,
          fields: [
            {
              name: 'srcPort',
              label: 'Source Port',
              value: 443,
              byteOffset: 0,
              byteLength: 2
            }
          ]
        }
      ]
    })

    useNetVisStore.setState({
      packets: [packet],
      filteredPackets: [packet],
      selectedPacketId: packet.id
    })

    renderWithStore(<PacketDetailInspector />)

    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Source Port: 443')).toBeInTheDocument()
  })

  it('uses a larger, accessible help icon target without changing the help label', () => {
    renderWithStore(<HelpIcon helpId="filter-bar" />)

    expect(screen.getByRole('button', { name: 'Help: Packet Filter' })).toHaveStyle({
      width: '24px',
      height: '24px'
    })
  })
})
