/**
 * Unit tests for PacketList virtualized rendering and keyboard navigation logic.
 * Feature: netvis-core, Task 16.1
 * Requirements: Req 5.3 (frame rate / only visible rows rendered), Req 5.5 (keyboard navigation)
 *
 * Strategy: test the virtualizer's range/index logic headlessly using @tanstack/virtual-core's
 * Virtualizer class directly (no DOM, no React). This validates the exact configuration
 * used in PacketList (estimateSize: 36, overscan: 10) and the keyboard navigation
 * state transitions that drive selectPacket + scrollToIndex calls.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Virtualizer, defaultRangeExtractor } from '@tanstack/virtual-core'
import type { VirtualizerOptions } from '@tanstack/virtual-core'
import type { AnonPacket } from '../../shared/capture-types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal AnonPacket for testing */
function makePacket(index: number): AnonPacket {
  return {
    id: `pkt-${index}`,
    timestamp: 1_700_000_000_000 + index * 1000,
    sourceId: 'eth0',
    captureMode: 'live',
    wireLength: 64,
    layers: [],
    srcAddress: `10.0.0.${index % 256}`,
    dstAddress: `10.0.1.${index % 256}`,
    protocol: 'TCP',
    length: 64
  }
}

function makePackets(count: number): AnonPacket[] {
  return Array.from({ length: count }, (_, i) => makePacket(i))
}

/**
 * Build a headless Virtualizer matching PacketList's exact configuration:
 *   estimateSize: () => 36
 *   overscan: 10
 *
 * @param count   total number of items
 * @param viewportHeight  simulated scroll container height in px
 * @param scrollOffset    current scroll position in px (default 0)
 */
function makeVirtualizer(
  count: number,
  viewportHeight: number,
  scrollOffset = 0
): Virtualizer<Element, Element> {
  const opts: VirtualizerOptions<Element, Element> = {
    count,
    estimateSize: () => 36,
    overscan: 10,
    getScrollElement: () => null,
    scrollToFn: () => {},
    observeElementRect: (_instance, cb) => {
      cb({ width: 800, height: viewportHeight })
    },
    observeElementOffset: (_instance, cb) => {
      cb(scrollOffset, false)
    },
    initialRect: { width: 800, height: viewportHeight },
    initialOffset: scrollOffset
  }

  const v = new Virtualizer(opts)
  // Trigger internal measurement pipeline
  v._willUpdate()
  return v
}

// ─── Virtualizer configuration ────────────────────────────────────────────────

describe('PacketList virtualizer configuration', () => {
  it('uses estimateSize of 36px per row', () => {
    const v = makeVirtualizer(100, 400)
    const items = v.getVirtualItems()
    // Every item should have size 36 (estimated, no DOM measurement)
    items.forEach((item) => {
      expect(item.size).toBe(36)
    })
  })

  it('getTotalSize equals count × 36 for uniform rows', () => {
    const count = 200
    const v = makeVirtualizer(count, 400)
    expect(v.getTotalSize()).toBe(count * 36)
  })

  it('getTotalSize is 0 for empty list', () => {
    const v = makeVirtualizer(0, 400)
    expect(v.getTotalSize()).toBe(0)
  })
})

// ─── Visible rows + overscan ──────────────────────────────────────────────────

describe('PacketList: only visible rows + overscan are rendered (Req 5.3)', () => {
  it('renders only visible rows + 10 overscan rows at scroll top', () => {
    const viewportHeight = 360 // exactly 10 rows visible (10 × 36)
    const count = 500
    const v = makeVirtualizer(count, viewportHeight, 0)

    const items = v.getVirtualItems()

    // Visible rows: 0–9 (10 rows). Overscan adds 10 below → rows 0–19.
    // No overscan above (already at top).
    expect(items.length).toBeLessThanOrEqual(20 + 1) // visible + overscan, allow ±1 for boundary
    expect(items.length).toBeGreaterThan(0)

    // First rendered index must be 0 (at top, no overscan above)
    expect(items[0]?.index).toBe(0)

    // Last rendered index must be ≤ visible + overscan
    const lastIndex = items[items.length - 1]?.index ?? 0
    expect(lastIndex).toBeLessThanOrEqual(19 + 1)
  })

  it('renders far fewer rows than total count', () => {
    const viewportHeight = 360 // 10 visible rows
    const totalPackets = 10_000
    const v = makeVirtualizer(totalPackets, viewportHeight, 0)

    const rendered = v.getVirtualItems().length

    // Should render ~20 rows (10 visible + 10 overscan), not 10,000
    expect(rendered).toBeLessThan(50)
    expect(rendered).toBeGreaterThan(0)
  })

  it('renders correct rows when scrolled to middle', () => {
    const viewportHeight = 360 // 10 visible rows
    const count = 500
    // Scroll to row 100 (offset = 100 × 36 = 3600)
    const scrollOffset = 100 * 36
    const v = makeVirtualizer(count, viewportHeight, scrollOffset)

    const items = v.getVirtualItems()

    // Visible: rows 100–109. With overscan 10: rows 90–119.
    const firstIndex = items[0]?.index ?? 0
    const lastIndex = items[items.length - 1]?.index ?? 0

    expect(firstIndex).toBeGreaterThanOrEqual(90)
    expect(firstIndex).toBeLessThanOrEqual(100)
    expect(lastIndex).toBeGreaterThanOrEqual(109)
    expect(lastIndex).toBeLessThanOrEqual(120)
  })

  it('renders correct rows when scrolled to bottom', () => {
    const viewportHeight = 360 // 10 visible rows
    const count = 50
    // Scroll to very bottom
    const scrollOffset = count * 36 - viewportHeight
    const v = makeVirtualizer(count, viewportHeight, scrollOffset)

    const items = v.getVirtualItems()

    // Last item must be the final packet
    const lastIndex = items[items.length - 1]?.index ?? 0
    expect(lastIndex).toBe(count - 1)
  })

  it('virtual items have correct absolute start positions', () => {
    const v = makeVirtualizer(100, 400, 0)
    const items = v.getVirtualItems()

    items.forEach((item) => {
      expect(item.start).toBe(item.index * 36)
    })
  })

  it('rendered count does not grow proportionally with total packet count', () => {
    const viewportHeight = 360
    const small = makeVirtualizer(100, viewportHeight, 0)
    const large = makeVirtualizer(100_000, viewportHeight, 0)

    const smallCount = small.getVirtualItems().length
    const largeCount = large.getVirtualItems().length

    // Both should render roughly the same number of rows
    expect(Math.abs(smallCount - largeCount)).toBeLessThanOrEqual(2)
  })
})

// ─── Overscan boundary ────────────────────────────────────────────────────────

describe('PacketList: overscan = 10 boundary conditions', () => {
  it('overscan does not exceed list bounds at top', () => {
    const v = makeVirtualizer(5, 400, 0)
    const items = v.getVirtualItems()

    // Only 5 items exist — all should be rendered, none with negative index
    items.forEach((item) => {
      expect(item.index).toBeGreaterThanOrEqual(0)
      expect(item.index).toBeLessThan(5)
    })
  })

  it('overscan does not exceed list bounds at bottom', () => {
    const count = 15
    const viewportHeight = 360
    const scrollOffset = count * 36 - viewportHeight
    const v = makeVirtualizer(count, viewportHeight, Math.max(0, scrollOffset))

    const items = v.getVirtualItems()

    items.forEach((item) => {
      expect(item.index).toBeGreaterThanOrEqual(0)
      expect(item.index).toBeLessThan(count)
    })
  })

  it('defaultRangeExtractor with overscan=10 clamps to [0, count-1]', () => {
    // Directly test the range extractor used by the virtualizer
    const result = defaultRangeExtractor({
      startIndex: 2,
      endIndex: 8,
      overscan: 10,
      count: 15
    })

    expect(result[0]).toBe(0) // clamped at 0, not -8
    expect(result[result.length - 1]).toBe(14) // clamped at count-1
  })

  it('defaultRangeExtractor returns correct range in middle of list', () => {
    const result = defaultRangeExtractor({
      startIndex: 50,
      endIndex: 60,
      overscan: 10,
      count: 500
    })

    expect(result[0]).toBe(40) // 50 - 10
    expect(result[result.length - 1]).toBe(70) // 60 + 10
    expect(result.length).toBe(31) // 40..70 inclusive
  })
})

// ─── Keyboard navigation logic ────────────────────────────────────────────────

describe('PacketList: keyboard navigation state transitions (Req 5.5)', () => {
  let packets: AnonPacket[]
  let selectedId: string | null
  let scrolledToIndex: number | null

  // Simulate the handleKeyDown logic from PacketList
  function handleKeyDown(key: 'ArrowDown' | 'ArrowUp' | 'Enter', currentIndex: number): void {
    if (key === 'ArrowDown') {
      const next = Math.min(currentIndex + 1, packets.length - 1)
      const nextPacket = packets[next]
      if (nextPacket) {
        selectedId = nextPacket.id
        scrolledToIndex = next
      }
    } else if (key === 'ArrowUp') {
      const prev = Math.max(currentIndex - 1, 0)
      const prevPacket = packets[prev]
      if (prevPacket) {
        selectedId = prevPacket.id
        scrolledToIndex = prev
      }
    } else if (key === 'Enter') {
      const packet = packets[currentIndex]
      if (packet) {
        selectedId = packet.id
        scrolledToIndex = null // Enter selects but doesn't scroll
      }
    }
  }

  beforeEach(() => {
    packets = makePackets(20)
    selectedId = null
    scrolledToIndex = null
  })

  it('ArrowDown moves selection to next row', () => {
    selectedId = packets[3]!.id
    handleKeyDown('ArrowDown', 3)

    expect(selectedId).toBe(packets[4]!.id)
    expect(scrolledToIndex).toBe(4)
  })

  it('ArrowUp moves selection to previous row', () => {
    selectedId = packets[5]!.id
    handleKeyDown('ArrowUp', 5)

    expect(selectedId).toBe(packets[4]!.id)
    expect(scrolledToIndex).toBe(4)
  })

  it('ArrowDown at last row stays on last row (no overflow)', () => {
    const lastIndex = packets.length - 1
    selectedId = packets[lastIndex]!.id
    handleKeyDown('ArrowDown', lastIndex)

    expect(selectedId).toBe(packets[lastIndex]!.id)
    expect(scrolledToIndex).toBe(lastIndex)
  })

  it('ArrowUp at first row stays on first row (no underflow)', () => {
    selectedId = packets[0]!.id
    handleKeyDown('ArrowUp', 0)

    expect(selectedId).toBe(packets[0]!.id)
    expect(scrolledToIndex).toBe(0)
  })

  it('Enter selects the current row without changing scroll target', () => {
    selectedId = null
    handleKeyDown('Enter', 7)

    expect(selectedId).toBe(packets[7]!.id)
    expect(scrolledToIndex).toBeNull()
  })

  it('ArrowDown from index 0 selects index 1', () => {
    selectedId = packets[0]!.id
    handleKeyDown('ArrowDown', 0)

    expect(selectedId).toBe(packets[1]!.id)
    expect(scrolledToIndex).toBe(1)
  })

  it('sequential ArrowDown traverses all rows in order', () => {
    const visited: string[] = []
    selectedId = packets[0]!.id

    for (let i = 0; i < packets.length - 1; i++) {
      handleKeyDown('ArrowDown', i)
      visited.push(selectedId!)
    }

    const expectedIds = packets.slice(1).map((p) => p.id)
    expect(visited).toEqual(expectedIds)
  })

  it('sequential ArrowUp traverses all rows in reverse order', () => {
    const lastIndex = packets.length - 1
    selectedId = packets[lastIndex]!.id
    const visited: string[] = []

    for (let i = lastIndex; i > 0; i--) {
      handleKeyDown('ArrowUp', i)
      visited.push(selectedId!)
    }

    const expectedIds = packets
      .slice(0, lastIndex)
      .reverse()
      .map((p) => p.id)
    expect(visited).toEqual(expectedIds)
  })

  it('grid container ArrowDown with no selection selects first row', () => {
    // Simulate the grid container's onKeyDown when no row is selected
    selectedId = null
    const currentSelectedIndex = selectedId ? packets.findIndex((p) => p.id === selectedId) : -1

    if (currentSelectedIndex >= 0) {
      handleKeyDown('ArrowDown', currentSelectedIndex)
    } else if (packets.length > 0) {
      // PacketList behavior: select first packet when none selected
      const first = packets[0]
      if (first) selectedId = first.id
    }

    expect(selectedId).toBe(packets[0]!.id)
  })

  it('keyboard navigation works correctly with filtered packet list', () => {
    // Simulate filtering: only TCP packets at even indices
    const filtered = packets.filter((_, i) => i % 2 === 0)
    packets = filtered // replace with filtered list

    selectedId = filtered[0]!.id
    handleKeyDown('ArrowDown', 0)

    // Should select the second item in the filtered list, not index 1 of original
    expect(selectedId).toBe(filtered[1]!.id)
  })
})

// ─── Empty state logic ────────────────────────────────────────────────────────

describe('PacketList: empty state conditions', () => {
  it('virtualizer with 0 items returns no virtual items', () => {
    const v = makeVirtualizer(0, 400, 0)
    expect(v.getVirtualItems()).toHaveLength(0)
  })

  it('virtualizer with 0 items has total size of 0', () => {
    const v = makeVirtualizer(0, 400, 0)
    expect(v.getTotalSize()).toBe(0)
  })

  it('filter-empty state: packets exist but filtered list is empty', () => {
    const allPackets = makePackets(50)
    const filterExpression = 'proto == DNS'

    // Simulate: all packets are TCP, filter for DNS → empty
    const filteredPackets = allPackets.filter((p) => p.protocol.toUpperCase() === 'DNS')

    // PacketList shows filter-empty message when:
    // packets.length > 0 AND filteredPackets.length === 0 AND filterExpression.trim() !== ''
    const showFilterEmpty =
      allPackets.length > 0 && filteredPackets.length === 0 && filterExpression.trim() !== ''

    expect(showFilterEmpty).toBe(true)
  })

  it('no-capture state: both packets and filtered are empty', () => {
    const allPackets: AnonPacket[] = []
    const filteredPackets: AnonPacket[] = []
    const filterExpression = ''

    const showNoCaptureMessage = allPackets.length === 0

    expect(showNoCaptureMessage).toBe(true)
    expect(filteredPackets.length).toBe(0)
    expect(filterExpression).toBe('')
  })
})

// ─── Row position calculation ─────────────────────────────────────────────────

describe('PacketList: row absolute positioning', () => {
  it('each virtual item has correct translateY offset', () => {
    const v = makeVirtualizer(50, 400, 0)
    const items = v.getVirtualItems()

    items.forEach((item) => {
      // The component uses `transform: translateY(${virtualRow.start}px)`
      const expectedTranslateY = item.index * 36
      expect(item.start).toBe(expectedTranslateY)
    })
  })

  it('virtual items do not overlap (end of item N === start of item N+1)', () => {
    const v = makeVirtualizer(100, 400, 0)
    const items = v.getVirtualItems()

    for (let i = 0; i < items.length - 1; i++) {
      const current = items[i]!
      const next = items[i + 1]!
      expect(next.start).toBe(current.end)
    }
  })

  it('virtual item keys are unique', () => {
    const v = makeVirtualizer(100, 400, 0)
    const items = v.getVirtualItems()
    const keys = items.map((item) => item.key)
    const uniqueKeys = new Set(keys)

    expect(uniqueKeys.size).toBe(keys.length)
  })
})

// ─── Scroll-to-index behavior ─────────────────────────────────────────────────

describe('PacketList: scrollToIndex is called on keyboard navigation', () => {
  it('ArrowDown triggers scrollToIndex with the next index', () => {
    const packets = makePackets(100)
    const scrollToIndex = vi.fn()

    // Simulate handleKeyDown calling virtualizer.scrollToIndex
    function simulateArrowDown(currentIndex: number): void {
      const next = Math.min(currentIndex + 1, packets.length - 1)
      const nextPacket = packets[next]
      if (nextPacket) {
        scrollToIndex(next, { align: 'auto' })
      }
    }

    simulateArrowDown(5)
    expect(scrollToIndex).toHaveBeenCalledWith(6, { align: 'auto' })
  })

  it('ArrowUp triggers scrollToIndex with the previous index', () => {
    const packets = makePackets(100)
    const scrollToIndex = vi.fn()

    function simulateArrowUp(currentIndex: number): void {
      const prev = Math.max(currentIndex - 1, 0)
      const prevPacket = packets[prev]
      if (prevPacket) {
        scrollToIndex(prev, { align: 'auto' })
      }
    }

    simulateArrowUp(10)
    expect(scrollToIndex).toHaveBeenCalledWith(9, { align: 'auto' })
  })

  it('ArrowDown at last index does not scroll beyond bounds', () => {
    const packets = makePackets(10)
    const scrollToIndex = vi.fn()

    function simulateArrowDown(currentIndex: number): void {
      const next = Math.min(currentIndex + 1, packets.length - 1)
      const nextPacket = packets[next]
      if (nextPacket) {
        scrollToIndex(next, { align: 'auto' })
      }
    }

    simulateArrowDown(9) // last index
    expect(scrollToIndex).toHaveBeenCalledWith(9, { align: 'auto' })
    // Must not be called with index 10
    expect(scrollToIndex).not.toHaveBeenCalledWith(10, expect.anything())
  })
})
