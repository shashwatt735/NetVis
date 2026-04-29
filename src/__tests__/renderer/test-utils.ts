/**
 * Renderer test utilities.
 *
 * Provides:
 *   - renderWithStore()  — render a React component with a fresh Zustand store
 *   - resetStore()       — reset useNetVisStore to initial state between tests
 *   - mockElectronAPI()  — install a typed window.electronAPI stub
 *   - makeAnonPacket()   — build a minimal valid AnonPacket for test data
 *
 * Usage:
 *   import { renderWithStore, resetStore, mockElectronAPI, makeAnonPacket } from './test-utils'
 */

import { cleanup, render } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, vi } from 'vitest'
import type { RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { useNetVisStore } from '../../renderer/src/store'
import type {
  AnonPacket,
  BufferStats,
  CaptureStatus,
  NetworkInterface,
  SpeedMultiplier,
  Theme
} from '../../shared/capture-types'

// ─── Auto-cleanup after each test ────────────────────────────────────────────

afterEach(() => {
  cleanup()
})

// ─── Store reset ──────────────────────────────────────────────────────────────

const STORE_INITIAL_STATE = {
  packets: [] as AnonPacket[],
  selectedPacketId: null as string | null,
  bufferStats: { count: 0, capacity: 10000, percentage: 0 } as BufferStats,
  bufferOverflowCount: 0,
  captureStatus: { state: 'idle' } as CaptureStatus,
  interfaces: [] as NetworkInterface[],
  activeInterface: null as string | null,
  filterExpression: '',
  filterError: null as string | null,
  filteredPackets: [] as AnonPacket[],
  activePage: 'capture' as const,
  previousPage: null as 'capture' | 'learn' | 'challenges' | 'settings' | null,
  theme: 'system' as Theme,
  focusVisualization: false,
  welcomeSeen: false,
  importResult: null as { packetCount: number; fileSizeBytes: number } | null,
  activeChallengeId: null as string | null,
  completedChallengeIds: [] as string[],
  challengeCompletion: null as { challengeId: string; packetId: string | null } | null
}

/**
 * Reset the Zustand store to its initial state.
 * Call in beforeEach for any test that touches the store.
 */
export function resetStore(): void {
  useNetVisStore.setState(STORE_INITIAL_STATE)
}

// ─── Render helper ────────────────────────────────────────────────────────────

/**
 * Render a React element with userEvent setup.
 * Wraps @testing-library/react render — extend with providers here as needed.
 */
export function renderWithStore(
  ui: ReactElement
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  return {
    ...render(ui),
    user: userEvent.setup()
  }
}

// ─── window.electronAPI mock ──────────────────────────────────────────────────

/**
 * Shape of the mocked electronAPI surface.
 * Extend as new IPC channels are added.
 */
export interface MockElectronAPI {
  getInterfaces: ReturnType<typeof vi.fn>
  startCapture: ReturnType<typeof vi.fn>
  stopCapture: ReturnType<typeof vi.fn>
  startSimulated: ReturnType<typeof vi.fn>
  startFile: ReturnType<typeof vi.fn>
  importPcap: ReturnType<typeof vi.fn>
  importPcapFromPath: ReturnType<typeof vi.fn>
  exportPcap: ReturnType<typeof vi.fn>
  selectPcapFile: ReturnType<typeof vi.fn>
  applyFilter: ReturnType<typeof vi.fn>
  getAllPackets: ReturnType<typeof vi.fn>
  clearBuffer: ReturnType<typeof vi.fn>
  setBufferCapacity: ReturnType<typeof vi.fn>
  getSettings: ReturnType<typeof vi.fn>
  setSettings: ReturnType<typeof vi.fn>
  openLogFolder: ReturnType<typeof vi.fn>
  onPacketBatch: ReturnType<typeof vi.fn>
  onCaptureStatus: ReturnType<typeof vi.fn>
  onBufferOverflow: ReturnType<typeof vi.fn>
  onBufferStats: ReturnType<typeof vi.fn>
}

/**
 * Install a fully-stubbed window.electronAPI on the global object.
 * All methods return sensible no-op defaults; override per-test as needed.
 *
 * Returns the mock object so callers can configure return values:
 *   const api = mockElectronAPI()
 *   api.getInterfaces.mockResolvedValue({ ok: true, interfaces: [...] })
 */
export function mockElectronAPI(overrides: Partial<MockElectronAPI> = {}): MockElectronAPI {
  const defaultSettings = {
    bufferCapacity: 10000,
    theme: 'system' as const,
    welcomeSeen: false,
    completedChallenges: [] as string[],
    reducedMotion: false
  }

  const api: MockElectronAPI = {
    getInterfaces: vi.fn().mockResolvedValue({ ok: true, interfaces: [] }),
    startCapture: vi.fn().mockResolvedValue(undefined),
    stopCapture: vi.fn().mockResolvedValue(undefined),
    startSimulated: vi.fn().mockResolvedValue(undefined),
    startFile: vi.fn().mockResolvedValue(undefined),
    importPcap: vi.fn().mockResolvedValue({ ok: true, packetCount: 0, fileSizeBytes: 0 }),
    importPcapFromPath: vi.fn().mockResolvedValue({ ok: true, packetCount: 0, fileSizeBytes: 0 }),
    exportPcap: vi.fn().mockResolvedValue({ ok: true }),
    selectPcapFile: vi.fn().mockResolvedValue({ ok: false }),
    applyFilter: vi.fn().mockResolvedValue({ packets: [], error: null }),
    getAllPackets: vi.fn().mockResolvedValue([]),
    clearBuffer: vi.fn().mockResolvedValue(undefined),
    setBufferCapacity: vi.fn().mockResolvedValue(undefined),
    getSettings: vi.fn().mockResolvedValue(defaultSettings),
    setSettings: vi.fn().mockImplementation(async (patch: Record<string, unknown>) => ({
      ...defaultSettings,
      ...patch
    })),
    openLogFolder: vi.fn().mockResolvedValue(undefined),
    // Push-channel listeners return a no-op unsubscribe function
    onPacketBatch: vi.fn().mockReturnValue(() => {}),
    onCaptureStatus: vi.fn().mockReturnValue(() => {}),
    onBufferOverflow: vi.fn().mockReturnValue(() => {}),
    onBufferStats: vi.fn().mockReturnValue(() => {}),
    ...overrides
  }

  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    writable: true,
    value: api
  })

  return api
}

// ─── Packet factory ───────────────────────────────────────────────────────────

let _packetSeq = 0

/**
 * Build a minimal valid AnonPacket.
 * Sequence number is auto-incremented so IDs are unique across a test run.
 * Reset between test files is not required — IDs are unique by construction.
 */
export function makeAnonPacket(overrides: Partial<AnonPacket> = {}): AnonPacket {
  const seq = ++_packetSeq
  return {
    id: `test-packet-${seq}`,
    timestamp: 1_700_000_000_000 + seq * 1000,
    sourceId: 'eth0',
    captureMode: 'live',
    wireLength: 64,
    layers: [],
    srcAddress: '10.0.0.1',
    dstAddress: '10.0.0.2',
    protocol: 'TCP',
    length: 64,
    ...overrides
  }
}

// ─── Re-exports for convenience ───────────────────────────────────────────────

export { render, cleanup } from '@testing-library/react'
export { userEvent } from '@testing-library/user-event'
export { screen, within, fireEvent, waitFor, act } from '@testing-library/react'
export { useNetVisStore }
export type { AnonPacket, BufferStats, CaptureStatus, NetworkInterface, SpeedMultiplier, Theme }
