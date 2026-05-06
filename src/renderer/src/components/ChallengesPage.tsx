import { ArrowRight, CheckCircle, Clock } from 'lucide-react'
import type React from 'react'
import { getListedChallenges, type Challenge, type ChallengeDifficulty } from '../data/challenges'
import { PROTOCOL_COLORS, protocolColorKey } from '../constants/protocol-colors'
import { useNetVisStore } from '../store'
import { Button } from './ui/button'

const DIFFICULTY_LABELS: Record<ChallengeDifficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate'
}

function titleCase(text: string): string {
  return text
    .split(' ')
    .map((word) => (word.length > 0 ? `${word[0]!.toUpperCase()}${word.slice(1)}` : word))
    .join(' ')
    .replace(/\bDns\b/g, 'DNS')
    .replace(/\bTcp\b/g, 'TCP')
    .replace(/\bUdp\b/g, 'UDP')
    .replace(/\bIcmp\b/g, 'ICMP')
    .replace(/\bArp\b/g, 'ARP')
}

function protocolToken(challenge: Challenge): { color: string; dim: string; border: string } {
  return PROTOCOL_COLORS[
    protocolColorKey(challenge.protocol === 'ANY' ? 'OTHER' : challenge.protocol)
  ]
}

function ChallengeCard({
  challenge,
  isActive,
  isCompleted,
  onStart
}: {
  challenge: Challenge
  isActive: boolean
  isCompleted: boolean
  onStart: (challenge: Challenge) => void
}): React.JSX.Element {
  const token = protocolToken(challenge)

  return (
    <article
      style={{
        height: '100%',
        minHeight: 240,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 18,
        border: isCompleted
          ? '2px solid var(--nv-status-success)'
          : `1px solid ${isActive ? token.color : 'var(--nv-border-subtle)'}`,
        borderRadius: 'var(--nv-radius-lg)',
        backgroundColor: isActive
          ? token.dim
          : isCompleted
            ? 'color-mix(in srgb, var(--nv-status-success) 10%, transparent)'
            : 'var(--nv-bg-surface-1)',
        boxShadow: 'var(--nv-shadow-sm)',
        transition:
          'transform var(--nv-duration-fast) var(--nv-ease-enter), box-shadow var(--nv-duration-fast) var(--nv-ease-enter), border-color var(--nv-duration-fast) var(--nv-ease-enter)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = 'var(--nv-shadow-md)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'var(--nv-shadow-sm)'
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <span
            style={{
              minHeight: 22,
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0 8px',
              borderRadius: 'var(--nv-radius-sm)',
              border: '1px solid var(--nv-border-subtle)',
              color: 'var(--nv-text-secondary)',
              fontSize: 11
            }}
          >
            {DIFFICULTY_LABELS[challenge.difficulty]}
          </span>
          <span
            style={{
              minHeight: 22,
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0 8px',
              borderRadius: 'var(--nv-radius-sm)',
              border: `1px solid ${token.border}`,
              color: token.color,
              backgroundColor: token.dim,
              fontFamily: 'var(--font-data)',
              fontSize: 11
            }}
          >
            {challenge.protocol === 'ANY' ? 'Any' : challenge.protocol}
          </span>
        </div>
        {isCompleted && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 'var(--nv-radius-sm)',
              backgroundColor: 'color-mix(in srgb, var(--nv-status-success) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--nv-status-success) 30%, transparent)',
              color: 'var(--nv-status-success)',
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0
            }}
          >
            <CheckCircle size={12} aria-hidden />
            Completed
          </span>
        )}
      </div>

      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--nv-text-primary)', lineHeight: 1.3 }}>
        {titleCase(challenge.title)}
      </h2>
      <p
        style={{
          margin: 0,
          flex: 1,
          color: 'var(--nv-text-secondary)',
          fontSize: 13,
          lineHeight: 1.55
        }}
      >
        {challenge.goal.charAt(0).toUpperCase() + challenge.goal.slice(1)}
      </p>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--nv-text-tertiary)',
          fontSize: 12
        }}
      >
        <Clock size={13} aria-hidden />
        Estimated: {challenge.estimatedMinutes} min
      </div>

      <Button
        size="sm"
        variant={isActive ? 'default' : 'outline'}
        onClick={() => onStart(challenge)}
        style={{ justifyContent: 'center' }}
      >
        {isActive ? 'Return to Capture' : 'Start Challenge'}
        <ArrowRight size={14} aria-hidden />
      </Button>
    </article>
  )
}

function ChallengeProgressHeader({
  title,
  completed,
  total
}: {
  title: string
  completed: number
  total: number
}): React.JSX.Element {
  const percent = total > 0 ? (completed / total) * 100 : 0
  const label = title.charAt(0).toUpperCase() + title.slice(1)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 14
      }}
    >
      <h2
        style={{
          margin: 0,
          minWidth: 96,
          fontSize: 16,
          fontWeight: 650,
          color: 'var(--nv-text-primary)'
        }}
      >
        {label}
      </h2>
      <div
        role="progressbar"
        aria-label={`${label} challenge progress`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={completed}
        style={{
          flex: 1,
          height: 4,
          minWidth: 80,
          borderRadius: 999,
          backgroundColor: 'var(--nv-bg-surface-3)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: '100%',
            borderRadius: 999,
            backgroundColor: 'var(--nv-status-success)',
            transition: 'width var(--nv-duration-fast) var(--nv-ease-enter)'
          }}
        />
      </div>
      <span
        style={{
          minWidth: 44,
          color: 'var(--nv-text-secondary)',
          fontFamily: 'var(--font-data)',
          fontSize: 12,
          textAlign: 'right'
        }}
      >
        {completed} / {total}
      </span>
    </div>
  )
}

export function ChallengesPage(): React.JSX.Element {
  const activeChallengeId = useNetVisStore((s) => s.activeChallengeId)
  const completedChallengeIds = useNetVisStore((s) => s.completedChallengeIds)
  const activateChallenge = useNetVisStore((s) => s.activateChallenge)
  const setActivePage = useNetVisStore((s) => s.setActivePage)
  const setFilter = useNetVisStore((s) => s.setFilter)
  const previousPage = useNetVisStore((s) => s.previousPage)
  const goBack = useNetVisStore((s) => s.goBack)

  const challenges = getListedChallenges()
  const beginner = challenges.filter((challenge) => challenge.difficulty === 'beginner')
  const intermediate = challenges.filter((challenge) => challenge.difficulty === 'intermediate')

  const startChallenge = (challenge: Challenge): void => {
    activateChallenge(challenge.id)
    setFilter(challenge.initialFilter)
    setActivePage('capture')
  }

  return (
    <section
      aria-label="Challenges"
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '28px 34px',
        backgroundColor: 'var(--nv-bg-base)'
      }}
    >
      <div style={{ maxWidth: 1180 }}>
        {previousPage && (
          <button
            type="button"
            onClick={goBack}
            className="nv-focus"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 14,
              background: 'none',
              border: '1px solid var(--nv-border-subtle)',
              borderRadius: 'var(--nv-radius-md)',
              padding: '6px 10px',
              cursor: 'pointer',
              color: 'var(--nv-text-secondary)',
              fontFamily: 'var(--font-ui)',
              fontSize: 12,
              fontWeight: 500,
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--nv-border-default)'
              e.currentTarget.style.backgroundColor = 'var(--nv-bg-surface-2)'
              e.currentTarget.style.color = 'var(--nv-text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--nv-border-subtle)'
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'var(--nv-text-secondary)'
            }}
          >
            ← Back
          </button>
        )}
        <p style={{ margin: 0, color: 'var(--nv-text-tertiary)', fontSize: 12 }}>Challenges</p>
        <h1
          style={{
            margin: '4px 0 8px',
            fontSize: 28,
            color: 'var(--nv-text-primary)',
            fontWeight: 600
          }}
        >
          Practice with Real Packets
        </h1>
        <p
          style={{
            margin: '0 0 24px',
            maxWidth: 650,
            color: 'var(--nv-text-secondary)',
            fontSize: 14,
            fontWeight: 600,
            lineHeight: 1.6
          }}
        >
          Choose a small exercise, then prove it in Capture. Track your progress as you learn. No
          points, no streaks, just honest progress.
        </p>

        {[
          { title: 'beginner', items: beginner },
          { title: 'intermediate', items: intermediate }
        ].map((section) => (
          <section key={section.title} style={{ marginBottom: 32 }}>
            <ChallengeProgressHeader
              title={section.title}
              total={section.items.length}
              completed={
                section.items.filter((challenge) => completedChallengeIds.includes(challenge.id))
                  .length
              }
            />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 18,
                alignItems: 'stretch'
              }}
            >
              {section.items.map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  isActive={activeChallengeId === challenge.id}
                  isCompleted={completedChallengeIds.includes(challenge.id)}
                  onStart={startChallenge}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}
