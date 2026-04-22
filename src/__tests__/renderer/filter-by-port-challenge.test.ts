// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { getChallengeById } from '../../renderer/src/data/challenges'
import { makeAnonPacket } from './test-utils'

describe('Filter by Port challenge', () => {
  const challenge = getChallengeById('filter-by-port')

  it('completes when an explicit port filter is applied and returns packets', () => {
    expect(challenge?.successCriteria([makeAnonPacket({ protocol: 'TCP' })], 'port == 80')).toBe(
      true
    )
  })

  it('does not complete without an explicit port filter', () => {
    expect(
      challenge?.successCriteria(
        [makeAnonPacket({ protocol: 'TCP' }), makeAnonPacket({ protocol: 'UDP' })],
        undefined
      )
    ).toBe(false)
  })

  it('does not complete for TCP/UDP-only packets when no port filter was used', () => {
    expect(
      challenge?.successCriteria(
        [makeAnonPacket({ protocol: 'TCP' }), makeAnonPacket({ protocol: 'UDP' })],
        'tcp'
      )
    ).toBe(false)
  })

  it('does not complete for an explicit port filter that returns no packets', () => {
    expect(challenge?.successCriteria([], 'port == 443')).toBe(false)
  })
})
