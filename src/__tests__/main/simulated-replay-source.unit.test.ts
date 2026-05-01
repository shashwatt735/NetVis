import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { RawPacket } from '../../shared/capture-types'
import { SimulatedReplaySource } from '../../main/capture/simulated-replay-source'

function makeTinyPcap(frame: Buffer): Buffer {
  const globalHeader = Buffer.allocUnsafe(24)
  globalHeader.writeUInt32LE(0xa1b2c3d4, 0)
  globalHeader.writeUInt16LE(2, 4)
  globalHeader.writeUInt16LE(4, 6)
  globalHeader.writeInt32LE(0, 8)
  globalHeader.writeUInt32LE(0, 12)
  globalHeader.writeUInt32LE(65535, 16)
  globalHeader.writeUInt32LE(1, 20)

  const packetHeader = Buffer.allocUnsafe(16)
  packetHeader.writeUInt32LE(1, 0)
  packetHeader.writeUInt32LE(0, 4)
  packetHeader.writeUInt32LE(frame.length, 8)
  packetHeader.writeUInt32LE(frame.length, 12)

  return Buffer.concat([globalHeader, packetHeader, frame])
}

describe('SimulatedReplaySource', () => {
  let tempDir: string
  let filePath: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'netvis-replay-'))
    filePath = path.join(tempDir, 'sample.pcap')
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('replays packets from pcap-parser without requiring parser pause/resume APIs', async () => {
    const frame = Buffer.from([
      0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
      0x00, 0x11, 0x22, 0x33, 0x44, 0x55,
      0x08, 0x00
    ])
    fs.writeFileSync(filePath, makeTinyPcap(frame))

    const source = new SimulatedReplaySource(filePath, 5)
    const packetPromise = new Promise<RawPacket>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Timed out waiting for replay packet'))
      }, 2000)

      source.onPacket((packet) => {
        clearTimeout(timeoutId)
        resolve(packet)
      })
      source.onError((error) => {
        clearTimeout(timeoutId)
        reject(error)
      })
    })

    await source.start()
    const packet = await packetPromise

    expect(packet).toMatchObject({
      sourceId: 'sample.pcap',
      captureMode: 'file',
      timestamp: 1000,
      length: frame.length,
      linkType: 1
    })
    expect(Buffer.from(packet.data)).toEqual(frame)

    await source.stop()
  })
})
