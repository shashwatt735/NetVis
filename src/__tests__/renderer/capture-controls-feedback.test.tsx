// @vitest-environment jsdom

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sonnerMocks = vi.hoisted(() => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}))

vi.mock('sonner', () => ({
  toast: sonnerMocks.toast
}))

vi.mock('../../renderer/src/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({
    children,
    ...props
  }: {
    children: React.ReactNode
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  SelectValue: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>
}))

vi.mock('../../renderer/src/components/HelpIcon', () => ({
  HelpIcon: () => <span aria-hidden="true">help</span>
}))

import { CaptureControls } from '../../renderer/src/components/CaptureControls'
import { act, mockElectronAPI, renderWithStore, resetStore, screen, useNetVisStore } from './test-utils'

function createDeferredPromise<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

describe('CaptureControls feedback', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
  })

  it('surfaces a clear live-capture-unavailable message when no interface is selected', async () => {
    const api = mockElectronAPI()
    useNetVisStore.setState({
      interfaces: [{ name: 'eth0', displayName: 'Ethernet', isUp: true }],
      activeInterface: null
    })
    const { user } = renderWithStore(<CaptureControls />)

    const startButton = screen.getByRole('button', { name: 'Start live capture' })
    expect(startButton).toBeEnabled()

    await user.click(startButton)

    expect(api.startCapture).not.toHaveBeenCalled()
    expect(sonnerMocks.toast.error).toHaveBeenCalledWith('Live capture unavailable', {
      description:
        'No network interface is available. Use Import or Replay to inspect a saved PCAP file.'
    })
  })

  it('shows a pending replay state while simulated replay is being started', async () => {
    const deferred = createDeferredPromise<void>()
    const api = mockElectronAPI({
      selectPcapFile: vi.fn().mockResolvedValue({ ok: true, path: 'C:/captures/demo.pcap' }),
      startSimulated: vi.fn().mockReturnValue(deferred.promise)
    })

    const { user } = renderWithStore(<CaptureControls />)

    await user.click(screen.getByRole('button', { name: 'Load PCAP file for simulated replay' }))

    expect(api.startSimulated).toHaveBeenCalledWith('C:/captures/demo.pcap', 1)
    expect(
      screen.getByRole('button', { name: 'Load PCAP file for simulated replay' })
    ).toHaveTextContent('Starting...')
    expect(screen.getByRole('button', { name: 'Import PCAP file' })).toBeDisabled()

    deferred.resolve(undefined)
  })

  it('disables export when there are no packets buffered', async () => {
    mockElectronAPI()

    renderWithStore(<CaptureControls />)

    const exportButton = screen.getByRole('button', {
      name: 'Export captured packets to PCAP file'
    })
    expect(exportButton).toBeDisabled()

    act(() => {
      useNetVisStore.setState({
        packets: [
          {
            id: 'packet-1',
            timestamp: 1_700_000_000_000,
            sourceId: 'eth0',
            captureMode: 'live',
            wireLength: 64,
            layers: [],
            srcAddress: '10.0.0.1',
            dstAddress: '10.0.0.2',
            protocol: 'TCP',
            length: 64
          }
        ]
      })
    })

    expect(
      screen.getByRole('button', { name: 'Export captured packets to PCAP file' })
    ).toBeEnabled()
  })
})
