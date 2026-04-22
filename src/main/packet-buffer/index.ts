import { EventEmitter } from 'events'
import type { ParsedPacket } from '../../shared/capture-types'

/**
 * Ring buffer for ParsedPacket objects (NOT anonymized).
 * Fixed-size circular array with head/tail pointers.
 * Emits 'change' on every push and 'overflow' when oldest packet is dropped.
 *
 * ARCH-04: Buffer stores ParsedPacket with rawData intact. Anonymization
 * happens only when packets cross the IPC boundary to the renderer.
 */
export class PacketBuffer extends EventEmitter {
  private buf: (ParsedPacket | undefined)[]
  private head = 0 // points to next write slot
  private _size = 0
  private _capacity: number

  constructor(capacity: number) {
    super()
    if (capacity < 1 || !Number.isInteger(capacity)) {
      throw new RangeError(`capacity must be a positive integer, got ${capacity}`)
    }
    this._capacity = capacity
    this.buf = new Array(capacity).fill(undefined)
  }

  push(packet: ParsedPacket): void {
    if (this._size === this._capacity) {
      // overflow: oldest packet (at head) is about to be overwritten
      this.emit('overflow', 1)
    } else {
      this._size++
    }
    this.buf[this.head] = packet
    this.head = (this.head + 1) % this._capacity
    this.emit('change')
  }

  getAll(): ParsedPacket[] {
    if (this._size === 0) return []
    const tail = (this.head - this._size + this._capacity) % this._capacity
    const result: ParsedPacket[] = []
    for (let i = 0; i < this._size; i++) {
      result.push(this.buf[(tail + i) % this._capacity]!)
    }
    return result
  }

  getRange(start: number, end: number): ParsedPacket[] {
    return this.getAll().slice(start, end)
  }

  clear(): void {
    this.buf.fill(undefined)
    this.head = 0
    this._size = 0
    this.emit('change')
  }

  /**
   * Resize the buffer capacity in-place.
   * If shrinking (newCapacity < current size), keeps the most recent packets.
   * If growing, migrates all existing packets.
   * Emits 'change' event after resize.
   */
  setCapacity(newCapacity: number): void {
    if (newCapacity < 1 || !Number.isInteger(newCapacity)) {
      throw new RangeError(`capacity must be a positive integer, got ${newCapacity}`)
    }

    // Get existing packets in chronological order
    const existing = this.getAll()

    // Determine which packets to migrate
    const toMigrate =
      existing.length > newCapacity
        ? existing.slice(existing.length - newCapacity) // Keep most recent if shrinking
        : existing

    // Create new buffer array and update capacity
    this.buf = new Array<ParsedPacket | undefined>(newCapacity).fill(undefined)
    this._capacity = newCapacity

    // Copy packets into new buffer
    for (let i = 0; i < toMigrate.length; i++) {
      this.buf[i] = toMigrate[i]
    }

    // Reset head pointer and size
    this.head = toMigrate.length
    this._size = toMigrate.length

    this.emit('change')
  }

  get size(): number {
    return this._size
  }

  get capacity(): number {
    return this._capacity
  }
}

// ─── Singleton accessor (mirrors SettingsStore pattern) ───────────────────────

let _buffer: PacketBuffer | null = null

/**
 * Initialize the singleton PacketBuffer. Called once in main/index.ts.
 */
export function initPacketBuffer(capacity: number): PacketBuffer {
  _buffer = new PacketBuffer(capacity)
  return _buffer
}

/**
 * Get the singleton PacketBuffer instance.
 * Throws if called before initPacketBuffer().
 */
export function getPacketBuffer(): PacketBuffer {
  if (!_buffer) {
    throw new Error('PacketBuffer not initialized. Call initPacketBuffer() first.')
  }
  return _buffer
}
