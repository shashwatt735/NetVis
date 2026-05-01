/**
 * Unit tests for the real Zustand store (useNetVisStore).
 * Feature: netvis-core, Task 13
 *
 * Strategy:
 * - Import and test the real useNetVisStore — no hand-rolled mocks.
 * - Reset store state via useNetVisStore.setState() in beforeEach.
 * - Mock window.electronAPI.applyFilter for setFilter tests (IPC boundary).
 * - Mock document.documentElement and window.matchMedia for setTheme tests (DOM boundary).
 * - Use vi.useFakeTimers() where the 300ms filter debounce would otherwise fire.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useNetVisStore } from '../../renderer/src/store'
import type {
  AnonPacket,
  BufferStats,
  CaptureStatus,
  NetworkInterface
} from '../../shared/capture-types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePacket(id: string, protocol: AnonPacket['protocol'] = 'TCP'): AnonPacket {
  return {
    id,
    timestamp: 1_700_000_000_000,
    sourceId: 'eth0',
    captureMode: 'live',
    wireLength: 64,
    layers: [],
    srcAddress: '10.0.0.1',
    dstAddress: '10.0.0.2',
    protocol,
    length: 64
  }
}

const INITIAL_STATE = {
  packets: [],
  selectedPacketId: null,
  bufferStats: { count: 0, capacity: 10000, percentage: 0 },
  bufferOverflowCount: 0,
  captureStatus: { state: 'idle' } as CaptureStatus,
  interfaces: [],
  activeInterface: null,
  filterExpression: '',
  filterError: null,
  filteredPackets: [],
  theme: 'system' as const,
  focusVisualization: false,
  welcomeSeen: false,
  activeChallengeId: null,
  completedChallengeIds: []
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  useNetVisStore.setState(INITIAL_STATE)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ─── Initial state ────────────────────────────────────────────────────────────

describe('NetVisStore — initial state', () => {
  it('has correct default values', () => {
    const s = useNetVisStore.getState()
    expect(s.packets).toEqual([])
    expect(s.selectedPacketId).toBeNull()
    expect(s.filterExpression).toBe('')
    expect(s.filterError).toBeNull()
    expect(s.filteredPackets).toEqual([])
    expect(s.theme).toBe('system')
    expect(s.focusVisualization).toBe(false)
    expect(s.welcomeSeen).toBe(false)
    expect(s.activeChallengeId).toBeNull()
    expect(s.completedChallengeIds).toEqual([])
    expect(s.bufferOverflowCount).toBe(0)
    expect(s.captureStatus).toEqual({ state: 'idle' })
    expect(s.interfaces).toEqual([])
    expect(s.activeInterface).toBeNull()
  })
})

// ─── addPacket ────────────────────────────────────────────────────────────────

describe('NetVisStore — addPacket', () => {
  it('appends packet to packets and filteredPackets when no filter is active', () => {
    const p = makePacket('p1')
    useNetVisStore.getState().addPacket(p)

    const s = useNetVisStore.getState()
    expect(s.packets).toHaveLength(1)
    expect(s.packets[0]).toEqual(p)
    expect(s.filteredPackets).toHaveLength(1)
    expect(s.filteredPackets[0]).toEqual(p)
  })

  it('appends to packets but NOT to filteredPackets when a filter is active', () => {
    // Set a non-empty filter expression (simulates active filter)
    useNetVisStore.setState({ filterExpression: 'proto == TCP' })

    const p = makePacket('p1')
    useNetVisStore.getState().addPacket(p)

    const s = useNetVisStore.getState()
    expect(s.packets).toHaveLength(1)
    // filteredPackets must NOT be updated — IPC re-evaluation handles it
    expect(s.filteredPackets).toHaveLength(0)
  })

  it('accumulates multiple addPacket calls', () => {
    useNetVisStore.getState().addPacket(makePacket('p1'))
    useNetVisStore.getState().addPacket(makePacket('p2'))
    useNetVisStore.getState().addPacket(makePacket('p3'))

    expect(useNetVisStore.getState().packets).toHaveLength(3)
    expect(useNetVisStore.getState().filteredPackets).toHaveLength(3)
  })
})

// ─── addPackets ───────────────────────────────────────────────────────────────

describe('NetVisStore — addPackets', () => {
  it('appends all packets to packets and filteredPackets when no filter is active', () => {
    const ps = [makePacket('p1'), makePacket('p2')]
    useNetVisStore.getState().addPackets(ps)

    const s = useNetVisStore.getState()
    expect(s.packets).toHaveLength(2)
    expect(s.filteredPackets).toHaveLength(2)
  })

  it('appends to packets but NOT to filteredPackets when a filter is active', () => {
    useNetVisStore.setState({ filterExpression: 'proto == UDP' })

    const ps = [makePacket('p1'), makePacket('p2')]
    useNetVisStore.getState().addPackets(ps)

    const s = useNetVisStore.getState()
    expect(s.packets).toHaveLength(2)
    expect(s.filteredPackets).toHaveLength(0)
  })

  it('handles empty array without error', () => {
    useNetVisStore.getState().addPackets([])
    expect(useNetVisStore.getState().packets).toHaveLength(0)
  })
})

// ─── clearPackets ─────────────────────────────────────────────────────────────

describe('NetVisStore — clearPackets', () => {
  it('resets packets, filteredPackets, and selectedPacketId', () => {
    useNetVisStore.setState({
      packets: [makePacket('p1')],
      filteredPackets: [makePacket('p1')],
      selectedPacketId: 'p1'
    })

    useNetVisStore.getState().clearPackets()

    const s = useNetVisStore.getState()
    expect(s.packets).toEqual([])
    expect(s.filteredPackets).toEqual([])
    expect(s.selectedPacketId).toBeNull()
  })

  it('is idempotent on an already-empty store', () => {
    useNetVisStore.getState().clearPackets()
    const s = useNetVisStore.getState()
    expect(s.packets).toEqual([])
    expect(s.filteredPackets).toEqual([])
    expect(s.selectedPacketId).toBeNull()
  })
})

// ─── selectPacket ─────────────────────────────────────────────────────────────

describe('NetVisStore — selectPacket', () => {
  it('sets selectedPacketId', () => {
    useNetVisStore.getState().selectPacket('p1')
    expect(useNetVisStore.getState().selectedPacketId).toBe('p1')
  })

  it('clears selectedPacketId when called with null', () => {
    useNetVisStore.setState({ selectedPacketId: 'p1' })
    useNetVisStore.getState().selectPacket(null)
    expect(useNetVisStore.getState().selectedPacketId).toBeNull()
  })
})

// ─── setFilter ────────────────────────────────────────────────────────────────

describe('NetVisStore — setFilter', () => {
  it('updates filterExpression immediately (before debounce fires)', () => {
    useNetVisStore.getState().setFilter('proto == TCP')
    // Expression is set synchronously; debounce has not fired yet
    expect(useNetVisStore.getState().filterExpression).toBe('proto == TCP')
  })

  it('clears filterExpression when set to empty string', () => {
    useNetVisStore.setState({ filterExpression: 'proto == TCP' })
    useNetVisStore.getState().setFilter('')
    expect(useNetVisStore.getState().filterExpression).toBe('')
  })

  it('empty filter sets filteredPackets to all packets without IPC call', async () => {
    const ps = [makePacket('p1'), makePacket('p2')]
    useNetVisStore.setState({ packets: ps })

    useNetVisStore.getState().setFilter('')

    // Advance timers to fire the debounce
    await vi.runAllTimersAsync()

    const s = useNetVisStore.getState()
    expect(s.filteredPackets).toEqual(ps)
    expect(s.filterError).toBeNull()
  })

  it('non-empty filter calls window.electronAPI.applyFilter after debounce', async () => {
    const mockApplyFilter = vi.fn().mockResolvedValue({ packets: [], error: null })
    vi.stubGlobal('window', { electronAPI: { applyFilter: mockApplyFilter } })

    useNetVisStore.getState().setFilter('proto == TCP')
    expect(mockApplyFilter).not.toHaveBeenCalled() // not yet — debounce pending

    await vi.runAllTimersAsync()
    expect(mockApplyFilter).toHaveBeenCalledWith('proto == TCP')
  })

  it('filter IPC error sets filterError and does not update filteredPackets', async () => {
    const mockApplyFilter = vi
      .fn()
      .mockResolvedValue({ packets: [], error: 'parse error at position 5' })
    vi.stubGlobal('window', { electronAPI: { applyFilter: mockApplyFilter } })

    const ps = [makePacket('p1')]
    useNetVisStore.setState({ packets: ps, filteredPackets: ps })

    useNetVisStore.getState().setFilter('proto ===')
    await vi.runAllTimersAsync()

    const s = useNetVisStore.getState()
    expect(s.filterError).toBe('parse error at position 5')
    // filteredPackets must be unchanged on parse error
    expect(s.filteredPackets).toEqual(ps)
  })

  it('successful filter IPC call updates filteredPackets and clears filterError', async () => {
    const p1 = makePacket('p1', 'TCP')
    const p2 = makePacket('p2', 'UDP')
    const mockApplyFilter = vi.fn().mockResolvedValue({ packets: [p1], error: null })
    vi.stubGlobal('window', { electronAPI: { applyFilter: mockApplyFilter } })

    useNetVisStore.setState({
      packets: [p1, p2],
      filteredPackets: [p1, p2],
      filterError: 'old error'
    })

    useNetVisStore.getState().setFilter('proto == TCP')
    await vi.runAllTimersAsync()

    const s = useNetVisStore.getState()
    expect(s.filteredPackets).toEqual([p1])
    expect(s.filterError).toBeNull()
  })

  it('IPC failure degrades gracefully — shows all packets, clears error', async () => {
    const mockApplyFilter = vi.fn().mockRejectedValue(new Error('IPC channel closed'))
    vi.stubGlobal('window', { electronAPI: { applyFilter: mockApplyFilter } })

    const ps = [makePacket('p1'), makePacket('p2')]
    useNetVisStore.setState({ packets: ps })

    useNetVisStore.getState().setFilter('proto == TCP')
    await vi.runAllTimersAsync()

    const s = useNetVisStore.getState()
    expect(s.filteredPackets).toEqual(ps)
    expect(s.filterError).toBeNull()
  })
})

// ─── setCaptureStatus ─────────────────────────────────────────────────────────

describe('NetVisStore — setCaptureStatus', () => {
  it('updates captureStatus', () => {
    const status: CaptureStatus = { state: 'active', iface: 'eth0', startedAt: Date.now() }
    useNetVisStore.getState().setCaptureStatus(status)
    expect(useNetVisStore.getState().captureStatus).toEqual(status)
  })

  it('sets activeInterface when state becomes active', () => {
    const status: CaptureStatus = { state: 'active', iface: 'eth0', startedAt: Date.now() }
    useNetVisStore.getState().setCaptureStatus(status)
    expect(useNetVisStore.getState().activeInterface).toBe('eth0')
  })

  it('keeps activeInterface when state becomes idle', () => {
    useNetVisStore.setState({ activeInterface: 'eth0' })
    useNetVisStore.getState().setCaptureStatus({ state: 'idle' })
    expect(useNetVisStore.getState().activeInterface).toBe('eth0')
  })

  it('keeps activeInterface when state becomes stopped', () => {
    useNetVisStore.setState({ activeInterface: 'eth0' })
    useNetVisStore.getState().setCaptureStatus({ state: 'stopped' })
    expect(useNetVisStore.getState().activeInterface).toBe('eth0')
  })

  it('keeps activeInterface when state becomes error', () => {
    useNetVisStore.setState({ activeInterface: 'eth0' })
    useNetVisStore.getState().setCaptureStatus({ state: 'error', message: 'fail' })
    expect(useNetVisStore.getState().activeInterface).toBe('eth0')
  })

  it('does not clear activeInterface when state becomes file', () => {
    useNetVisStore.setState({ activeInterface: 'eth0' })
    useNetVisStore.getState().setCaptureStatus({ state: 'file', path: '/tmp/a.pcap' })
    // file mode does not clear activeInterface per current implementation
    expect(useNetVisStore.getState().activeInterface).toBe('eth0')
  })
})

// ─── setInterfaces / setActiveInterface ───────────────────────────────────────

describe('NetVisStore — setInterfaces / setActiveInterface', () => {
  it('setInterfaces replaces the interfaces list', () => {
    const ifaces: NetworkInterface[] = [
      { name: 'eth0', displayName: 'Ethernet', isUp: true },
      { name: 'lo', displayName: 'Loopback', isUp: true }
    ]
    useNetVisStore.getState().setInterfaces(ifaces)
    expect(useNetVisStore.getState().interfaces).toEqual(ifaces)
  })

  it('setActiveInterface sets the active interface', () => {
    useNetVisStore.getState().setActiveInterface('eth0')
    expect(useNetVisStore.getState().activeInterface).toBe('eth0')
  })

  it('setActiveInterface accepts null', () => {
    useNetVisStore.setState({ activeInterface: 'eth0' })
    useNetVisStore.getState().setActiveInterface(null)
    expect(useNetVisStore.getState().activeInterface).toBeNull()
  })

  it('stores interface preference state separately from selection', () => {
    useNetVisStore.getState().setPreferredInterfaceName('eth0')
    useNetVisStore.getState().setAutoSelectInterface(false)
    expect(useNetVisStore.getState().preferredInterfaceName).toBe('eth0')
    expect(useNetVisStore.getState().autoSelectInterface).toBe(false)
  })
})

// ─── setTheme ─────────────────────────────────────────────────────────────────

describe('NetVisStore — setTheme', () => {
  beforeEach(() => {
    // Stub DOM APIs required by applyTheme()
    const classList = { add: vi.fn(), remove: vi.fn() }
    vi.stubGlobal('document', { documentElement: { classList } })
    vi.stubGlobal('window', {
      matchMedia: vi.fn().mockReturnValue({ matches: false })
    })
  })

  it('updates theme to dark', () => {
    useNetVisStore.getState().setTheme('dark')
    expect(useNetVisStore.getState().theme).toBe('dark')
  })

  it('updates theme to light', () => {
    useNetVisStore.getState().setTheme('light')
    expect(useNetVisStore.getState().theme).toBe('light')
  })

  it('updates theme to system', () => {
    useNetVisStore.getState().setTheme('system')
    expect(useNetVisStore.getState().theme).toBe('system')
  })
})

// ─── toggleFocusVisualization ─────────────────────────────────────────────────

describe('NetVisStore — toggleFocusVisualization', () => {
  it('toggles from false to true', () => {
    expect(useNetVisStore.getState().focusVisualization).toBe(false)
    useNetVisStore.getState().toggleFocusVisualization()
    expect(useNetVisStore.getState().focusVisualization).toBe(true)
  })

  it('toggles from true to false', () => {
    useNetVisStore.setState({ focusVisualization: true })
    useNetVisStore.getState().toggleFocusVisualization()
    expect(useNetVisStore.getState().focusVisualization).toBe(false)
  })

  it('double-toggle returns to original value', () => {
    useNetVisStore.getState().toggleFocusVisualization()
    useNetVisStore.getState().toggleFocusVisualization()
    expect(useNetVisStore.getState().focusVisualization).toBe(false)
  })
})

// ─── Challenge actions ────────────────────────────────────────────────────────

describe('NetVisStore — challenge actions', () => {
  it('activateChallenge sets activeChallengeId', () => {
    useNetVisStore.getState().activateChallenge('challenge-1')
    expect(useNetVisStore.getState().activeChallengeId).toBe('challenge-1')
  })

  it('activateChallenge accepts null to deactivate', () => {
    useNetVisStore.setState({ activeChallengeId: 'challenge-1' })
    useNetVisStore.getState().activateChallenge(null)
    expect(useNetVisStore.getState().activeChallengeId).toBeNull()
  })

  it('completeChallenge adds id to completedChallengeIds and clears activeChallengeId', () => {
    useNetVisStore.setState({ activeChallengeId: 'challenge-1' })
    useNetVisStore.getState().completeChallenge('challenge-1')

    const s = useNetVisStore.getState()
    expect(s.completedChallengeIds).toContain('challenge-1')
    expect(s.activeChallengeId).toBeNull()
  })

  it('completeChallenge accumulates multiple completed ids', () => {
    useNetVisStore.getState().completeChallenge('c1')
    useNetVisStore.getState().completeChallenge('c2')
    useNetVisStore.getState().completeChallenge('c3')

    expect(useNetVisStore.getState().completedChallengeIds).toEqual(['c1', 'c2', 'c3'])
  })

  it('setCompletedChallenges replaces the completed list', () => {
    useNetVisStore.setState({ completedChallengeIds: ['c1', 'c2'] })
    useNetVisStore.getState().setCompletedChallenges(['c3', 'c4', 'c5'])
    expect(useNetVisStore.getState().completedChallengeIds).toEqual(['c3', 'c4', 'c5'])
  })
})

// ─── Buffer stats and overflow ────────────────────────────────────────────────

describe('NetVisStore — buffer stats and overflow', () => {
  it('setBufferStats updates bufferStats', () => {
    const stats: BufferStats = { count: 500, capacity: 10000, percentage: 5 }
    useNetVisStore.getState().setBufferStats(stats)
    expect(useNetVisStore.getState().bufferStats).toEqual(stats)
  })

  it('notifyBufferOverflow increments bufferOverflowCount by 1 each call', () => {
    useNetVisStore.getState().notifyBufferOverflow(1)
    expect(useNetVisStore.getState().bufferOverflowCount).toBe(1)

    useNetVisStore.getState().notifyBufferOverflow(5)
    expect(useNetVisStore.getState().bufferOverflowCount).toBe(2)

    useNetVisStore.getState().notifyBufferOverflow(10)
    expect(useNetVisStore.getState().bufferOverflowCount).toBe(3)
  })

  it('bufferOverflowCount is independent of the dropped parameter value', () => {
    // Counter always increments by 1 regardless of how many packets were dropped
    useNetVisStore.getState().notifyBufferOverflow(100)
    expect(useNetVisStore.getState().bufferOverflowCount).toBe(1)
  })
})

// ─── setWelcomeSeen ───────────────────────────────────────────────────────────

describe('NetVisStore — setWelcomeSeen', () => {
  it('sets welcomeSeen to true', () => {
    useNetVisStore.getState().setWelcomeSeen(true)
    expect(useNetVisStore.getState().welcomeSeen).toBe(true)
  })

  it('sets welcomeSeen back to false', () => {
    useNetVisStore.setState({ welcomeSeen: true })
    useNetVisStore.getState().setWelcomeSeen(false)
    expect(useNetVisStore.getState().welcomeSeen).toBe(false)
  })
})
