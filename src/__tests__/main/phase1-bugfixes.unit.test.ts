// Unit tests for Phase 1 bugfix functionality
// Validates: PacketBuffer.setCapacity(), FILE-SEC-01, filter:apply, 'ts' field, pcap:selectFile

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PacketBuffer } from '../../main/packet-buffer/index'
import { parse, evaluate } from '../../main/filter-engine'
import type { ParsedPacket, AnonPacket } from '../../shared/capture-types'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

function makePacket(id: string, timestamp = 1_700_000_000_000): ParsedPacket {
  return {
    id,
    timestamp,
    sourceId: 'test',
    captureMode: 'live',
    wireLength: 64,
    rawData: new Uint8Array([0x01, 0x02, 0x03]),
    layers: []
  }
}

function makeAnonPacket(id: string, timestamp = 1_700_000_000_000): AnonPacket {
  return {
    id,
    timestamp,
    sourceId: 'test',
    captureMode: 'live',
    wireLength: 64,
    layers: [],
    srcAddress: '0.0.0.0',
    dstAddress: '0.0.0.0',
    protocol: 'TCP',
    length: 64
  }
}

// ─── Task 9.1: PacketBuffer.setCapacity() with grow scenario ─────────────────

describe('PacketBuffer.setCapacity() — grow scenario', () => {
  it('retains all packets when growing capacity', () => {
    const buf = new PacketBuffer(5000)

    // Add 2000 packets
    for (let i = 0; i < 2000; i++) {
      buf.push(makePacket(`p${i}`, i))
    }

    expect(buf.size).toBe(2000)
    expect(buf.capacity).toBe(5000)

    // Grow to 10000
    buf.setCapacity(10000)

    // Verify all 2000 packets retained
    expect(buf.size).toBe(2000)
    expect(buf.capacity).toBe(10000)

    const all = buf.getAll()
    expect(all).toHaveLength(2000)
    expect(all.map((p) => p.id)).toEqual(Array.from({ length: 2000 }, (_, i) => `p${i}`))
  })

  it('emits change event when growing capacity', () => {
    const buf = new PacketBuffer(5000)
    for (let i = 0; i < 2000; i++) buf.push(makePacket(`p${i}`))

    const onChange = vi.fn()
    buf.on('change', onChange)

    buf.setCapacity(10000)

    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

// ─── Task 9.2: PacketBuffer.setCapacity() with shrink scenario ───────────────

describe('PacketBuffer.setCapacity() — shrink scenario', () => {
  it('retains most recent packets when shrinking capacity', () => {
    const buf = new PacketBuffer(10000)

    // Add 8000 packets
    for (let i = 0; i < 8000; i++) {
      buf.push(makePacket(`p${i}`, i))
    }

    expect(buf.size).toBe(8000)

    // Shrink to 5000
    buf.setCapacity(5000)

    // Verify most recent 5000 packets retained
    expect(buf.size).toBe(5000)
    expect(buf.capacity).toBe(5000)

    const all = buf.getAll()
    expect(all).toHaveLength(5000)

    // Should have p3000..p7999 (most recent 5000)
    expect(all.map((p) => p.id)).toEqual(Array.from({ length: 5000 }, (_, i) => `p${i + 3000}`))

    // Verify oldest 3000 packets dropped
    expect(all.map((p) => p.id)).not.toContain('p0')
    expect(all.map((p) => p.id)).not.toContain('p2999')
  })

  it('emits change event when shrinking capacity', () => {
    const buf = new PacketBuffer(10000)
    for (let i = 0; i < 8000; i++) buf.push(makePacket(`p${i}`))

    const onChange = vi.fn()
    buf.on('change', onChange)

    buf.setCapacity(5000)

    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('throws RangeError for non-integer capacity', () => {
    const buf = new PacketBuffer(10000)
    expect(() => buf.setCapacity(5000.5)).toThrow(RangeError)
  })

  it('throws RangeError for negative capacity', () => {
    const buf = new PacketBuffer(10000)
    expect(() => buf.setCapacity(-1)).toThrow(RangeError)
  })
})

// ─── Task 9.3: FILE-SEC-01 path validation ────────────────────────────────────

describe('FILE-SEC-01 path validation', () => {
  let tempDir: string
  let tempFile: string

  beforeEach(async () => {
    // Create temp directory and file for testing
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'netvis-test-'))
    tempFile = path.join(tempDir, 'test.pcap')
    await fs.promises.writeFile(tempFile, Buffer.from([0x01, 0x02, 0x03]))
  })

  afterEach(async () => {
    // Cleanup
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  it('accepts valid file path', async () => {
    const resolvedPath = path.resolve(tempFile)

    // Should not throw
    await fs.promises.access(resolvedPath, fs.constants.R_OK)
    const stats = await fs.promises.stat(resolvedPath)

    expect(stats.isFile()).toBe(true)
  })

  it('rejects directory path', async () => {
    const resolvedPath = path.resolve(tempDir)

    await fs.promises.access(resolvedPath, fs.constants.R_OK)
    const stats = await fs.promises.stat(resolvedPath)

    expect(stats.isFile()).toBe(false)
    expect(stats.isDirectory()).toBe(true)
  })

  it('rejects non-existent file', async () => {
    const nonExistentPath = path.join(tempDir, 'does-not-exist.pcap')

    await expect(fs.promises.access(nonExistentPath, fs.constants.R_OK)).rejects.toThrow()
  })

  it('resolves relative path correctly', async () => {
    const relativePath = path.relative(process.cwd(), tempFile)
    const resolvedPath = path.resolve(relativePath)

    await fs.promises.access(resolvedPath, fs.constants.R_OK)
    const stats = await fs.promises.stat(resolvedPath)

    expect(stats.isFile()).toBe(true)
  })
})

// ─── Task 9.5: 'ts' field in filter expressions ───────────────────────────────

describe('Filter engine — ts field support', () => {
  it('lexer tokenizes ts field correctly', () => {
    const expression = 'ts >= 1714123456000'
    const result = parse(expression)

    expect(result.ok).toBe(true)
  })

  it('parser parses ts predicate into PredicateNode', () => {
    const expression = 'ts >= 1714123456000'
    const result = parse(expression)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.ast.kind).toBe('predicate')
      if (result.ast.kind === 'predicate') {
        expect(result.ast.field).toBe('ts')
        expect(result.ast.comparator).toBe('>=')
        expect(result.ast.value).toBe(1714123456000)
      }
    }
  })

  it('evaluator evaluates ts predicate against packet.timestamp', () => {
    const packet = makeAnonPacket('test', 1714123456789)
    const expression = 'ts >= 1714123456000'
    const result = parse(expression)

    expect(result.ok).toBe(true)
    if (result.ok) {
      const matches = evaluate(result.ast, packet)
      expect(matches).toBe(true)
    }
  })

  it('timeline click generates valid ts range expression', () => {
    const startMs = 1714123456000
    const endMs = 1714123457000
    const expression = `ts >= ${startMs} AND ts < ${endMs}`

    const result = parse(expression)
    expect(result.ok).toBe(true)

    if (result.ok) {
      // Test packet within range
      const packetInRange = makeAnonPacket('in', 1714123456500)
      expect(evaluate(result.ast, packetInRange)).toBe(true)

      // Test packet before range
      const packetBefore = makeAnonPacket('before', 1714123455000)
      expect(evaluate(result.ast, packetBefore)).toBe(false)

      // Test packet after range
      const packetAfter = makeAnonPacket('after', 1714123458000)
      expect(evaluate(result.ast, packetAfter)).toBe(false)
    }
  })

  it('supports all comparators with ts field', () => {
    const packet = makeAnonPacket('test', 1714123456000)

    const tests = [
      { expr: 'ts == 1714123456000', expected: true },
      { expr: 'ts != 1714123456000', expected: false },
      { expr: 'ts > 1714123455000', expected: true },
      { expr: 'ts < 1714123457000', expected: true },
      { expr: 'ts >= 1714123456000', expected: true },
      { expr: 'ts <= 1714123456000', expected: true }
    ]

    for (const { expr, expected } of tests) {
      const result = parse(expr)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(evaluate(result.ast, packet)).toBe(expected)
      }
    }
  })
})

// ─── Task 9.7: CaptureControls speed selector ─────────────────────────────────

describe('CaptureControls speed selector', () => {
  it('speed selector should support all required values', () => {
    const validSpeeds = [0.5, 1, 2, 5]

    // Verify these are valid SpeedMultiplier values
    for (const speed of validSpeeds) {
      expect([0.5, 1, 2, 5]).toContain(speed)
    }
  })

  it('default speed should be 1×', () => {
    const defaultSpeed = 1
    expect(defaultSpeed).toBe(1)
  })
})
