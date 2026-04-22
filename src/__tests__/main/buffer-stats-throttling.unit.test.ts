/**
 * Buffer Stats Throttling Unit Tests
 * 
 * Tests the spacing-based throttling logic for buffer:stats push channel.
 * Verifies that emissions are spaced at least 500ms apart (Req 12.3, Req 14.2).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createBufferStatsThrottler } from '../../main/buffer-stats-throttler'
import type { BufferStats } from '../../shared/capture-types'

describe('Buffer Stats Throttling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('Basic Throttling Behavior', () => {
    it('P1: first change event sends immediately (no delay)', () => {
      const sendFn = vi.fn()
      const throttler = createBufferStatsThrottler(sendFn, 500)

      const stats: BufferStats = { count: 1, capacity: 100, percentage: 1 }
      throttler.handleChange(stats)

      // Should schedule immediately (delay = 0 since lastSendTime = 0)
      expect(sendFn).not.toHaveBeenCalled()
      
      vi.runAllTimers()
      
      expect(sendFn).toHaveBeenCalledTimes(1)
      expect(sendFn).toHaveBeenCalledWith(stats)
    })

    it('P2: rapid changes within 500ms result in only one emission after 500ms', () => {
      const sendFn = vi.fn()
      const throttler = createBufferStatsThrottler(sendFn, 500)

      // First change at t=0
      throttler.handleChange({ count: 1, capacity: 100, percentage: 1 })
      vi.runAllTimers() // Send immediately
      expect(sendFn).toHaveBeenCalledTimes(1)

      sendFn.mockClear()

      // Rapid changes at t=100, t=200, t=300
      vi.advanceTimersByTime(100)
      throttler.handleChange({ count: 2, capacity: 100, percentage: 2 })
      
      vi.advanceTimersByTime(100)
      throttler.handleChange({ count: 3, capacity: 100, percentage: 3 })
      
      vi.advanceTimersByTime(100)
      throttler.handleChange({ count: 4, capacity: 100, percentage: 4 })

      // At t=300, no emission yet (need to wait until t=500)
      expect(sendFn).not.toHaveBeenCalled()

      // Advance to t=500 (500ms after first emission)
      vi.advanceTimersByTime(200)

      // Should emit once with the latest stats
      expect(sendFn).toHaveBeenCalledTimes(1)
      expect(sendFn).toHaveBeenCalledWith({ count: 4, capacity: 100, percentage: 4 })
    })

    it('P3: changes spaced > 500ms apart send immediately', () => {
      const sendFn = vi.fn()
      const throttler = createBufferStatsThrottler(sendFn, 500)

      // First change at t=0
      throttler.handleChange({ count: 1, capacity: 100, percentage: 1 })
      vi.runAllTimers()
      expect(sendFn).toHaveBeenCalledTimes(1)

      sendFn.mockClear()

      // Second change at t=600 (> 500ms after first emission)
      vi.advanceTimersByTime(600)
      throttler.handleChange({ count: 2, capacity: 100, percentage: 2 })

      // Should schedule with delay=0 (600ms > 500ms spacing)
      vi.runAllTimers()
      expect(sendFn).toHaveBeenCalledTimes(1)
      expect(sendFn).toHaveBeenCalledWith({ count: 2, capacity: 100, percentage: 2 })
    })

    it('P4: pending update flag prevents duplicate sends', () => {
      const sendFn = vi.fn()
      const throttler = createBufferStatsThrottler(sendFn, 500)

      // First change
      throttler.handleChange({ count: 1, capacity: 100, percentage: 1 })
      vi.runAllTimers()
      expect(sendFn).toHaveBeenCalledTimes(1)

      sendFn.mockClear()

      // Rapid changes
      vi.advanceTimersByTime(100)
      throttler.handleChange({ count: 2, capacity: 100, percentage: 2 })
      
      vi.advanceTimersByTime(100)
      throttler.handleChange({ count: 3, capacity: 100, percentage: 3 })

      // Run all timers
      vi.runAllTimers()

      // Should only emit once (not twice)
      expect(sendFn).toHaveBeenCalledTimes(1)
      expect(sendFn).toHaveBeenCalledWith({ count: 3, capacity: 100, percentage: 3 })
    })

    it('P5: timer cleanup on rapid events (no timer leak)', () => {
      const sendFn = vi.fn()
      const throttler = createBufferStatsThrottler(sendFn, 500)

      // First change at t=0
      throttler.handleChange({ count: 1, capacity: 100, percentage: 1 })
      vi.runAllTimers()
      expect(sendFn).toHaveBeenCalledTimes(1)

      // Clear sendFn calls from first emission
      sendFn.mockClear()

      // Rapid changes at t=50, t=100, t=150, t=200, t=250 (all within 500ms window)
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(50)
        throttler.handleChange({ count: i + 2, capacity: 100, percentage: i + 2 })
      }

      // At t=250, only one timer should be active (the throttle timer)
      const pendingTimers = vi.getTimerCount()
      expect(pendingTimers).toBeLessThanOrEqual(1)

      // Run all timers (will fire at t=500)
      vi.runAllTimers()

      // Should emit once with latest stats (count: 6 from last iteration)
      expect(sendFn).toHaveBeenCalledTimes(1)
      expect(sendFn).toHaveBeenCalledWith({ count: 6, capacity: 100, percentage: 6 })
    })

    it('P6: correct payload structure', () => {
      const sendFn = vi.fn()
      const throttler = createBufferStatsThrottler(sendFn, 500)

      const stats: BufferStats = {
        count: 42,
        capacity: 10000,
        percentage: 0.42
      }

      throttler.handleChange(stats)
      vi.runAllTimers()

      expect(sendFn).toHaveBeenCalledWith({
        count: 42,
        capacity: 10000,
        percentage: 0.42
      })
    })
  })

  describe('Spacing-Based Throttling Semantics', () => {
    it('ensures minimum 500ms spacing between consecutive emissions', () => {
      const sendFn = vi.fn()
      const throttler = createBufferStatsThrottler(sendFn, 500)
      const emissionTimes: number[] = []

      // Track emission times
      sendFn.mockImplementation(() => {
        emissionTimes.push(Date.now())
      })

      // Emit at t=0
      throttler.handleChange({ count: 1, capacity: 100, percentage: 1 })
      vi.runAllTimers()

      // Emit at t=100 (should delay until t=500)
      vi.advanceTimersByTime(100)
      throttler.handleChange({ count: 2, capacity: 100, percentage: 2 })
      vi.runAllTimers()

      // Emit at t=600 (should send immediately)
      vi.advanceTimersByTime(100)
      throttler.handleChange({ count: 3, capacity: 100, percentage: 3 })
      vi.runAllTimers()

      // Verify spacing
      expect(emissionTimes).toHaveLength(3)
      expect(emissionTimes[1]! - emissionTimes[0]!).toBeGreaterThanOrEqual(500)
      expect(emissionTimes[2]! - emissionTimes[1]!).toBeGreaterThanOrEqual(500)
    })

    it('uses latest stats when multiple changes occur during throttle window', () => {
      const sendFn = vi.fn()
      const throttler = createBufferStatsThrottler(sendFn, 500)

      // First emission
      throttler.handleChange({ count: 1, capacity: 100, percentage: 1 })
      vi.runAllTimers()
      sendFn.mockClear()

      // Multiple changes within throttle window
      vi.advanceTimersByTime(100)
      throttler.handleChange({ count: 2, capacity: 100, percentage: 2 })
      
      vi.advanceTimersByTime(100)
      throttler.handleChange({ count: 3, capacity: 100, percentage: 3 })
      
      vi.advanceTimersByTime(100)
      throttler.handleChange({ count: 4, capacity: 100, percentage: 4 })

      // Run timers
      vi.runAllTimers()

      // Should use the latest stats (count: 4)
      expect(sendFn).toHaveBeenCalledTimes(1)
      expect(sendFn).toHaveBeenCalledWith({ count: 4, capacity: 100, percentage: 4 })
    })

    it('calculates delay correctly based on time since last send', () => {
      const sendFn = vi.fn()
      const throttler = createBufferStatsThrottler(sendFn, 500)

      // First emission at t=0
      throttler.handleChange({ count: 1, capacity: 100, percentage: 1 })
      vi.runAllTimers()
      sendFn.mockClear()

      // Change at t=300 (300ms after last send)
      vi.advanceTimersByTime(300)
      throttler.handleChange({ count: 2, capacity: 100, percentage: 2 })

      // Should schedule with delay=200ms (500 - 300)
      expect(sendFn).not.toHaveBeenCalled()

      // Advance 199ms - should not emit yet
      vi.advanceTimersByTime(199)
      expect(sendFn).not.toHaveBeenCalled()

      // Advance 1ms more (total 200ms) - should emit
      vi.advanceTimersByTime(1)
      expect(sendFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('Cleanup', () => {
    it('clears pending timer on cleanup', () => {
      const sendFn = vi.fn()
      const throttler = createBufferStatsThrottler(sendFn, 500)

      // Schedule an emission
      throttler.handleChange({ count: 1, capacity: 100, percentage: 1 })
      
      // Cleanup before timer fires
      throttler.cleanup()

      // Run timers
      vi.runAllTimers()

      // Should not emit
      expect(sendFn).not.toHaveBeenCalled()
    })

    it('resets pending state on cleanup', () => {
      const sendFn = vi.fn()
      const throttler = createBufferStatsThrottler(sendFn, 500)

      // Schedule an emission
      throttler.handleChange({ count: 1, capacity: 100, percentage: 1 })
      
      // Cleanup
      throttler.cleanup()

      // New change after cleanup should work normally
      throttler.handleChange({ count: 2, capacity: 100, percentage: 2 })
      vi.runAllTimers()

      expect(sendFn).toHaveBeenCalledTimes(1)
      expect(sendFn).toHaveBeenCalledWith({ count: 2, capacity: 100, percentage: 2 })
    })
  })

  describe('Custom Interval', () => {
    it('respects custom interval parameter', () => {
      const sendFn = vi.fn()
      const throttler = createBufferStatsThrottler(sendFn, 1000) // 1 second

      // First emission
      throttler.handleChange({ count: 1, capacity: 100, percentage: 1 })
      vi.runAllTimers()
      sendFn.mockClear()

      // Change at t=500 (should delay until t=1000)
      vi.advanceTimersByTime(500)
      throttler.handleChange({ count: 2, capacity: 100, percentage: 2 })

      // At t=999, should not emit yet
      vi.advanceTimersByTime(499)
      expect(sendFn).not.toHaveBeenCalled()

      // At t=1000, should emit
      vi.advanceTimersByTime(1)
      expect(sendFn).toHaveBeenCalledTimes(1)
    })
  })
})
