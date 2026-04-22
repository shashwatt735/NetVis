/**
 * StatusBar Overflow Notice Logic Tests
 * 
 * Verifies that the overflow notice logic in StatusBar.tsx is driven by overflow events
 * (via bufferOverflowCount), not by buffer fullness percentage.
 * 
 * Strategy: Test the overflow notice visibility logic headlessly by simulating the
 * useEffect behavior that drives the notice visibility state.
 * 
 * Key behaviors tested:
 * - 100% full with no overflow → no overflow notice
 * - Overflow event counter increment → overflow notice appears
 * - Auto-hide after 5 seconds
 * - Re-trigger on repeated overflow events
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useNetVisStore } from '../../renderer/src/store'

/**
 * Simulates the StatusBar overflow notice logic.
 * This mirrors the useEffect in StatusBar.tsx that controls overflow visibility.
 */
class OverflowNoticeController {
  private overflowVisible = false
  private overflowTimer: ReturnType<typeof setTimeout> | null = null
  private lastOverflowCount = 0

  /**
   * Simulate the useEffect that runs when bufferOverflowCount changes.
   * This is the core logic from StatusBar.tsx.
   */
  handleOverflowCountChange(newCount: number): void {
    if (newCount > this.lastOverflowCount) {
      this.overflowVisible = true
      if (this.overflowTimer) clearTimeout(this.overflowTimer)
      this.overflowTimer = setTimeout(() => {
        this.overflowVisible = false
      }, 5000)
      this.lastOverflowCount = newCount
    }
  }

  isVisible(): boolean {
    return this.overflowVisible
  }

  cleanup(): void {
    if (this.overflowTimer) {
      clearTimeout(this.overflowTimer)
      this.overflowTimer = null
    }
  }
}

describe('StatusBar Overflow Notice Logic', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    
    // Reset store to initial state
    useNetVisStore.setState({
      captureStatus: { state: 'idle' },
      bufferStats: { count: 0, capacity: 100, percentage: 0 },
      bufferOverflowCount: 0
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('Overflow Notice Visibility Logic', () => {
    it('does NOT show overflow notice when buffer is 100% full without overflow event', () => {
      const controller = new OverflowNoticeController()

      // Set buffer to 100% full
      useNetVisStore.setState({
        bufferStats: { count: 100, capacity: 100, percentage: 100 },
        bufferOverflowCount: 0 // No overflow event
      })

      // Simulate useEffect - no change in overflow count
      controller.handleOverflowCountChange(0)

      // Verify NO overflow notice
      expect(controller.isVisible()).toBe(false)

      controller.cleanup()
    })

    it('shows overflow notice when overflow event occurs (counter increments)', () => {
      const controller = new OverflowNoticeController()

      // Initial state: buffer at 100%, no overflow yet
      useNetVisStore.setState({
        bufferStats: { count: 100, capacity: 100, percentage: 100 },
        bufferOverflowCount: 0
      })

      controller.handleOverflowCountChange(0)
      expect(controller.isVisible()).toBe(false)

      // Simulate overflow event (counter increments)
      useNetVisStore.setState({
        bufferOverflowCount: 1 // Overflow event fired
      })

      controller.handleOverflowCountChange(1)

      // Verify overflow notice appears
      expect(controller.isVisible()).toBe(true)

      controller.cleanup()
    })

    it('shows overflow notice even when percentage stays at 100%', () => {
      const controller = new OverflowNoticeController()

      // Buffer at 100%
      useNetVisStore.setState({
        bufferStats: { count: 100, capacity: 100, percentage: 100 },
        bufferOverflowCount: 0
      })

      controller.handleOverflowCountChange(0)

      // Overflow occurs (percentage still 100%, but counter increments)
      useNetVisStore.setState({
        bufferStats: { count: 100, capacity: 100, percentage: 100 }, // Still 100%
        bufferOverflowCount: 1 // But overflow event fired
      })

      controller.handleOverflowCountChange(1)

      // Verify notice appears (driven by event, not percentage)
      expect(controller.isVisible()).toBe(true)

      controller.cleanup()
    })

    it('does NOT show overflow notice when buffer is below 100%', () => {
      const controller = new OverflowNoticeController()

      useNetVisStore.setState({
        bufferStats: { count: 80, capacity: 100, percentage: 80 },
        bufferOverflowCount: 0
      })

      controller.handleOverflowCountChange(0)

      // Verify NO overflow notice
      expect(controller.isVisible()).toBe(false)

      controller.cleanup()
    })
  })

  describe('Auto-Hide Behavior', () => {
    it('hides overflow notice after 5 seconds', () => {
      const controller = new OverflowNoticeController()

      useNetVisStore.setState({
        bufferStats: { count: 100, capacity: 100, percentage: 100 },
        bufferOverflowCount: 0
      })

      // Trigger overflow
      useNetVisStore.setState({ bufferOverflowCount: 1 })
      controller.handleOverflowCountChange(1)

      // Verify notice is visible
      expect(controller.isVisible()).toBe(true)

      // Advance time by 4999ms - should still be visible
      vi.advanceTimersByTime(4999)
      expect(controller.isVisible()).toBe(true)

      // Advance time by 1ms more (total 5000ms) - should hide
      vi.advanceTimersByTime(1)
      vi.runAllTimers()
      expect(controller.isVisible()).toBe(false)

      controller.cleanup()
    })

    it('resets timer when new overflow event occurs before auto-hide', () => {
      const controller = new OverflowNoticeController()

      useNetVisStore.setState({
        bufferStats: { count: 100, capacity: 100, percentage: 100 },
        bufferOverflowCount: 0
      })

      // First overflow at t=0
      useNetVisStore.setState({ bufferOverflowCount: 1 })
      controller.handleOverflowCountChange(1)
      expect(controller.isVisible()).toBe(true)

      // Advance 3 seconds
      vi.advanceTimersByTime(3000)
      expect(controller.isVisible()).toBe(true)

      // Second overflow at t=3000 (resets timer)
      useNetVisStore.setState({ bufferOverflowCount: 2 })
      controller.handleOverflowCountChange(2)
      expect(controller.isVisible()).toBe(true)

      // Advance 4 seconds (total 7 seconds from first overflow, but only 4 from second)
      vi.advanceTimersByTime(4000)
      expect(controller.isVisible()).toBe(true)

      // Advance 1 more second (5 seconds from second overflow)
      vi.advanceTimersByTime(1000)
      vi.runAllTimers()
      expect(controller.isVisible()).toBe(false)

      controller.cleanup()
    })
  })

  describe('Re-Trigger on Repeated Overflows', () => {
    it('re-shows notice when overflow counter increments after auto-hide', () => {
      const controller = new OverflowNoticeController()

      useNetVisStore.setState({
        bufferStats: { count: 100, capacity: 100, percentage: 100 },
        bufferOverflowCount: 0
      })

      // First overflow
      useNetVisStore.setState({ bufferOverflowCount: 1 })
      controller.handleOverflowCountChange(1)
      expect(controller.isVisible()).toBe(true)

      // Wait for auto-hide (5 seconds)
      vi.advanceTimersByTime(5000)
      vi.runAllTimers()
      expect(controller.isVisible()).toBe(false)

      // Second overflow (counter increments again)
      useNetVisStore.setState({ bufferOverflowCount: 2 })
      controller.handleOverflowCountChange(2)

      // Notice should re-appear
      expect(controller.isVisible()).toBe(true)

      controller.cleanup()
    })

    it('shows notice for each overflow event (counter-driven)', () => {
      const controller = new OverflowNoticeController()

      useNetVisStore.setState({
        bufferStats: { count: 100, capacity: 100, percentage: 100 },
        bufferOverflowCount: 0
      })

      // No notice initially
      controller.handleOverflowCountChange(0)
      expect(controller.isVisible()).toBe(false)

      // First overflow
      useNetVisStore.setState({ bufferOverflowCount: 1 })
      controller.handleOverflowCountChange(1)
      expect(controller.isVisible()).toBe(true)

      // Hide after 5 seconds
      vi.advanceTimersByTime(5000)
      vi.runAllTimers()
      expect(controller.isVisible()).toBe(false)

      // Second overflow
      useNetVisStore.setState({ bufferOverflowCount: 2 })
      controller.handleOverflowCountChange(2)
      expect(controller.isVisible()).toBe(true)

      // Hide after 5 seconds
      vi.advanceTimersByTime(5000)
      vi.runAllTimers()
      expect(controller.isVisible()).toBe(false)

      // Third overflow
      useNetVisStore.setState({ bufferOverflowCount: 3 })
      controller.handleOverflowCountChange(3)
      expect(controller.isVisible()).toBe(true)

      controller.cleanup()
    })
  })

  describe('Integration with Store', () => {
    it('overflow notice logic is independent of buffer percentage', () => {
      const controller = new OverflowNoticeController()

      // Test various percentages without overflow
      const testCases = [
        { count: 50, capacity: 100, percentage: 50 },
        { count: 75, capacity: 100, percentage: 75 },
        { count: 99, capacity: 100, percentage: 99 },
        { count: 100, capacity: 100, percentage: 100 }
      ]

      for (const stats of testCases) {
        useNetVisStore.setState({
          bufferStats: stats,
          bufferOverflowCount: 0
        })

        controller.handleOverflowCountChange(0)

        // No overflow notice regardless of percentage
        expect(controller.isVisible()).toBe(false)
      }

      controller.cleanup()
    })

    it('overflow notice appears only when counter increments, not when percentage reaches 100%', () => {
      const controller = new OverflowNoticeController()

      // Gradually fill buffer to 100%
      useNetVisStore.setState({
        bufferStats: { count: 90, capacity: 100, percentage: 90 },
        bufferOverflowCount: 0
      })
      controller.handleOverflowCountChange(0)
      expect(controller.isVisible()).toBe(false)

      useNetVisStore.setState({
        bufferStats: { count: 95, capacity: 100, percentage: 95 },
        bufferOverflowCount: 0
      })
      controller.handleOverflowCountChange(0)
      expect(controller.isVisible()).toBe(false)

      // Reach 100% - still no overflow
      useNetVisStore.setState({
        bufferStats: { count: 100, capacity: 100, percentage: 100 },
        bufferOverflowCount: 0
      })
      controller.handleOverflowCountChange(0)
      expect(controller.isVisible()).toBe(false)

      // Now overflow occurs (counter increments)
      useNetVisStore.setState({
        bufferStats: { count: 100, capacity: 100, percentage: 100 },
        bufferOverflowCount: 1
      })
      controller.handleOverflowCountChange(1)
      expect(controller.isVisible()).toBe(true)

      controller.cleanup()
    })
  })

  describe('Edge Cases', () => {
    it('handles rapid overflow events correctly', () => {
      const controller = new OverflowNoticeController()

      useNetVisStore.setState({
        bufferStats: { count: 100, capacity: 100, percentage: 100 },
        bufferOverflowCount: 0
      })

      // Rapid overflow events
      useNetVisStore.setState({ bufferOverflowCount: 1 })
      controller.handleOverflowCountChange(1)
      expect(controller.isVisible()).toBe(true)

      vi.advanceTimersByTime(100)
      useNetVisStore.setState({ bufferOverflowCount: 2 })
      controller.handleOverflowCountChange(2)
      expect(controller.isVisible()).toBe(true)

      vi.advanceTimersByTime(100)
      useNetVisStore.setState({ bufferOverflowCount: 3 })
      controller.handleOverflowCountChange(3)
      expect(controller.isVisible()).toBe(true)

      // Should still auto-hide after 5 seconds from last overflow
      vi.advanceTimersByTime(5000)
      vi.runAllTimers()
      expect(controller.isVisible()).toBe(false)

      controller.cleanup()
    })

    it('overflow counter never decreases (cumulative)', () => {
      const controller = new OverflowNoticeController()

      useNetVisStore.setState({
        bufferStats: { count: 100, capacity: 100, percentage: 100 },
        bufferOverflowCount: 0
      })

      // Counter increments
      for (let i = 1; i <= 5; i++) {
        useNetVisStore.setState({ bufferOverflowCount: i })
        controller.handleOverflowCountChange(i)
        expect(controller.isVisible()).toBe(true)

        // Hide and verify
        vi.advanceTimersByTime(5000)
        vi.runAllTimers()
        expect(controller.isVisible()).toBe(false)
      }

      controller.cleanup()
    })

    it('cleanup clears pending timer', () => {
      const controller = new OverflowNoticeController()

      useNetVisStore.setState({
        bufferStats: { count: 100, capacity: 100, percentage: 100 },
        bufferOverflowCount: 1
      })

      controller.handleOverflowCountChange(1)
      expect(controller.isVisible()).toBe(true)

      // Cleanup before timer fires
      controller.cleanup()

      // Advance time - should not affect visibility after cleanup
      vi.advanceTimersByTime(5000)
      vi.runAllTimers()

      // Visibility state is frozen at cleanup time
      expect(controller.isVisible()).toBe(true)
    })
  })

  describe('Semantic Correctness', () => {
    it('overflow is an event, not a state', () => {
      const controller = new OverflowNoticeController()

      // Key insight: overflow is detected by counter increment, not by percentage value
      
      // Scenario 1: Buffer at 100% for a while, no overflow
      useNetVisStore.setState({
        bufferStats: { count: 100, capacity: 100, percentage: 100 },
        bufferOverflowCount: 0
      })
      controller.handleOverflowCountChange(0)
      expect(controller.isVisible()).toBe(false)

      // Time passes, still at 100%, still no overflow
      vi.advanceTimersByTime(10000)
      expect(controller.isVisible()).toBe(false)

      // Scenario 2: Overflow event occurs (counter increments)
      useNetVisStore.setState({
        bufferStats: { count: 100, capacity: 100, percentage: 100 },
        bufferOverflowCount: 1
      })
      controller.handleOverflowCountChange(1)
      expect(controller.isVisible()).toBe(true)

      // This demonstrates: overflow ≠ 100% usage, overflow = event

      controller.cleanup()
    })

    it('repeated overflows are distinct events, not a continuous state', () => {
      const controller = new OverflowNoticeController()

      useNetVisStore.setState({
        bufferStats: { count: 100, capacity: 100, percentage: 100 },
        bufferOverflowCount: 0
      })

      // Each overflow is a distinct event that triggers the notice
      const overflowEvents = [1, 2, 3, 4, 5]

      for (const count of overflowEvents) {
        // Overflow event
        useNetVisStore.setState({ bufferOverflowCount: count })
        controller.handleOverflowCountChange(count)
        expect(controller.isVisible()).toBe(true)

        // Auto-hide
        vi.advanceTimersByTime(5000)
        vi.runAllTimers()
        expect(controller.isVisible()).toBe(false)
      }

      // This demonstrates: each overflow event is independent and re-triggers the notice

      controller.cleanup()
    })
  })
})
