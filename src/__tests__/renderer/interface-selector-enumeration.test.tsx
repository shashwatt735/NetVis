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
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>
}))

import { InterfaceSelector } from '../../renderer/src/components/InterfaceSelector'
import { mockElectronAPI, renderWithStore, resetStore, screen, useNetVisStore } from './test-utils'

describe('InterfaceSelector enumeration states', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
  })

  it('renders backend enumeration errors distinctly from an empty interface list', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const api = mockElectronAPI({
      getInterfaces: vi.fn().mockResolvedValue({
        ok: false,
        error: 'The packet capture library could not be loaded. Live capture is unavailable.',
        platformHint: 'Run NetVis as Administrator, and ensure Npcap is installed from npcap.com.'
      })
    })

    renderWithStore(<InterfaceSelector />)
    expect(api.getInterfaces).toHaveBeenCalledTimes(1)

    expect(await screen.findByRole('alert')).toHaveTextContent('Live capture unavailable')
    expect(screen.queryByText('No interfaces found')).not.toBeInTheDocument()
    expect(useNetVisStore.getState().activeInterface).toBeNull()
    expect(sonnerMocks.toast.error).toHaveBeenCalledWith('Live capture unavailable', {
      id: 'interface-enumeration-error',
      duration: 20000,
      description:
        'The packet capture library could not be loaded. Live capture is unavailable. Run NetVis as Administrator, and ensure Npcap is installed from npcap.com.'
    })

    consoleErrorSpy.mockRestore()
  })

  it('auto-selects the first alphabetized interface without re-enumerating', async () => {
    const api = mockElectronAPI({
      getInterfaces: vi.fn().mockResolvedValue({
        ok: true,
        interfaces: [
          { name: 'wifi0', displayName: 'Wi-Fi', isUp: true },
          { name: 'eth0', displayName: 'Ethernet', isUp: true }
        ]
      })
    })

    renderWithStore(<InterfaceSelector />)

    await vi.waitFor(() => {
      expect(useNetVisStore.getState().activeInterface).toBe('eth0')
    })

    expect(api.getInterfaces).toHaveBeenCalledTimes(1)
  })
})
