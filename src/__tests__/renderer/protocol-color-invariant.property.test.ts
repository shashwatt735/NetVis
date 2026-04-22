// Feature: netvis-core, Property 18: Protocol color invariant
// Validates: Requirements 18.2, 22.3, 23.2, 24.5, 26.5

/**
 * Property 18: Protocol color invariant
 *
 * For every protocol in PROTOCOL_COLORS:
 *   (a) A corresponding CSS custom property (--proto-<name>) exists in theme.css
 *   (b) The hex value in PROTOCOL_COLORS matches the value declared in theme.css :root
 *   (c) Protocol colors are invariant across modes — the .dark block does NOT
 *       re-declare any --proto-* variable (they must not change between themes)
 *   (d) dim and border variants follow the exact opacity formula:
 *       dim  = rgba(r,g,b,0.12)
 *       border = rgba(r,g,b,0.30)
 *
 * Validates: Requirements 18.2, 22.3, 23.2, 24.5, 26.5
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect, beforeAll } from 'vitest'
import * as fc from 'fast-check'
import { PROTOCOL_COLORS, protocolColorKey } from '../../renderer/src/constants/protocol-colors'
import type { Protocol } from '../../renderer/src/constants/protocol-colors'

// ─── Load theme.css once ──────────────────────────────────────────────────────

let themeCss = ''
let rootBlock = ''
let darkBlock = ''

beforeAll(() => {
  const themePath = resolve(__dirname, '../../renderer/src/assets/theme.css')
  themeCss = readFileSync(themePath, 'utf-8')

  // Extract :root { ... } block (first occurrence)
  const rootMatch = themeCss.match(/:root\s*\{([^}]+)\}/)
  rootBlock = rootMatch ? rootMatch[1] : ''

  // Extract .dark { ... } block
  const darkMatch = themeCss.match(/\.dark\s*\{([^}]+)\}/)
  darkBlock = darkMatch ? darkMatch[1] : ''
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse a hex color like #3B82F6 into [r, g, b] */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return [r, g, b]
}

/** Extract the value of a CSS custom property from a CSS block string */
function getCssVar(block: string, varName: string): string | null {
  const re = new RegExp(`${varName}\\s*:\\s*([^;]+);`)
  const m = block.match(re)
  return m ? m[1].trim() : null
}

const PROTOCOLS = Object.keys(PROTOCOL_COLORS) as Protocol[]

// ─── Helper for CSS variable name mapping ─────────────────────────────────────

/** Map CSS variable name (e.g., "ipv4") back to canonical Protocol key (e.g., "IPv4") */
function cssProtoVarToProtocol(cssName: string): Protocol | null {
  const normalized = cssName.toLowerCase()
  const protocol = PROTOCOLS.find((proto) => proto.toLowerCase() === normalized)
  return protocol ?? null
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Protocol color invariant (P18)', () => {
  /**
   * Property 18a: Every protocol has a --proto-<name> CSS variable in :root.
   * Validates: Requirement 18.2
   */
  it('every protocol has a CSS custom property in :root', () => {
    for (const proto of PROTOCOLS) {
      const varName = `--proto-${proto.toLowerCase()}`
      const value = getCssVar(rootBlock, varName)
      expect(value, `Missing ${varName} in :root`).not.toBeNull()
    }
  })

  /**
   * Property 18b: CSS variable hex values match PROTOCOL_COLORS exactly.
   * Validates: Requirement 18.2
   */
  it('CSS variable hex values match PROTOCOL_COLORS token values', () => {
    for (const proto of PROTOCOLS) {
      const varName = `--proto-${proto.toLowerCase()}`
      const cssValue = getCssVar(rootBlock, varName)
      const tokenValue = PROTOCOL_COLORS[proto].color
      expect(
        cssValue?.toLowerCase(),
        `${varName}: CSS="${cssValue}" does not match token="${tokenValue}"`
      ).toBe(tokenValue.toLowerCase())
    }
  })

  /**
   * Property 18c: Protocol colors are invariant — .dark block must NOT re-declare
   * any --proto-* variable. If it did, colors would change between themes.
   * Validates: Requirement 18.2
   */
  it('protocol colors are not overridden in .dark block (invariant across modes)', () => {
    for (const proto of PROTOCOLS) {
      const varName = `--proto-${proto.toLowerCase()}`
      const darkValue = getCssVar(darkBlock, varName)
      expect(
        darkValue,
        `${varName} must NOT be declared in .dark — protocol colors are invariant`
      ).toBeNull()
    }
  })

  /**
   * Property 18d: dim variant follows rgba(r,g,b,0.12) formula exactly.
   * Validates: Requirement 18.2
   */
  it('dim variants follow rgba(r,g,b,0.12) formula', () => {
    fc.assert(
      fc.property(fc.constantFrom(...PROTOCOLS), (proto) => {
        const [r, g, b] = hexToRgb(PROTOCOL_COLORS[proto].color)
        const expectedDim = `rgba(${r},${g},${b},0.12)`
        expect(PROTOCOL_COLORS[proto].dim).toBe(expectedDim)
      }),
      { numRuns: PROTOCOLS.length }
    )
  })

  /**
   * Property 18e: border variant follows rgba(r,g,b,0.3) formula exactly.
   * Validates: Requirement 18.2
   */
  it('border variants follow rgba(r,g,b,0.3) formula', () => {
    fc.assert(
      fc.property(fc.constantFrom(...PROTOCOLS), (proto) => {
        const [r, g, b] = hexToRgb(PROTOCOL_COLORS[proto].color)
        const expectedBorder = `rgba(${r},${g},${b},0.3)`
        expect(PROTOCOL_COLORS[proto].border).toBe(expectedBorder)
      }),
      { numRuns: PROTOCOLS.length }
    )
  })

  /**
   * Property 18f: dim CSS variables in :root match the token dim values.
   * Validates: Requirement 18.2
   */
  it('dim CSS variables in :root match token dim values', () => {
    for (const proto of PROTOCOLS) {
      const varName = `--proto-${proto.toLowerCase()}-dim`
      const cssValue = getCssVar(rootBlock, varName)
      expect(cssValue, `Missing ${varName} in :root`).not.toBeNull()
      // Normalize whitespace in rgba() for comparison
      const normalizedCss = cssValue?.replace(/\s/g, '') ?? ''
      const normalizedToken = PROTOCOL_COLORS[proto].dim.replace(/\s/g, '')
      expect(normalizedCss, `${varName} mismatch`).toBe(normalizedToken)
    }
  })

  /**
   * Property 18g: border CSS variables in :root match the token border values.
   * Validates: Requirement 18.2
   */
  it('border CSS variables in :root match token border values', () => {
    for (const proto of PROTOCOLS) {
      const varName = `--proto-${proto.toLowerCase()}-border`
      const cssValue = getCssVar(rootBlock, varName)
      expect(cssValue, `Missing ${varName} in :root`).not.toBeNull()
      const normalizedCss = cssValue?.replace(/\s/g, '') ?? ''
      const normalizedToken = PROTOCOL_COLORS[proto].border.replace(/\s/g, '')
      expect(normalizedCss, `${varName} mismatch`).toBe(normalizedToken)
    }
  })

  /**
   * Property 18h: Adding a new protocol to PROTOCOL_COLORS without a CSS variable
   * would be caught — the set of CSS --proto-* vars matches the token keys exactly.
   * Validates: Requirement 18.2
   */
  it('CSS --proto-* variable set matches PROTOCOL_COLORS keys exactly', () => {
    // Extract all --proto-<name> variables (excluding -dim and -border suffixes)
    const cssProtoVars = [...rootBlock.matchAll(/--proto-(\w+)\s*:/g)]
      .map((m) => m[1])
      .filter((name) => !name.endsWith('dim') && !name.endsWith('border'))

    // Map CSS names back to canonical Protocol keys
    const canonicalCssProtos = cssProtoVars
      .map((cssName) => cssProtoVarToProtocol(cssName))
      .filter((proto): proto is Protocol => proto !== null)

    const uniqueCssProtos = [...new Set(canonicalCssProtos)].sort()
    const tokenProtos = [...PROTOCOLS].sort()

    expect(uniqueCssProtos).toEqual(tokenProtos)
  })

  /**
   * Property 18i: protocolColorKey falls back to OTHER for inherited and unknown property names.
   * Validates: Requirement 18.2 - defensive programming for the helper function
   */
  it('protocolColorKey falls back to OTHER for inherited and unknown property names', () => {
    expect(protocolColorKey('toString')).toBe('OTHER')
    expect(protocolColorKey('constructor')).toBe('OTHER')
    expect(protocolColorKey('hasOwnProperty')).toBe('OTHER')
    expect(protocolColorKey('definitely-not-a-protocol')).toBe('OTHER')
  })
})
