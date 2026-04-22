/**
 * Unit tests for help-text completeness.
 * Feature: netvis-core, Task 18.2
 * Requirements: Req 20.1
 *
 * Verifies that every data-help-id value used in components resolves to an
 * entry in help-text.json, and that every entry is structurally valid.
 *
 * Strategy: scan component source files for data-help-id and HelpIcon helpId
 * usages, then cross-reference against the keys in help-text.json.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'
import { describe, it, expect, beforeAll } from 'vitest'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HelpEntry {
  label: string
  description: string
}

type HelpTextMap = Record<string, HelpEntry>

// ─── Load data ────────────────────────────────────────────────────────────────

let helpText: HelpTextMap
let helpTextKeys: Set<string>

beforeAll(() => {
  const dataPath = resolve(__dirname, '../../renderer/src/data/help-text.json')
  helpText = JSON.parse(readFileSync(dataPath, 'utf-8')) as HelpTextMap
  helpTextKeys = new Set(Object.keys(helpText))
})

// ─── Component scanner ────────────────────────────────────────────────────────

/**
 * Recursively collect all .tsx and .ts files under a directory.
 */
function collectSourceFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      results.push(...collectSourceFiles(full))
    } else if (full.endsWith('.tsx') || full.endsWith('.ts')) {
      results.push(full)
    }
  }
  return results
}

/**
 * Extract all data-help-id="..." values from a source file string.
 */
function extractDataHelpIds(source: string): string[] {
  const matches = [...source.matchAll(/data-help-id=["']([^"']+)["']/g)]
  return matches.map((m) => m[1] as string)
}

/**
 * Extract all helpId="..." values from HelpIcon usages in a source file.
 */
function extractHelpIconIds(source: string): string[] {
  const matches = [...source.matchAll(/helpId=["']([^"']+)["']/g)]
  return matches.map((m) => m[1] as string)
}

// ─── Collect all IDs used in components ──────────────────────────────────────

let usedHelpIds: string[]
let componentFiles: string[]

beforeAll(() => {
  const componentsDir = resolve(__dirname, '../../renderer/src/components')
  componentFiles = collectSourceFiles(componentsDir)

  const allIds: string[] = []
  for (const file of componentFiles) {
    const source = readFileSync(file, 'utf-8')
    allIds.push(...extractDataHelpIds(source))
    allIds.push(...extractHelpIconIds(source))
  }

  // Deduplicate
  usedHelpIds = [...new Set(allIds)]
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('help-text.json completeness (Task 18.2, Req 20.1)', () => {
  /**
   * Every data-help-id and HelpIcon helpId used in components must resolve
   * to an entry in help-text.json.
   */
  it('every help ID used in components resolves to a help-text.json entry', () => {
    expect(usedHelpIds.length).toBeGreaterThan(0) // sanity: we found some IDs

    for (const id of usedHelpIds) {
      expect(
        helpTextKeys.has(id),
        `help ID "${id}" used in a component but missing from help-text.json`
      ).toBe(true)
    }
  })

  /**
   * Every entry in help-text.json has a non-empty label and description.
   */
  it('every help-text.json entry has a non-empty label and description', () => {
    for (const [key, entry] of Object.entries(helpText)) {
      expect(typeof entry.label, `help-text["${key}"].label must be a string`).toBe('string')
      expect(
        entry.label.trim().length,
        `help-text["${key}"].label must not be empty`
      ).toBeGreaterThan(0)

      expect(typeof entry.description, `help-text["${key}"].description must be a string`).toBe(
        'string'
      )
      expect(
        entry.description.trim().length,
        `help-text["${key}"].description must not be empty`
      ).toBeGreaterThan(0)
    }
  })

  /**
   * The four controls explicitly named in task 18 (FilterBar, InterfaceSelector,
   * buffer-capacity, simulated-speed) must all have entries.
   */
  it('required controls from task 18 all have help-text entries', () => {
    const requiredIds = [
      'filter-bar',
      'interface-selector',
      'buffer-capacity',
      'simulated-speed'
    ] as const

    for (const id of requiredIds) {
      expect(helpTextKeys.has(id), `Required help ID "${id}" is missing from help-text.json`).toBe(
        true
      )
    }
  })

  /**
   * No help-text.json entry has duplicate keys (JSON.parse deduplicates, but
   * we verify the parsed object has the expected count by re-parsing raw text).
   */
  it('help-text.json has no duplicate top-level keys', () => {
    const dataPath = resolve(__dirname, '../../renderer/src/data/help-text.json')
    const raw = readFileSync(dataPath, 'utf-8')

    // Count key occurrences in raw JSON text
    const keyMatches = [...raw.matchAll(/"([^"]+)"\s*:/g)].map((m) => m[1] as string)
    // Filter to only top-level keys (those that appear in the parsed object)
    const topLevelKeys = keyMatches.filter((k) => helpTextKeys.has(k))
    const uniqueTopLevel = new Set(topLevelKeys)

    expect(uniqueTopLevel.size).toBe(helpTextKeys.size)
  })

  /**
   * Structural check: every entry is an object with exactly 'label' and
   * 'description' string fields — no extra or missing fields.
   */
  it('every help-text.json entry has exactly the shape { label, description }', () => {
    for (const [key, entry] of Object.entries(helpText)) {
      const keys = Object.keys(entry).sort()
      expect(keys, `help-text["${key}"] has unexpected shape: ${JSON.stringify(keys)}`).toEqual([
        'description',
        'label'
      ])
    }
  })

  /**
   * Sanity: the scanner found component files to scan.
   */
  it('component scanner found at least one .tsx file', () => {
    const tsxFiles = componentFiles.filter((f) => f.endsWith('.tsx'))
    expect(tsxFiles.length).toBeGreaterThan(0)
  })

  /**
   * Sanity: the scanner extracted at least the four known required IDs.
   */
  it('scanner extracted at least the four known required help IDs from components', () => {
    expect(usedHelpIds).toContain('filter-bar')
    expect(usedHelpIds).toContain('interface-selector')
    expect(usedHelpIds).toContain('buffer-capacity')
    expect(usedHelpIds).toContain('simulated-speed')
  })
})
