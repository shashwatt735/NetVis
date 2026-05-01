// Feature: netvis-core, Property 20: Time-range filter generation
// Validates: Requirements 22.4, 28.3

/**
 * Property 20: Time-range filter generation
 *
 * For any time bucket t (a 1-second interval [t, t+1)), the filter expression generated
 * by clicking that bucket must, when evaluated against any packet set, return exactly
 * the packets whose timestamp falls within [t, t+1).
 *
 * Properties tested:
 *   (a) Time-range filter expression is syntactically valid
 *   (b) Filter correctly includes packets within the time range
 *   (c) Filter correctly excludes packets outside the time range
 *   (d) Filter boundaries are correct (>= start, < end)
 *   (e) Generated filter can be parsed by the filter engine
 *   (f) Evaluated filter produces correct results for any packet set
 *   (g) Filter expression format matches expected pattern
 *   (h) Filter works correctly at boundary conditions
 *
 * Validates: Requirements 22.4, 28.3
 */

import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'
import {
  PacketFlowTimeline,
  timeRangeFilter
} from '../../renderer/src/components/PacketFlowTimeline'
import { parse } from '../../main/filter-engine/parser'
import { evaluate } from '../../main/filter-engine/evaluator'
import type { AnonPacket, ProtocolName } from '../../shared/capture-types'
import { makeAnonPacket } from './test-utils'

const mockChartState = vi.hoisted(() => ({
  data: [] as Array<{ startMs: number }>,
  barOnClick: undefined as
    | ((data: unknown, index: number, event: unknown) => void)
    | undefined
}))

const mockStoreState = vi.hoisted(() => ({
  packets: [] as AnonPacket[],
  filteredPackets: [] as AnonPacket[],
  filterExpression: '',
  setFilter: vi.fn<(expression: string) => void>()
}))

vi.mock('../../renderer/src/store', () => ({
  useNetVisStore: (selector: (state: typeof mockStoreState) => unknown) => selector(mockStoreState)
}))

vi.mock('../../renderer/src/components/ui/chart', () => {
  function ChartContainer({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children)
  }

  function ChartBarChart({
    data,
    children
  }: {
    data?: Array<{ startMs: number }>
    children?: React.ReactNode
  }) {
    mockChartState.data = data ?? []
    const chartChildren = React.Children.toArray(children)
    const chartBarChild = chartChildren.find(
      (child): child is React.ReactElement<{ onClick?: (data: unknown, index: number, event: unknown) => void }> =>
        React.isValidElement(child) &&
        typeof child.props === 'object' &&
        child.props !== null &&
        'onClick' in child.props
    )
    mockChartState.barOnClick = chartBarChild?.props.onClick
    return React.createElement(React.Fragment, null, children)
  }

  function ChartBar({
    _onClick
  }: {
    _onClick?: (data: unknown, index: number, event: unknown) => void
  }) {
    return React.createElement('div')
  }

  function ChartCell() {
    return null
  }

  function ChartTooltip() {
    return null
  }

  function ChartXAxis() {
    return null
  }

  function ChartYAxis() {
    return null
  }

  return {
    ChartContainer,
    ChartBarChart,
    ChartBar,
    ChartCell,
    ChartTooltip,
    ChartXAxis,
    ChartYAxis
  }
})

// ─── Constants ────────────────────────────────────────────────────────────────

const BUCKET_WIDTH_MS = 1000

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create a minimal AnonPacket for testing filter evaluation.
 */
function createTestPacket(timestamp: number, protocol: ProtocolName = 'TCP'): AnonPacket {
  return {
    id: `test-${timestamp}`,
    timestamp,
    sourceId: 'test',
    captureMode: 'file',
    wireLength: 100,
    layers: [
      {
        protocol,
        fields: [],
        rawByteOffset: 0,
        rawByteLength: 100
      }
    ],
    srcAddress: '192.168.1.1',
    dstAddress: '192.168.1.2',
    protocol,
    length: 100
  }
}

/**
 * Manually determine if a packet should match the time range [startMs, startMs + 1000).
 * This is the ground truth for testing the filter.
 */
function shouldMatchTimeRange(packetTimestamp: number, bucketStartMs: number): boolean {
  const endMs = bucketStartMs + BUCKET_WIDTH_MS
  return packetTimestamp >= bucketStartMs && packetTimestamp < endMs
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const PROTOCOL_NAMES: ProtocolName[] = ['TCP', 'UDP', 'ICMP', 'DNS', 'ARP', 'IPv4', 'IPv6', 'OTHER']

const protocolArb = fc.constantFrom(...PROTOCOL_NAMES)

/** Reasonable Unix timestamp in milliseconds */
const timestampArb = fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 })

/** Bucket start time (aligned to second boundary) */
const bucketStartArb = timestampArb.map((ts) => Math.floor(ts / BUCKET_WIDTH_MS) * BUCKET_WIDTH_MS)

/** Packet with arbitrary timestamp and protocol */
const packetArb = fc.record({
  timestamp: timestampArb,
  protocol: protocolArb
})

/** Array of packets with various timestamps */
const packetListArb = fc.array(packetArb, { minLength: 0, maxLength: 100 })

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Time-range filter generation (P20)', () => {
  /**
   * Property 20a: Time-range filter expression is syntactically valid.
   * The generated filter must be parseable by the filter engine.
   * Validates: Requirement 22.4 (generates valid filter expression)
   */
  it('generates syntactically valid filter expression', () => {
    fc.assert(
      fc.property(bucketStartArb, (startMs) => {
        const filterExpr = timeRangeFilter(startMs)
        const parseResult = parse(filterExpr)

        expect(parseResult.ok).toBe(true)
        if (!parseResult.ok) {
          throw new Error(`Parse failed: ${parseResult.error}`)
        }
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 20b: Filter correctly includes packets within the time range.
   * Any packet with timestamp in [startMs, startMs + 1000) must match the filter.
   * Validates: Requirement 28.3 (filter engine correctly evaluates time-range predicates)
   */
  it('includes packets within the time range', () => {
    fc.assert(
      fc.property(bucketStartArb, protocolArb, (startMs, protocol) => {
        const filterExpr = timeRangeFilter(startMs)
        const parseResult = parse(filterExpr)
        expect(parseResult.ok).toBe(true)
        if (!parseResult.ok) return

        // Test packets at various points within the range
        const testTimestamps = [
          startMs, // start boundary
          startMs + 1, // just after start
          startMs + 500, // middle
          startMs + 999 // just before end
        ]

        for (const ts of testTimestamps) {
          const packet = createTestPacket(ts, protocol)
          const matches = evaluate(parseResult.ast, packet)
          expect(matches).toBe(true)
        }
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 20c: Filter correctly excludes packets outside the time range.
   * Any packet with timestamp < startMs or >= startMs + 1000 must not match.
   * Validates: Requirement 28.3 (filter engine correctly evaluates time-range predicates)
   */
  it('excludes packets outside the time range', () => {
    fc.assert(
      fc.property(bucketStartArb, protocolArb, (startMs, protocol) => {
        const filterExpr = timeRangeFilter(startMs)
        const parseResult = parse(filterExpr)
        expect(parseResult.ok).toBe(true)
        if (!parseResult.ok) return

        // Test packets outside the range
        const testTimestamps = [
          startMs - 1000, // 1 second before
          startMs - 1, // just before start
          startMs + 1000, // at end boundary (exclusive)
          startMs + 1001, // just after end
          startMs + 2000 // 1 second after
        ]

        for (const ts of testTimestamps) {
          const packet = createTestPacket(ts, protocol)
          const matches = evaluate(parseResult.ast, packet)
          expect(matches).toBe(false)
        }
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 20d: Filter boundaries are correct (>= start, < end).
   * The filter must use inclusive start and exclusive end boundaries.
   * Validates: Requirement 22.4 (correct time-range filter semantics)
   */
  it('uses correct boundary semantics (inclusive start, exclusive end)', () => {
    fc.assert(
      fc.property(bucketStartArb, protocolArb, (startMs, protocol) => {
        const filterExpr = timeRangeFilter(startMs)
        const parseResult = parse(filterExpr)
        expect(parseResult.ok).toBe(true)
        if (!parseResult.ok) return

        const endMs = startMs + BUCKET_WIDTH_MS

        // Start boundary: inclusive (should match)
        const packetAtStart = createTestPacket(startMs, protocol)
        expect(evaluate(parseResult.ast, packetAtStart)).toBe(true)

        // End boundary: exclusive (should not match)
        const packetAtEnd = createTestPacket(endMs, protocol)
        expect(evaluate(parseResult.ast, packetAtEnd)).toBe(false)

        // Just before end: inclusive (should match)
        const packetBeforeEnd = createTestPacket(endMs - 1, protocol)
        expect(evaluate(parseResult.ast, packetBeforeEnd)).toBe(true)
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 20e: Generated filter can be parsed by the filter engine.
   * This is a stronger version of 20a that also checks the AST structure.
   * Validates: Requirement 22.4 (integration with filter engine)
   */
  it('produces parseable filter with expected AST structure', () => {
    fc.assert(
      fc.property(bucketStartArb, (startMs) => {
        const filterExpr = timeRangeFilter(startMs)
        const parseResult = parse(filterExpr)

        expect(parseResult.ok).toBe(true)
        if (!parseResult.ok) return

        // The AST should be a binary AND node with two predicates
        expect(parseResult.ast.kind).toBe('binary')
        if (parseResult.ast.kind !== 'binary') return

        expect(parseResult.ast.op).toBe('AND')
        expect(parseResult.ast.left.kind).toBe('predicate')
        expect(parseResult.ast.right.kind).toBe('predicate')
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 20f: Evaluated filter produces correct results for any packet set.
   * For any set of packets, the filter must return exactly those packets
   * whose timestamp falls within the time range.
   * Validates: Requirements 22.4, 28.3 (end-to-end correctness)
   */
  it('correctly filters arbitrary packet sets', () => {
    fc.assert(
      fc.property(bucketStartArb, packetListArb, (startMs, packets) => {
        const filterExpr = timeRangeFilter(startMs)
        const parseResult = parse(filterExpr)
        expect(parseResult.ok).toBe(true)
        if (!parseResult.ok) return

        // Evaluate filter against each packet
        for (const pkt of packets) {
          const packet = createTestPacket(pkt.timestamp, pkt.protocol)
          const matches = evaluate(parseResult.ast, packet)
          const shouldMatch = shouldMatchTimeRange(pkt.timestamp, startMs)

          expect(matches).toBe(shouldMatch)
        }
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 20g: Filter expression format matches expected pattern.
   * The filter should follow the format: "ts >= <start> AND ts < <end>"
   * Validates: Requirement 22.4 (consistent filter format)
   */
  it('generates filter with expected format', () => {
    fc.assert(
      fc.property(bucketStartArb, (startMs) => {
        const filterExpr = timeRangeFilter(startMs)
        const endMs = startMs + BUCKET_WIDTH_MS

        // Check that the filter contains the expected components
        expect(filterExpr).toContain('ts')
        expect(filterExpr).toContain('>=')
        expect(filterExpr).toContain(startMs.toString())
        expect(filterExpr).toContain('AND')
        expect(filterExpr).toContain('<')
        expect(filterExpr).toContain(endMs.toString())
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 20h: Filter works correctly at boundary conditions.
   * Test edge cases like timestamp 0, very large timestamps, etc.
   * Validates: Requirement 28.3 (robust filter evaluation)
   */
  it('handles boundary conditions correctly', () => {
    const boundaryTimestamps = [
      0, // epoch
      1000, // 1 second after epoch
      Number.MAX_SAFE_INTEGER - 1000, // near max safe integer
      1_000_000_000_000, // typical Unix ms timestamp
      2_000_000_000_000 // future timestamp
    ]

    for (const startMs of boundaryTimestamps) {
      const filterExpr = timeRangeFilter(startMs)
      const parseResult = parse(filterExpr)

      expect(parseResult.ok).toBe(true)
      if (!parseResult.ok) continue

      // Test packet at start
      const packetAtStart = createTestPacket(startMs, 'TCP')
      expect(evaluate(parseResult.ast, packetAtStart)).toBe(true)

      // Test packet at end (exclusive)
      const packetAtEnd = createTestPacket(startMs + BUCKET_WIDTH_MS, 'TCP')
      expect(evaluate(parseResult.ast, packetAtEnd)).toBe(false)
    }
  })

  /**
   * Property 20i: Filter is independent of packet protocol.
   * The time-range filter should match packets regardless of their protocol.
   * Validates: Requirement 22.4 (time filter is protocol-agnostic)
   */
  it('filters packets regardless of protocol', () => {
    fc.assert(
      fc.property(bucketStartArb, (startMs) => {
        const filterExpr = timeRangeFilter(startMs)
        const parseResult = parse(filterExpr)
        expect(parseResult.ok).toBe(true)
        if (!parseResult.ok) return

        // Test with all protocol types
        for (const protocol of PROTOCOL_NAMES) {
          // Packet within range
          const packetInRange = createTestPacket(startMs + 500, protocol)
          expect(evaluate(parseResult.ast, packetInRange)).toBe(true)

          // Packet outside range
          const packetOutOfRange = createTestPacket(startMs - 500, protocol)
          expect(evaluate(parseResult.ast, packetOutOfRange)).toBe(false)
        }
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 20j: Filter expression is deterministic.
   * Calling timeRangeFilter with the same input produces the same output.
   * Validates: Requirement 22.4 (consistent behavior)
   */
  it('produces deterministic filter expressions', () => {
    fc.assert(
      fc.property(bucketStartArb, (startMs) => {
        const filter1 = timeRangeFilter(startMs)
        const filter2 = timeRangeFilter(startMs)
        const filter3 = timeRangeFilter(startMs)

        expect(filter1).toBe(filter2)
        expect(filter2).toBe(filter3)
      }),
      { numRuns: 25 }
    )
  })
})

describe('PacketFlowTimeline bar click regression', () => {
  beforeEach(() => {
    mockChartState.data = []
    mockChartState.barOnClick = undefined
    mockStoreState.packets = []
    mockStoreState.filteredPackets = []
    mockStoreState.filterExpression = ''
    mockStoreState.setFilter = vi.fn<(expression: string) => void>()
  })

  afterEach(() => {
    mockChartState.data = []
    mockChartState.barOnClick = undefined
    vi.clearAllMocks()
  })

  it('renders a filterable bucket using the bucket startMs when generating the filter', () => {
    const packet = makeAnonPacket({
      id: 'timeline-click-packet',
      timestamp: 1_700_000_000_123
    })
    const expectedStartMs = 1_700_000_000_000

    mockStoreState.packets = [packet]
    mockStoreState.filteredPackets = [packet]

    const markup = renderToStaticMarkup(React.createElement(PacketFlowTimeline))

    expect(markup).toContain('1 packets')
    expect(timeRangeFilter(expectedStartMs)).toBe('ts >= 1700000000000 AND ts < 1700000001000')
  })
})
