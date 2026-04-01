// Feature: netvis-core
// Unit tests for Settings_Store
// Validates: Requirements 12.1, 20.2

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SettingsStore } from '../../main/settings-store'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

describe('Settings_Store — unit tests', () => {
  let tempDir: string
  let settingsPath: string
  let store: SettingsStore

  beforeEach(() => {
    // Create a temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'netvis-test-'))
    settingsPath = path.join(tempDir, 'settings.json')
  })

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  /**
   * Test: default values on missing file
   * Validates: Requirement 20.2 — handle missing file gracefully
   */
  it('uses default values when settings file does not exist', () => {
    store = new SettingsStore(tempDir)
    const settings = store.get()

    expect(settings.bufferCapacity).toBe(10000)
    expect(settings.theme).toBe('system')
    expect(settings.welcomeSeen).toBe(false)
    expect(settings.completedChallenges).toEqual([])
    expect(settings.reducedMotion).toBe(false)
  })

  /**
   * Test: default values on corrupt file
   * Validates: Requirement 20.2 — handle corrupt file gracefully
   */
  it('uses default values when settings file is corrupt', () => {
    // Write invalid JSON
    fs.writeFileSync(settingsPath, '{ invalid json }', 'utf-8')

    store = new SettingsStore(tempDir)
    const settings = store.get()

    expect(settings.bufferCapacity).toBe(10000)
    expect(settings.theme).toBe('system')
  })

  /**
   * Test: patch merge
   * Validates: Requirement 20.2 — partial updates work correctly
   */
  it('merges partial settings updates correctly', () => {
    store = new SettingsStore(tempDir)

    // Update only bufferCapacity
    store.set({ bufferCapacity: 50000 })
    let settings = store.get()
    expect(settings.bufferCapacity).toBe(50000)
    expect(settings.theme).toBe('system') // unchanged

    // Update only theme
    store.set({ theme: 'dark' })
    settings = store.get()
    expect(settings.bufferCapacity).toBe(50000) // unchanged
    expect(settings.theme).toBe('dark')
  })

  /**
   * Test: persistence across reload
   * Validates: Requirement 20.2 — settings persist to disk
   */
  it('persists settings across store reload', () => {
    store = new SettingsStore(tempDir)

    // Set some values
    store.set({
      bufferCapacity: 25000,
      theme: 'light',
      welcomeSeen: true,
      completedChallenges: ['challenge-1', 'challenge-2']
    })

    // Create a new store instance (simulates app restart)
    const store2 = new SettingsStore(tempDir)
    const settings = store2.get()

    expect(settings.bufferCapacity).toBe(25000)
    expect(settings.theme).toBe('light')
    expect(settings.welcomeSeen).toBe(true)
    expect(settings.completedChallenges).toEqual(['challenge-1', 'challenge-2'])
  })

  /**
   * Test: bufferCapacity validation
   * Validates: Requirement 12.1 — buffer capacity range [1000, 100000]
   */
  it('clamps bufferCapacity to valid range [1000, 100000]', () => {
    store = new SettingsStore(tempDir)

    // Too low
    store.set({ bufferCapacity: 500 })
    expect(store.get().bufferCapacity).toBe(1000)

    // Too high
    store.set({ bufferCapacity: 200000 })
    expect(store.get().bufferCapacity).toBe(100000)

    // Valid
    store.set({ bufferCapacity: 50000 })
    expect(store.get().bufferCapacity).toBe(50000)
  })

  /**
   * Test: theme validation
   * Validates: Requirement 18.3 — theme must be 'light', 'dark', or 'system'
   */
  it('rejects invalid theme values', () => {
    store = new SettingsStore(tempDir)

    // Invalid theme falls back to default
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store.set({ theme: 'invalid' as any })
    expect(store.get().theme).toBe('system')

    // Valid themes work
    store.set({ theme: 'light' })
    expect(store.get().theme).toBe('light')

    store.set({ theme: 'dark' })
    expect(store.get().theme).toBe('dark')

    store.set({ theme: 'system' })
    expect(store.get().theme).toBe('system')
  })

  /**
   * Test: change event emission
   * Validates: Requirement 20.2 — emit 'change' event on mutation
   */
  it('emits change event when settings are updated', () => {
    store = new SettingsStore(tempDir)

    let changeCount = 0
    let lastSettings = null

    store.on('change', (settings) => {
      changeCount++
      lastSettings = settings
    })

    // First update
    store.set({ bufferCapacity: 20000 })
    expect(changeCount).toBe(1)
    expect(lastSettings).toMatchObject({ bufferCapacity: 20000 })

    // Second update
    store.set({ theme: 'dark' })
    expect(changeCount).toBe(2)
    expect(lastSettings).toMatchObject({ theme: 'dark' })
  })

  /**
   * Test: no change event when values don't change
   * Validates: Requirement 20.2 — avoid unnecessary events
   */
  it('does not emit change event when setting same value', () => {
    store = new SettingsStore(tempDir)
    store.set({ bufferCapacity: 15000 })

    let changeCount = 0
    store.on('change', () => {
      changeCount++
    })

    // Set same value again
    store.set({ bufferCapacity: 15000 })
    expect(changeCount).toBe(0)
  })

  /**
   * Test: completedChallenges array handling
   * Validates: Requirement 11.5 — challenge completion persistence
   */
  it('handles completedChallenges array correctly', () => {
    store = new SettingsStore(tempDir)

    // Add challenges
    store.set({ completedChallenges: ['tcp-handshake', 'dns-query'] })
    expect(store.get().completedChallenges).toEqual(['tcp-handshake', 'dns-query'])

    // Update with new challenges
    store.set({ completedChallenges: ['tcp-handshake', 'dns-query', 'icmp-echo'] })
    expect(store.get().completedChallenges).toEqual(['tcp-handshake', 'dns-query', 'icmp-echo'])

    // Filters out non-string values
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store.set({ completedChallenges: ['valid', 123 as any, null as any, 'also-valid'] })
    expect(store.get().completedChallenges).toEqual(['valid', 'also-valid'])
  })

  /**
   * Test: load with partial settings file
   * Validates: Requirement 20.2 — merge with defaults for missing fields
   */
  it('merges loaded settings with defaults for missing fields', () => {
    // Write partial settings file
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        bufferCapacity: 30000,
        theme: 'dark'
        // welcomeSeen, completedChallenges, reducedMotion missing
      }),
      'utf-8'
    )

    store = new SettingsStore(tempDir)
    const settings = store.get()

    expect(settings.bufferCapacity).toBe(30000)
    expect(settings.theme).toBe('dark')
    expect(settings.welcomeSeen).toBe(false) // default
    expect(settings.completedChallenges).toEqual([]) // default
    expect(settings.reducedMotion).toBe(false) // default
  })

  /**
   * Test: reducedMotion boolean handling
   * Validates: Requirement 21.5 — reduced motion preference
   */
  it('handles reducedMotion boolean correctly', () => {
    store = new SettingsStore(tempDir)

    store.set({ reducedMotion: true })
    expect(store.get().reducedMotion).toBe(true)

    store.set({ reducedMotion: false })
    expect(store.get().reducedMotion).toBe(false)

    // Invalid values ignored
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store.set({ reducedMotion: 'yes' as any })
    expect(store.get().reducedMotion).toBe(false) // unchanged
  })
})
