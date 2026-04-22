// Bug E fix — PacketBuffer.setCapacity() property tests
// Property 6: Validates: Requirements 2.8, 3.2
// Property 7: Validates: Requirements 2.9, 3.1

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { PacketBuffer } from '../../main/packet-buffer/index'

describe('Bug E fix — PacketBuffer.setCapacity() property tests', () => {
  /**
   * Property 6 (fix checking): for any integer n in [1, 999],
   * setCapacity(n) must NOT throw — consistent with constructor behaviour.
   *
   * **Validates: Requirements 2.8, 3.2**
   */
  it('P6: setCapacity(n) does not throw for any integer in [1, 999]', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999 }), (n) => {
        const buf = new PacketBuffer(10000)
        expect(() => buf.setCapacity(n)).not.toThrow()
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Property 7 (preservation): for any integer n in [1000, 100000],
   * setCapacity(n) must succeed — unchanged behaviour after the fix.
   *
   * **Validates: Requirements 2.9, 3.1**
   */
  it('P7: setCapacity(n) succeeds for any integer in [1000, 100000] (preservation)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1000, max: 100000 }), (n) => {
        const buf = new PacketBuffer(10000)
        expect(() => buf.setCapacity(n)).not.toThrow()
      }),
      { numRuns: 25 }
    )
  })

  /**
   * Preservation of invalid inputs: n <= 0 or non-integer must still throw RangeError.
   */
  it('setCapacity(0), setCapacity(-1), and setCapacity(1.5) still throw RangeError', () => {
    const buf = new PacketBuffer(10000)
    expect(() => buf.setCapacity(0)).toThrow(RangeError)
    expect(() => buf.setCapacity(-1)).toThrow(RangeError)
    expect(() => buf.setCapacity(1.5)).toThrow(RangeError)
  })
})
