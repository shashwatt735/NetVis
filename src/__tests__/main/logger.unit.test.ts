// Feature: netvis-core, Property 16: Logger entry structure
// Validates: Requirements 13.1, 13.3

import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'

/**
 * The logger produces structured JSON entries. We test the shape
 * of those entries by calling log() directly and capturing output,
 * rather than spinning up the full pino file transport.
 *
 * Strategy: in test mode the logger is never initialized (initLogger
 * is never called), so log() always takes the console.error fallback
 * path. We spy on console.error to capture and parse the JSON output.
 */

// We import the raw log() function, not the Logger wrapper,
// so we can test the entry structure directly.
import { log } from '../../main/logger/index'

const VALID_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'] as const
type LogLevel = (typeof VALID_LEVELS)[number]

describe('Logger — entry structure invariant (P16)', () => {
  let captured: string[] = []
  let originalConsoleError: typeof console.error

  beforeEach(() => {
    captured = []
    originalConsoleError = console.error
    // Spy on console.error — the Phase 1 fallback path used in tests
    console.error = (...args: unknown[]) => {
      captured.push(String(args[0]))
    }
    return () => {
      console.error = originalConsoleError
    }
  })

  /**
   * Property 16a: every log entry is valid JSON.
   * Validates: Requirement 13.1
   */
  it('every log entry is valid JSON regardless of component or message content', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<LogLevel>(...VALID_LEVELS),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 200 }),
        (level, component, message) => {
          captured = []
          log(level, component, message)
          expect(captured).toHaveLength(1)
          expect(() => JSON.parse(captured[0])).not.toThrow()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 16b: every entry contains the required fields:
   * level, time, component, message.
   * Validates: Requirement 13.1
   */
  it('every log entry contains all required fields', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<LogLevel>(...VALID_LEVELS),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 200 }),
        (level, component, message) => {
          captured = []
          log(level, component, message)
          const entry = JSON.parse(captured[0])
          expect(entry).toHaveProperty('level')
          expect(entry).toHaveProperty('time')
          expect(entry).toHaveProperty('component')
          expect(entry).toHaveProperty('message')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 16c: the level field in the entry matches the level passed in.
   * Validates: Requirement 13.1
   */
  it('level field in entry always matches the level argument', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<LogLevel>(...VALID_LEVELS),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (level, component, message) => {
          captured = []
          log(level, component, message)
          const entry = JSON.parse(captured[0])
          expect(entry.level).toBe(level)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 16d: the component and message fields match their arguments exactly.
   * Validates: Requirement 13.1
   */
  it('component and message fields always match their arguments', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<LogLevel>(...VALID_LEVELS),
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.includes('"')),
        fc.string({ minLength: 1, maxLength: 200 }).filter((s) => !s.includes('"')),
        (level, component, message) => {
          captured = []
          log(level, component, message)
          const entry = JSON.parse(captured[0])
          expect(entry.component).toBe(component)
          expect(entry.message).toBe(message)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 16e: extra metadata fields appear in the entry when provided.
   * Validates: Requirement 13.1
   */
  it('extra metadata fields are present in the entry when provided', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<LogLevel>(...VALID_LEVELS),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.record({
          count: fc.integer({ min: 0, max: 10000 }),
          flag: fc.boolean()
        }),
        (level, component, message, extra) => {
          captured = []
          log(level, component, message, extra)
          const entry = JSON.parse(captured[0])
          expect(entry.count).toBe(extra.count)
          expect(entry.flag).toBe(extra.flag)
        }
      ),
      { numRuns: 100 }
    )
  })
})
