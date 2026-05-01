import { CheckCircle, X } from 'lucide-react'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getChallengeById } from '../data/challenges'
import { useNetVisStore } from '../store'
import { Button } from './ui/button'

export function ChallengePanel(): React.JSX.Element | null {
  const activeChallengeId = useNetVisStore((s) => s.activeChallengeId)
  const completedChallengeIds = useNetVisStore((s) => s.completedChallengeIds)
  const filteredPackets = useNetVisStore((s) => s.filteredPackets)
  const selectedPacketId = useNetVisStore((s) => s.selectedPacketId)
  const filterExpression = useNetVisStore((s) => s.filterExpression)
  const activateChallenge = useNetVisStore((s) => s.activateChallenge)
  const setCompletedChallenges = useNetVisStore((s) => s.setCompletedChallenges)
  const [hintOpen, setHintOpen] = useState(false)
  const completionInFlight = useRef(false)

  const challenge = activeChallengeId ? getChallengeById(activeChallengeId) : undefined
  const isCompleted = challenge ? completedChallengeIds.includes(challenge.id) : false

  useEffect(() => {
    completionInFlight.current = false
    setHintOpen(false)
  }, [activeChallengeId])

  useEffect(() => {
    if (!challenge || isCompleted || completionInFlight.current) return

    const selectedPacket = selectedPacketId
      ? (filteredPackets.find((packet) => packet.id === selectedPacketId) ?? null)
      : null

    if (!challenge.successCriteria(filteredPackets, filterExpression, selectedPacket)) return

    const timeout = window.setTimeout(() => {
      const current = useNetVisStore.getState()
      if (current.completedChallengeIds.includes(challenge.id) || completionInFlight.current) return

      const nextCompleted = [...current.completedChallengeIds, challenge.id]
      completionInFlight.current = true

      void window.electronAPI?.setSettings?.({ completedChallenges: nextCompleted })
        .then(() => {
          setCompletedChallenges(nextCompleted)
          activateChallenge(null)
          toast.success('Challenge complete')
        })
        .catch((error: unknown) => {
          completionInFlight.current = false
          console.error('Failed to persist challenge completion', error)
        })
    }, 500)

    return () => window.clearTimeout(timeout)
  }, [
    activateChallenge,
    challenge,
    filterExpression,
    filteredPackets,
    isCompleted,
    selectedPacketId,
    setCompletedChallenges
  ])

  if (!challenge) return null

  return (
    <aside
      aria-label="Active challenge"
      style={{
        padding: 16,
        border: '1px solid var(--nv-border-subtle)',
        borderRadius: 'var(--nv-radius-lg)',
        backgroundColor: 'var(--nv-bg-surface-1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16, color: 'var(--nv-text-primary)' }}>
            {challenge.title}
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--nv-text-secondary)' }}>
            {challenge.goal}
          </p>
        </div>
        {isCompleted && <CheckCircle aria-label="Completed" size={18} />}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Close challenge"
          onClick={() => activateChallenge(null)}
          style={{ width: 28, height: 28, padding: 0 }}
        >
          <X size={14} aria-hidden />
        </Button>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={hintOpen}
        onClick={() => setHintOpen((open) => !open)}
        style={{ alignSelf: 'flex-start' }}
      >
        {hintOpen ? 'Hide Hint' : 'Show Hint'}
      </Button>
      {hintOpen && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--nv-text-secondary)' }}>
          {challenge.hint}
        </p>
      )}
    </aside>
  )
}
