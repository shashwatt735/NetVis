// Feature: netvis-core, Property 17: Input sanitization
// Validates: Requirements 15.2

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  validateOrThrow,
  CaptureStartSchema,
  CaptureStartSimulatedSchema,
  PcapStartFileSchema,
  BufferSetCapacitySchema,
  SettingsPatchSchema
} from '../../main/ipc-schemas'

/**
 * Property 17: Input sanitization
 *
 * All IPC payloads are validated with zod before processing.
 * Invalid payloads are rejected with structured errors — never passed to native APIs.
 *
 * Strategy: generate arbitrary inputs (including malicious/malformed data)
 * and verify that validation either accepts valid inputs or rejects invalid
 * inputs with a structured error (never crashes, never passes through).
 */

describe('IPC Input Sanitization (P17)', () => {
  /**
   * Property 17a: CaptureStartSchema rejects empty or non-string interface names
   */
  it('CaptureStartSchema rejects invalid interface names', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(''), // empty string
          fc.constant(null),
          fc.constant(undefined),
          fc.integer(),
          fc.boolean(),
          fc.array(fc.string()),
          fc.object()
        ),
        (invalidIface) => {
          expect(() => validateOrThrow(CaptureStartSchema, { iface: invalidIface })).toThrow()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 17b: CaptureStartSchema accepts valid non-empty strings
   */
  it('CaptureStartSchema accepts valid interface names', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (iface) => {
        const result = validateOrThrow(CaptureStartSchema, { iface })
        expect(result.iface).toBe(iface)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 17c: CaptureStartSimulatedSchema rejects invalid speed multipliers
   */
  it('CaptureStartSimulatedSchema rejects invalid speed values', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.oneof(
          fc.float({ min: -10, max: 10 }).filter((x) => ![0.5, 1, 2, 5].includes(x)),
          fc.constant(null),
          fc.constant(undefined),
          fc.string(),
          fc.boolean()
        ),
        (path, invalidSpeed) => {
          expect(() =>
            validateOrThrow(CaptureStartSimulatedSchema, { path, speed: invalidSpeed })
          ).toThrow()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 17d: CaptureStartSimulatedSchema accepts valid speed multipliers
   */
  it('CaptureStartSimulatedSchema accepts valid speed multipliers', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.constantFrom(0.5, 1, 2, 5), (path, speed) => {
        const result = validateOrThrow(CaptureStartSimulatedSchema, { path, speed })
        expect(result.path).toBe(path)
        expect(result.speed).toBe(speed)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 17e: PcapStartFileSchema rejects empty or non-string paths
   */
  it('PcapStartFileSchema rejects invalid file paths', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(''),
          fc.constant(null),
          fc.constant(undefined),
          fc.integer(),
          fc.boolean(),
          fc.array(fc.string())
        ),
        (invalidPath) => {
          expect(() => validateOrThrow(PcapStartFileSchema, { path: invalidPath })).toThrow()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 17f: BufferSetCapacitySchema clamps capacity to [1000, 100000]
   */
  it('BufferSetCapacitySchema rejects capacity outside valid range', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -1000, max: 999 }), // too low
          fc.integer({ min: 100001, max: 1000000 }), // too high
          fc.constant(null),
          fc.constant(undefined),
          fc.string(),
          fc.boolean(),
          fc.float() // non-integer
        ),
        (invalidCapacity) => {
          expect(() =>
            validateOrThrow(BufferSetCapacitySchema, { capacity: invalidCapacity })
          ).toThrow()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 17g: BufferSetCapacitySchema accepts valid capacity values
   */
  it('BufferSetCapacitySchema accepts capacity in range [1000, 100000]', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1000, max: 100000 }), (capacity) => {
        const result = validateOrThrow(BufferSetCapacitySchema, { capacity })
        expect(result.capacity).toBe(capacity)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 17h: SettingsPatchSchema rejects invalid theme values
   */
  it('SettingsPatchSchema rejects invalid theme values', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s !== 'light' && s !== 'dark' && s !== 'system'),
        (invalidTheme) => {
          expect(() => validateOrThrow(SettingsPatchSchema, { theme: invalidTheme })).toThrow()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 17i: SettingsPatchSchema accepts valid theme values
   */
  it('SettingsPatchSchema accepts valid theme values', () => {
    fc.assert(
      fc.property(fc.constantFrom('light', 'dark', 'system'), (theme) => {
        const result = validateOrThrow(SettingsPatchSchema, { theme })
        expect(result.theme).toBe(theme)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 17j: SettingsPatchSchema rejects extra/unknown fields
   */
  it('SettingsPatchSchema rejects payloads with unknown fields', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.anything(),
        (unknownKey, unknownValue) => {
          // Skip if unknownKey happens to be a valid field name
          if (
            [
              'bufferCapacity',
              'theme',
              'welcomeSeen',
              'completedChallenges',
              'reducedMotion'
            ].includes(unknownKey)
          ) {
            return
          }
          expect(() =>
            validateOrThrow(SettingsPatchSchema, { [unknownKey]: unknownValue })
          ).toThrow()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 17k: SettingsPatchSchema accepts partial valid settings
   */
  it('SettingsPatchSchema accepts partial valid settings', () => {
    fc.assert(
      fc.property(
        fc.record(
          {
            bufferCapacity: fc.option(fc.integer({ min: 1000, max: 100000 }), { nil: undefined }),
            theme: fc.option(fc.constantFrom('light', 'dark', 'system'), { nil: undefined }),
            welcomeSeen: fc.option(fc.boolean(), { nil: undefined }),
            completedChallenges: fc.option(fc.array(fc.string()), { nil: undefined }),
            reducedMotion: fc.option(fc.boolean(), { nil: undefined })
          },
          { requiredKeys: [] }
        ),
        (patch) => {
          // Filter out undefined values (zod doesn't like them in the input)
          const cleanPatch = Object.fromEntries(
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            Object.entries(patch).filter(([_, v]) => v !== undefined)
          )
          if (Object.keys(cleanPatch).length === 0) return // skip empty patches

          const result = validateOrThrow(SettingsPatchSchema, cleanPatch)
          expect(result).toMatchObject(cleanPatch)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 17l: validateOrThrow never returns undefined or null for valid input
   */
  it('validateOrThrow always returns a defined object for valid input', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (iface) => {
        const result = validateOrThrow(CaptureStartSchema, { iface })
        expect(result).toBeDefined()
        expect(result).not.toBeNull()
        expect(typeof result).toBe('object')
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 17m: validateOrThrow always throws Error (never returns) for invalid input
   */
  it('validateOrThrow always throws for invalid input', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.integer(),
          fc.boolean(),
          fc.string(),
          fc.array(fc.anything()),
          fc.object()
        ),
        (invalidInput) => {
          expect(() => validateOrThrow(CaptureStartSchema, invalidInput)).toThrow(Error)
        }
      ),
      { numRuns: 100 }
    )
  })
})
