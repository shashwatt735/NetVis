/**
 * IPC-SEC-01: zod schemas for all IPC invoke payloads.
 * Every ipcMain.handle() handler MUST validate its input against the
 * corresponding schema before processing. Invalid payloads are rejected
 * with a structured error — never passed to native APIs.
 *
 * Schemas are stubs here; populated as each IPC channel is implemented
 * in Task 11.
 */
import { z } from 'zod'

// --- Capture ---
export const CaptureStartSchema = z.object({
  iface: z.string().min(1)
})

export const CaptureStartSimulatedSchema = z.object({
  path: z.string().min(1),
  speed: z.union([z.literal(0.5), z.literal(1), z.literal(2), z.literal(5)])
})

// --- PCAP file ---
export const PcapStartFileSchema = z.object({
  path: z.string().min(1)
})

// --- Buffer ---
export const BufferSetCapacitySchema = z.object({
  capacity: z.number().int().min(1000).max(100000)
})

// --- Settings ---
export const SettingsPatchSchema = z
  .object({
    bufferCapacity: z.number().int().min(1000).max(100000).optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
    welcomeSeen: z.boolean().optional(),
    completedChallenges: z.array(z.string()).optional(),
    reducedMotion: z.boolean().optional()
  })
  .strict()

// Helper: parse and throw a structured error on failure
export function validateOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new Error(`IPC validation failed: ${result.error.message}`)
  }
  return result.data
}
