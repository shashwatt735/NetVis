import { EventEmitter } from 'events'
import type { AnonPacket } from '../../shared/capture-types'

/**
 * Ring buffer for AnonPacket objects.
 * Fixed-size circular array with head/tail pointers.
 * Emits 'change' on every push and 'overflow' when oldest packet is dropped.
 */
export class PacketBuffer extends EventEmitter {
  private readonly buf: (AnonPacket | undefined)[]
  private head = 0 // points to next write slot
  private _size = 0

  constructor(private readonly _capacity: number) {
    super()
    if (_capacity < 1 || !Number.isInteger(_capacity)) {
      throw new RangeError(`capacity must be a positive integer, got ${_capacity}`)
    }
    this.buf = new Array(_capacity).fill(undefined)
  }

  push(packet: AnonPacket): void {
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

  getAll(): AnonPacket[] {
    if (this._size === 0) return []
    const tail = (this.head - this._size + this._capacity) % this._capacity
    const result: AnonPacket[] = []
    for (let i = 0; i < this._size; i++) {
      result.push(this.buf[(tail + i) % this._capacity]!)
    }
    return result
  }

  getRange(start: number, end: number): AnonPacket[] {
    return this.getAll().slice(start, end)
  }

  clear(): void {
    this.buf.fill(undefined)
    this.head = 0
    this._size = 0
    this.emit('change')
  }

  get size(): number {
    return this._size
  }

  get capacity(): number {
    return this._capacity
  }
}
