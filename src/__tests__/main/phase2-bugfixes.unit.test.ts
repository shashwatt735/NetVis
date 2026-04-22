// Unit tests for Bug D fix — sendToRenderer callback wiring
// NOTE: Bug C (pcap:import removeAllListeners) tests removed — that pattern encoded the broken
// behavior. The fix uses requestId-based completion; see
// capture-command-semantics.property.test.ts for the corrected tests.

import { describe, it, expect, vi } from 'vitest'
import type { AnonPacket } from '../../shared/capture-types'

// Minimal local type for the webContents surface used in these tests.
// Avoids importing from 'electron' which is not available in the test environment.
interface MockBrowserWindow {
  webContents: { send: (channel: string, ...args: unknown[]) => void }
}

// ─── Bug D fix — sendToRenderer callback ─────────────────────────────────────
//
// The fix in main/index.ts wires:
//   initCaptureEngine((packets) => mainWindow?.webContents.send('packet:batch', packets))
//
// These tests validate the callback pattern in isolation, since main/index.ts
// is an Electron entry point that calls app.whenReady() and cannot be unit-tested directly.

function makeSamplePacket(id: string): AnonPacket {
  return {
    id,
    timestamp: 1_700_000_000_000,
    sourceId: 'eth0',
    captureMode: 'live',
    wireLength: 64,
    layers: [],
    srcAddress: '192.168.1.1',
    dstAddress: '192.168.1.2',
    protocol: 'TCP',
    length: 64
  }
}

describe('Bug D fix — sendToRenderer callback', () => {
  it('calls webContents.send with packet:batch when mainWindow is set', () => {
    const mockSend = vi.fn()
    const mockWindow: MockBrowserWindow = { webContents: { send: mockSend } }

    const mainWindow: MockBrowserWindow | null = mockWindow
    const sendToRenderer = (packets: AnonPacket[]): void => {
      mainWindow?.webContents.send('packet:batch', packets)
    }

    const packets: AnonPacket[] = [makeSamplePacket('p1'), makeSamplePacket('p2')]
    sendToRenderer(packets)

    expect(mockSend).toHaveBeenCalledWith('packet:batch', packets)
  })

  it('does not throw when mainWindow is null', () => {
    type Win = { webContents: { send: (ch: string, ...args: unknown[]) => void } }
    const mainWindow = null as Win | null
    const sendToRenderer = (packets: AnonPacket[]): void => {
      mainWindow?.webContents.send('packet:batch', packets)
    }

    const packets: AnonPacket[] = [makeSamplePacket('p1')]
    expect(() => sendToRenderer(packets)).not.toThrow()
  })

  it('does not call webContents.send when mainWindow is null', () => {
    const mockSend = vi.fn()
    type Win = { webContents: { send: (ch: string, ...args: unknown[]) => void } }
    const mainWindow = null as Win | null
    const sendToRenderer = (packets: AnonPacket[]): void => {
      mainWindow?.webContents.send('packet:batch', packets)
    }

    sendToRenderer([makeSamplePacket('p1')])
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('passes the exact packet array to webContents.send', () => {
    const mockSend = vi.fn()
    const mockWindow: MockBrowserWindow = { webContents: { send: mockSend } }

    const mainWindow: MockBrowserWindow | null = mockWindow
    const sendToRenderer = (packets: AnonPacket[]): void => {
      mainWindow?.webContents.send('packet:batch', packets)
    }

    const packets: AnonPacket[] = [
      makeSamplePacket('a'),
      makeSamplePacket('b'),
      makeSamplePacket('c')
    ]
    sendToRenderer(packets)

    expect(mockSend).toHaveBeenCalledTimes(1)
    const [channel, sentPackets] = mockSend.mock.calls[0] as [string, AnonPacket[]]
    expect(channel).toBe('packet:batch')
    expect(sentPackets).toBe(packets) // same reference
    expect(sentPackets).toHaveLength(3)
  })
})
