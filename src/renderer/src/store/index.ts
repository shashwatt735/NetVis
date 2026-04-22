/**
 * Zustand store — single source of truth for all renderer state.
 * Wired to IPC push channels in App.tsx.
 */

import { create } from 'zustand'
import type {
  AnonPacket,
  BufferStats,
  CaptureStatus,
  NetworkInterface
} from '../../../shared/capture-types'

// ─── Store Shape ─────────────────────────────────────────────────────────────

interface NetVisStore {
  // Packet data
  packets: AnonPacket[]
  selectedPacketId: string | null
  bufferStats: BufferStats
  bufferOverflowCount: number // Track overflow events (Req 12.3, Req 20.4)

  // Capture state
  captureStatus: CaptureStatus
  interfaces: NetworkInterface[]
  activeInterface: string | null

  // Filter
  filterExpression: string
  filterError: string | null
  filteredPackets: AnonPacket[] // derived, recomputed on packets/filterExpression change

  // UI
  theme: 'light' | 'dark' | 'system'
  focusVisualization: boolean
  welcomeSeen: boolean

  // PCAP import result — shown in status bar after import (Req 7.4)
  importResult: { packetCount: number; fileSizeBytes: number } | null

  // Challenge
  activeChallengeId: string | null
  completedChallengeIds: string[]

  // Actions
  addPacket(p: AnonPacket): void
  addPackets(ps: AnonPacket[]): void
  clearPackets(): void
  selectPacket(id: string | null): void
  setFilter(expression: string): void
  setCaptureStatus(status: CaptureStatus): void
  setInterfaces(interfaces: NetworkInterface[]): void
  setActiveInterface(iface: string | null): void
  setTheme(theme: 'light' | 'dark' | 'system'): void
  persistTheme(theme: 'light' | 'dark' | 'system'): Promise<void>
  toggleFocusVisualization(): void
  activateChallenge(id: string | null): void
  completeChallenge(id: string): void
  setBufferStats(stats: BufferStats): void
  notifyBufferOverflow(dropped: number): void
  setWelcomeSeen(seen: boolean): void
  setCompletedChallenges(ids: string[]): void
  setImportResult(result: { packetCount: number; fileSizeBytes: number } | null): void
}

// ─── Filter Logic ────────────────────────────────────────────────────────────

/**
 * Debounced filter application via IPC.
 * Sends the expression to the main process (filter:apply), which parses it
 * with the full Filter_Grammar and evaluates against the Packet_Buffer.
 * Req 9.1–9.5
 */
let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null
const FILTER_DEBOUNCE_MS = 300

// BUG-8: generation counter prevents stale concurrent IPC results from
// overwriting a newer filter result during high-throughput live capture.
let filterGeneration = 0

async function applyFilterViaIpc(
  expression: string,
  allPackets: AnonPacket[],
  selectedPacketId: string | null,
  set: (partial: Partial<NetVisStore>) => void
): Promise<void> {
  // Capture generation at call time; discard result if superseded
  const generation = ++filterGeneration

  // Empty expression — show all packets immediately, no IPC needed
  if (!expression.trim()) {
    set({ filteredPackets: allPackets, filterError: null })
    return
  }

  try {
    const result = await window.electronAPI.applyFilter(expression)

    // Discard if a newer call has already resolved or is in flight
    if (generation !== filterGeneration) return

    if (result.error) {
      // Parse error — keep current list visible, show inline error (Req 9.4)
      set({ filterError: result.error })
      return
    }

    // Clear error, update filtered list
    let newSelectedId = selectedPacketId
    if (newSelectedId) {
      const stillVisible = result.packets.some((p) => p.id === newSelectedId)
      if (!stillVisible) newSelectedId = null
    }

    set({
      filteredPackets: result.packets,
      filterError: null,
      selectedPacketId: newSelectedId
    })
  } catch {
    if (generation !== filterGeneration) return
    // IPC failure — degrade gracefully, show all packets
    set({ filteredPackets: allPackets, filterError: null })
  }
}

// ─── Store Implementation ────────────────────────────────────────────────────

export const useNetVisStore = create<NetVisStore>((set, get) => ({
  // Initial state
  packets: [],
  selectedPacketId: null,
  bufferStats: { count: 0, capacity: 10000, percentage: 0 },
  bufferOverflowCount: 0,
  captureStatus: { state: 'idle' },
  interfaces: [],
  activeInterface: null,
  filterExpression: '',
  filterError: null,
  filteredPackets: [],
  theme: 'system',
  focusVisualization: false,
  welcomeSeen: false,
  importResult: null,
  activeChallengeId: null,
  completedChallengeIds: [],

  // Actions
  addPacket: (p: AnonPacket) => {
    set((state) => {
      const newPackets = [...state.packets, p]
      // If no filter active, append directly; otherwise re-evaluate via IPC on next debounce
      const newFilteredPackets = !state.filterExpression.trim()
        ? [...state.filteredPackets, p]
        : state.filteredPackets

      return { packets: newPackets, filteredPackets: newFilteredPackets }
    })
  },

  addPackets: (ps: AnonPacket[]) => {
    set((state) => {
      const newPackets = [...state.packets, ...ps]
      // If no filter active, append all immediately
      const newFilteredPackets = !state.filterExpression.trim()
        ? [...state.filteredPackets, ...ps]
        : state.filteredPackets

      return { packets: newPackets, filteredPackets: newFilteredPackets }
    })
    
    // If filter is active, trigger immediate re-evaluation (don't wait for debounce)
    // This ensures packets appear in real-time during capture
    const state = get()
    if (state.filterExpression.trim()) {
      // Bump generation so any previous in-flight call is discarded (BUG-8)
      filterGeneration++
      void applyFilterViaIpc(state.filterExpression, state.packets, state.selectedPacketId, set)
    }
  },

  clearPackets: () => {
    set({
      packets: [],
      filteredPackets: [],
      selectedPacketId: null,
      importResult: null
    })
  },

  selectPacket: (id: string | null) => {
    set({ selectedPacketId: id })
  },

  setFilter: (expression: string) => {
    // Update expression immediately for responsive UI
    set({ filterExpression: expression })

    // Clear existing debounce timer
    if (filterDebounceTimer) clearTimeout(filterDebounceTimer)

    // Bump generation so any in-flight IPC call for the old expression is discarded
    filterGeneration++

    // Debounce the IPC call (Req 9.2 — 300ms for up to 100k packets)
    filterDebounceTimer = setTimeout(() => {
      const state = get()
      void applyFilterViaIpc(expression, state.packets, state.selectedPacketId, set)
    }, FILTER_DEBOUNCE_MS)
  },

  setCaptureStatus: (status: CaptureStatus) => {
    set((state) => {
      // Track active interface when capture starts
      let activeInterface = state.activeInterface
      if (status.state === 'active') {
        activeInterface = status.iface
      } else if (status.state === 'error') {
        // Only clear interface on error — preserve it on stopped/idle so user can restart
        activeInterface = null
      }
      // Clear import result when a new capture session starts (BUG-2)
      const importResult =
        status.state === 'active' || status.state === 'file' || status.state === 'simulated'
          ? null
          : state.importResult
      return { captureStatus: status, activeInterface, importResult }
    })
  },

  setInterfaces: (interfaces: NetworkInterface[]) => {
    set({ interfaces })
  },

  setActiveInterface: (iface: string | null) => {
    set({ activeInterface: iface })
  },

  setTheme: (theme: 'light' | 'dark' | 'system') => {
    set({ theme })
    // Apply theme to HTML element
    applyTheme(theme)
  },

  persistTheme: async (theme: 'light' | 'dark' | 'system') => {
    set({ theme })
    applyTheme(theme)
    await window.electronAPI.setSettings({ theme })
  },

  toggleFocusVisualization: () => {
    set((state) => ({ focusVisualization: !state.focusVisualization }))
  },

  activateChallenge: (id: string | null) => {
    set({ activeChallengeId: id })
  },

  completeChallenge: (id: string) => {
    set((state) => {
      const completedChallengeIds = [...state.completedChallengeIds, id]
      // Persist to settings store (GAP-4: completions were lost on restart)
      void window.electronAPI.setSettings({ completedChallenges: completedChallengeIds })
      return {
        completedChallengeIds,
        activeChallengeId: null
      }
    })
  },

  setBufferStats: (stats: BufferStats) => {
    set({ bufferStats: stats })
  },

  notifyBufferOverflow: (_dropped: number) => {
    set((state) => ({ bufferOverflowCount: state.bufferOverflowCount + 1 }))
  },

  setWelcomeSeen: (seen: boolean) => {
    set({ welcomeSeen: seen })
  },

  setCompletedChallenges: (ids: string[]) => {
    set({ completedChallengeIds: ids })
  },

  setImportResult: (result: { packetCount: number; fileSizeBytes: number } | null) => {
    set({ importResult: result })
  }
}))

// ─── Theme Application ───────────────────────────────────────────────────────

function applyTheme(theme: 'light' | 'dark' | 'system'): void {
  const root = document.documentElement

  if (theme === 'system') {
    // Use OS preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (prefersDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  } else if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

// ─── Theme Initialization ────────────────────────────────────────────────────

/**
 * Initialize theme from system preference on first load and wire a live
 * matchMedia listener so 'system' theme responds to OS changes at runtime.
 * Called from App.tsx on mount.
 */
export function initializeTheme(): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')

  // Apply immediately
  applyTheme(
    useNetVisStore.getState().theme === 'system'
      ? mq.matches
        ? 'dark'
        : 'light'
      : useNetVisStore.getState().theme
  )

  // Live listener — only acts when store theme is 'system'
  const handleChange = (e: MediaQueryListEvent): void => {
    const { theme } = useNetVisStore.getState()
    if (theme === 'system') {
      applyTheme(e.matches ? 'dark' : 'light')
    }
  }

  mq.addEventListener('change', handleChange)

  return () => {
    mq.removeEventListener('change', handleChange)
  }
}
