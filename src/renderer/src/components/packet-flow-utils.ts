/**
 * Utility functions for PacketFlowTimeline.
 * Extracted to a separate file so PacketFlowTimeline.tsx only exports
 * React components — required for Vite Fast Refresh compatibility.
 */

const BUCKET_WIDTH_MS = 1000

/**
 * Build a filter expression that matches packets within a 1-second bucket.
 * Used by Req 22.4 click handler.
 */
export function timeRangeFilter(startMs: number): string {
  const endMs = startMs + BUCKET_WIDTH_MS
  return `ts >= ${startMs} AND ts < ${endMs}`
}
