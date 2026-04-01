/**
 * Settings_Store — persistent user settings for NetVis.
 *
 * Loads from userData/settings.json at startup, writes on every mutation.
 * Emits 'change' events for IPC synchronization with the renderer.
 *
 * Requirements: Req 12.1, Req 18.3, Req 19.3, Req 20.2
 */

import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as path from 'path'
import { Logger } from '../logger'

export interface Settings {
  bufferCapacity: number // 1000–100000, default 10000 (Req 12.1)
  theme: 'light' | 'dark' | 'system' // default 'system' (Req 18.3)
  welcomeSeen: boolean // default false (Req 19.3)
  completedChallenges: string[] // default [] (Req 11.5)
  reducedMotion: boolean // default false, mirrors OS preference (Req 21.5)
}

const DEFAULT_SETTINGS: Settings = {
  bufferCapacity: 10000,
  theme: 'system',
  welcomeSeen: false,
  completedChallenges: [],
  reducedMotion: false
}

/**
 * SettingsStore manages persistent user settings.
 * Singleton pattern — call init() once during app startup.
 */
export class SettingsStore extends EventEmitter {
  private settings: Settings
  private filePath: string

  constructor(userDataPath: string) {
    super()
    this.filePath = path.join(userDataPath, 'settings.json')
    this.settings = this.load()
  }

  /**
   * Load settings from disk. If file is missing or corrupt, reset to defaults.
   * Requirement: Req 20.2 — handle missing/corrupt file gracefully.
   */
  private load(): Settings {
    try {
      if (!fs.existsSync(this.filePath)) {
        Logger.info('SettingsStore', 'Settings file not found, using defaults')
        return { ...DEFAULT_SETTINGS }
      }

      const raw = fs.readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw)

      // Validate and merge with defaults to handle missing fields
      const settings: Settings = {
        bufferCapacity: this.validateBufferCapacity(parsed.bufferCapacity),
        theme: this.validateTheme(parsed.theme),
        welcomeSeen: typeof parsed.welcomeSeen === 'boolean' ? parsed.welcomeSeen : false,
        completedChallenges: Array.isArray(parsed.completedChallenges)
          ? parsed.completedChallenges.filter((x: unknown) => typeof x === 'string')
          : [],
        reducedMotion: typeof parsed.reducedMotion === 'boolean' ? parsed.reducedMotion : false
      }

      Logger.info('SettingsStore', 'Settings loaded successfully')
      return settings
    } catch (err) {
      Logger.warn('SettingsStore', 'Failed to load settings, using defaults', {
        error: err instanceof Error ? err.message : String(err)
      })
      return { ...DEFAULT_SETTINGS }
    }
  }

  /**
   * Write current settings to disk.
   * Requirement: Req 20.2 — persist settings on mutation.
   */
  private save(): void {
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf-8')
      Logger.debug('SettingsStore', 'Settings saved successfully')
    } catch (err) {
      Logger.error('SettingsStore', 'Failed to save settings', {
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  /**
   * Get current settings (read-only copy).
   */
  get(): Settings {
    return { ...this.settings }
  }

  /**
   * Update settings with a partial patch. Validates all fields.
   * Emits 'change' event after successful update.
   * Requirement: Req 20.2 — write on mutation, emit change event.
   */
  set(patch: Partial<Settings>): void {
    let changed = false

    if (patch.bufferCapacity !== undefined) {
      const validated = this.validateBufferCapacity(patch.bufferCapacity)
      if (validated !== this.settings.bufferCapacity) {
        this.settings.bufferCapacity = validated
        changed = true
      }
    }

    if (patch.theme !== undefined) {
      const validated = this.validateTheme(patch.theme)
      if (validated !== this.settings.theme) {
        this.settings.theme = validated
        changed = true
      }
    }

    if (patch.welcomeSeen !== undefined && typeof patch.welcomeSeen === 'boolean') {
      if (patch.welcomeSeen !== this.settings.welcomeSeen) {
        this.settings.welcomeSeen = patch.welcomeSeen
        changed = true
      }
    }

    if (patch.completedChallenges !== undefined && Array.isArray(patch.completedChallenges)) {
      const validated = patch.completedChallenges.filter((x: unknown) => typeof x === 'string')
      if (JSON.stringify(validated) !== JSON.stringify(this.settings.completedChallenges)) {
        this.settings.completedChallenges = validated
        changed = true
      }
    }

    if (patch.reducedMotion !== undefined && typeof patch.reducedMotion === 'boolean') {
      if (patch.reducedMotion !== this.settings.reducedMotion) {
        this.settings.reducedMotion = patch.reducedMotion
        changed = true
      }
    }

    if (changed) {
      this.save()
      this.emit('change', this.get())
      Logger.debug('SettingsStore', 'Settings updated', {
        fields: Object.keys(patch).join(', ')
      })
    }
  }

  /**
   * Validate bufferCapacity: must be in range [1000, 100000].
   * Requirement: Req 12.1
   */
  private validateBufferCapacity(value: unknown): number {
    if (typeof value !== 'number' || isNaN(value)) {
      return DEFAULT_SETTINGS.bufferCapacity
    }
    return Math.max(1000, Math.min(100000, Math.floor(value)))
  }

  /**
   * Validate theme: must be 'light', 'dark', or 'system'.
   * Requirement: Req 18.3
   */
  private validateTheme(value: unknown): 'light' | 'dark' | 'system' {
    if (value === 'light' || value === 'dark' || value === 'system') {
      return value
    }
    return DEFAULT_SETTINGS.theme
  }
}

// Singleton instance — initialized in main/index.ts after app.whenReady()
let _store: SettingsStore | null = null

/**
 * Initialize the settings store. Must be called once during app startup
 * after app.getPath('userData') is available.
 */
export function initSettingsStore(userDataPath: string): void {
  if (_store) {
    Logger.warn('SettingsStore', 'initSettingsStore called multiple times, ignoring')
    return
  }
  _store = new SettingsStore(userDataPath)
  Logger.info('SettingsStore', 'Settings store initialized')
}

/**
 * Get the singleton settings store instance.
 * Throws if called before initSettingsStore().
 */
export function getSettingsStore(): SettingsStore {
  if (!_store) {
    throw new Error('SettingsStore not initialized. Call initSettingsStore() first.')
  }
  return _store
}
