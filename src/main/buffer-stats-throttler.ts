/**
 * Buffer Stats Throttler
 * 
 * Implements spacing-based throttling for buffer:stats push channel.
 * Ensures at least 500ms between emissions (Req 12.3, Req 14.2).
 * 
 * Unlike window-based throttling, this ensures the spacing between consecutive
 * emissions is always >= intervalMs, not just within a time window.
 */

import type { BufferStats } from '../shared/capture-types'

export interface BufferStatsThrottler {
  /**
   * Handle a buffer change event. May schedule a throttled emission.
   */
  handleChange(stats: BufferStats): void
  
  /**
   * Clean up any pending timers. Call on shutdown.
   */
  cleanup(): void
}

/**
 * Create a buffer stats throttler with spacing-based throttling.
 * 
 * @param sendFn - Callback to send stats to renderer
 * @param intervalMs - Minimum spacing between emissions (default 500ms)
 * @returns Throttler instance
 */
export function createBufferStatsThrottler(
  sendFn: (stats: BufferStats) => void,
  intervalMs = 500
): BufferStatsThrottler {
  let throttleTimer: NodeJS.Timeout | null = null
  let lastSendTime = 0
  let pendingUpdate = false
  let pendingStats: BufferStats | null = null

  return {
    handleChange(stats: BufferStats): void {
      // Store the latest stats
      pendingStats = stats
      pendingUpdate = true

      // If already scheduled, don't schedule again
      if (throttleTimer) return

      const now = Date.now()
      const timeSinceLastSend = now - lastSendTime
      const delay = Math.max(0, intervalMs - timeSinceLastSend)

      throttleTimer = setTimeout(() => {
        if (pendingUpdate && pendingStats) {
          sendFn(pendingStats)
          lastSendTime = Date.now()
          pendingUpdate = false
          pendingStats = null
        }
        throttleTimer = null
      }, delay)
    },

    cleanup(): void {
      if (throttleTimer) {
        clearTimeout(throttleTimer)
        throttleTimer = null
      }
      pendingUpdate = false
      pendingStats = null
    }
  }
}
