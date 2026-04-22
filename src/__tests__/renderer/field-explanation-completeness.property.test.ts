// Feature: netvis-core, Property 11: Field explanation completeness
// Validates: Requirements 10.2, 10.3

/**
 * Property 11: Field explanation completeness
 *
 * For every protocol/field pair mandated by Req 10.2, field-explanations.json must:
 *   (a) Contain an entry with matching protocol and field keys
 *   (b) Have non-empty label and explanation strings
 *   (c) Have valid byteOffset (>= -1) and byteLength (>= -1, where -1 = variable)
 *   (d) WHERE a field has well-known enumerated values, symbolicValues must be
 *       a non-null object (may be empty for fields with no standard enumerations)
 *   (e) No two entries share the same (protocol, field) pair (uniqueness)
 *
 * Validates: Requirements 10.2, 10.3
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect, beforeAll } from 'vitest'
import * as fc from 'fast-check'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FieldExplanation {
  protocol: string
  field: string
  label: string
  explanation: string
  byteOffset: number
  byteLength: number
  symbolicValues: Record<string, string>
}

// ─── Required fields per Req 10.2 ────────────────────────────────────────────

/**
 * The complete set of (protocol, field) pairs mandated by Requirement 10.2.
 * Fields with well-known enumerated values are marked with hasSymbolicValues: true.
 */
const REQUIRED_FIELDS: ReadonlyArray<{
  protocol: string
  field: string
  hasSymbolicValues: boolean
}> = [
  // Ethernet
  { protocol: 'Ethernet', field: 'dst_mac', hasSymbolicValues: true },
  { protocol: 'Ethernet', field: 'src_mac', hasSymbolicValues: false },
  { protocol: 'Ethernet', field: 'ethertype', hasSymbolicValues: true },
  // IPv4
  { protocol: 'IPv4', field: 'version', hasSymbolicValues: true },
  { protocol: 'IPv4', field: 'ihl', hasSymbolicValues: true },
  { protocol: 'IPv4', field: 'dscp', hasSymbolicValues: true },
  { protocol: 'IPv4', field: 'total_length', hasSymbolicValues: false },
  { protocol: 'IPv4', field: 'ttl', hasSymbolicValues: true },
  { protocol: 'IPv4', field: 'protocol', hasSymbolicValues: true },
  { protocol: 'IPv4', field: 'src_ip', hasSymbolicValues: false },
  { protocol: 'IPv4', field: 'dst_ip', hasSymbolicValues: false },
  // TCP
  { protocol: 'TCP', field: 'src_port', hasSymbolicValues: true },
  { protocol: 'TCP', field: 'dst_port', hasSymbolicValues: true },
  { protocol: 'TCP', field: 'seq', hasSymbolicValues: false },
  { protocol: 'TCP', field: 'ack', hasSymbolicValues: false },
  { protocol: 'TCP', field: 'flags', hasSymbolicValues: true },
  { protocol: 'TCP', field: 'window_size', hasSymbolicValues: false },
  // UDP
  { protocol: 'UDP', field: 'src_port', hasSymbolicValues: true },
  { protocol: 'UDP', field: 'dst_port', hasSymbolicValues: true },
  { protocol: 'UDP', field: 'length', hasSymbolicValues: false },
  { protocol: 'UDP', field: 'checksum', hasSymbolicValues: true },
  // ICMP
  { protocol: 'ICMP', field: 'type', hasSymbolicValues: true },
  { protocol: 'ICMP', field: 'code', hasSymbolicValues: true },
  { protocol: 'ICMP', field: 'checksum', hasSymbolicValues: false },
  // DNS
  { protocol: 'DNS', field: 'id', hasSymbolicValues: false },
  { protocol: 'DNS', field: 'flags', hasSymbolicValues: true },
  { protocol: 'DNS', field: 'qdcount', hasSymbolicValues: false },
  { protocol: 'DNS', field: 'ancount', hasSymbolicValues: false },
  { protocol: 'DNS', field: 'query_name', hasSymbolicValues: false },
  { protocol: 'DNS', field: 'record_type', hasSymbolicValues: true }
] as const

// ─── Load data ────────────────────────────────────────────────────────────────

let entries: FieldExplanation[] = []
let entryMap: Map<string, FieldExplanation>

beforeAll(() => {
  const dataPath = resolve(__dirname, '../../renderer/src/data/field-explanations.json')
  const raw = readFileSync(dataPath, 'utf-8')
  entries = JSON.parse(raw) as FieldExplanation[]
  entryMap = new Map(entries.map((e) => [`${e.protocol}::${e.field}`, e]))
})

// ─── Helper ───────────────────────────────────────────────────────────────────

function getEntry(protocol: string, field: string): FieldExplanation | undefined {
  return entryMap.get(`${protocol}::${field}`)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Field explanation completeness (P11)', () => {
  /**
   * Property 11a: Every required (protocol, field) pair has an entry.
   * Validates: Requirement 10.2
   */
  it('every required protocol/field pair has an entry in field-explanations.json', () => {
    for (const { protocol, field } of REQUIRED_FIELDS) {
      const entry = getEntry(protocol, field)
      expect(entry, `Missing entry for ${protocol}.${field}`).toBeDefined()
    }
  })

  /**
   * Property 11b: Every entry has non-empty label and explanation.
   * Validates: Requirement 10.2
   */
  it('every entry has a non-empty label and explanation', () => {
    fc.assert(
      fc.property(fc.constantFrom(...REQUIRED_FIELDS), ({ protocol, field }) => {
        const entry = getEntry(protocol, field)
        if (!entry) return // caught by 11a
        expect(entry.label.trim().length).toBeGreaterThan(0)
        expect(entry.explanation.trim().length).toBeGreaterThan(0)
      }),
      { numRuns: REQUIRED_FIELDS.length }
    )
  })

  /**
   * Property 11c: byteOffset and byteLength are valid integers (>= -1).
   * -1 is the sentinel for variable-length fields (e.g., DNS query_name).
   * Validates: Requirement 10.2
   */
  it('every entry has valid byteOffset and byteLength (>= -1)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...REQUIRED_FIELDS), ({ protocol, field }) => {
        const entry = getEntry(protocol, field)
        if (!entry) return
        expect(Number.isInteger(entry.byteOffset)).toBe(true)
        expect(entry.byteOffset).toBeGreaterThanOrEqual(-1)
        expect(Number.isInteger(entry.byteLength)).toBe(true)
        expect(entry.byteLength).toBeGreaterThanOrEqual(-1)
      }),
      { numRuns: REQUIRED_FIELDS.length }
    )
  })

  /**
   * Property 11d: Fields with well-known enumerated values have at least one
   * symbolic value entry. Fields without enumerated values have a symbolicValues
   * object (may be empty).
   * Validates: Requirement 10.3
   */
  it('fields with well-known enumerated values have at least one symbolic value', () => {
    for (const { protocol, field, hasSymbolicValues } of REQUIRED_FIELDS) {
      const entry = getEntry(protocol, field)
      if (!entry) continue

      expect(
        typeof entry.symbolicValues,
        `${protocol}.${field}: symbolicValues must be an object`
      ).toBe('object')

      if (hasSymbolicValues) {
        expect(
          Object.keys(entry.symbolicValues).length,
          `${protocol}.${field}: expected at least one symbolic value`
        ).toBeGreaterThan(0)
      }
    }
  })

  /**
   * Property 11e: No two entries share the same (protocol, field) pair.
   * Validates: Requirement 10.2 (data integrity)
   */
  it('all (protocol, field) pairs are unique — no duplicate entries', () => {
    const seen = new Set<string>()
    for (const entry of entries) {
      const key = `${entry.protocol}::${entry.field}`
      expect(seen.has(key), `Duplicate entry: ${key}`).toBe(false)
      seen.add(key)
    }
  })

  /**
   * Property 11f: The set of protocols covered matches exactly the required set.
   * Validates: Requirement 10.2
   */
  it('covers all required protocols: Ethernet, IPv4, TCP, UDP, ICMP, DNS', () => {
    const requiredProtocols = new Set(REQUIRED_FIELDS.map((f) => f.protocol))
    const coveredProtocols = new Set(entries.map((e) => e.protocol))

    for (const proto of requiredProtocols) {
      expect(coveredProtocols.has(proto), `Protocol ${proto} not covered`).toBe(true)
    }
  })

  /**
   * Property 11g: Every entry's symbolicValues values are non-empty strings.
   * Validates: Requirement 10.3
   */
  it('all symbolic value descriptions are non-empty strings', () => {
    for (const entry of entries) {
      for (const [key, value] of Object.entries(entry.symbolicValues)) {
        expect(
          typeof value,
          `${entry.protocol}.${entry.field}[${key}]: value must be a string`
        ).toBe('string')
        expect(
          value.trim().length,
          `${entry.protocol}.${entry.field}[${key}]: description must not be empty`
        ).toBeGreaterThan(0)
      }
    }
  })

  /**
   * Property 11h: fast-check — for any randomly sampled required field,
   * the entry is structurally valid (all required keys present with correct types).
   * Validates: Requirements 10.2, 10.3
   */
  it('randomly sampled required fields are structurally valid (fast-check)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...REQUIRED_FIELDS), ({ protocol, field }) => {
        const entry = getEntry(protocol, field)
        if (!entry) return

        // All required keys must be present
        expect('protocol' in entry).toBe(true)
        expect('field' in entry).toBe(true)
        expect('label' in entry).toBe(true)
        expect('explanation' in entry).toBe(true)
        expect('byteOffset' in entry).toBe(true)
        expect('byteLength' in entry).toBe(true)
        expect('symbolicValues' in entry).toBe(true)

        // Types
        expect(typeof entry.protocol).toBe('string')
        expect(typeof entry.field).toBe('string')
        expect(typeof entry.label).toBe('string')
        expect(typeof entry.explanation).toBe('string')
        expect(typeof entry.byteOffset).toBe('number')
        expect(typeof entry.byteLength).toBe('number')
        expect(typeof entry.symbolicValues).toBe('object')
        expect(entry.symbolicValues).not.toBeNull()
      }),
      { numRuns: 25 }
    )
  })
})
