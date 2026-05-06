import type React from 'react'
import { CircleDot, X } from 'lucide-react'
import { getChallengeById } from '../data/challenges'
import { useNetVisStore } from '../store'
import { PacketDetailInspector } from './PacketDetailInspector'
import { PacketFlowTimeline } from './PacketFlowTimeline'
import { PacketList } from './PacketList'
import { ProtocolChart } from './ProtocolChart'
import { Button } from './ui/button'

function BentoPanel({
  label,
  framing,
  children
}: {
  label: string
  framing: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section
      aria-label={label}
      style={{
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: 'var(--nv-bg-surface-1)',
        border: '1px solid var(--nv-border-subtle)',
        borderRadius: 'var(--nv-radius-lg)',
        boxShadow: 'var(--nv-shadow-sm)'
      }}
    >
      <div
        style={{
          height: 34,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '0 12px',
          backgroundColor: 'var(--nv-panel-header-bg)',
          borderBottom: '1px solid var(--nv-border-subtle)'
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 650,
            color: 'var(--nv-text-primary)'
          }}
        >
          {titleCase(label)}
        </span>
        <span
          style={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 11,
            fontStyle: 'italic',
            color: 'var(--nv-text-tertiary)'
          }}
        >
          {framing}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{children}</div>
    </section>
  )
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

function ChallengeBanner(): React.JSX.Element | null {
  const activeChallengeId = useNetVisStore((s) => s.activeChallengeId)
  const activateChallenge = useNetVisStore((s) => s.activateChallenge)
  const challenge = activeChallengeId ? getChallengeById(activeChallengeId) : undefined

  if (!challenge) return null
  const challengeTitle = titleCase(challenge.title)

  return (
    <div
      role="status"
      aria-label={`Challenge Active: ${challengeTitle}`}
      style={{
        minHeight: 34,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 12px',
        border: '1px solid var(--proto-dns-border)',
        borderRadius: 'var(--nv-radius-lg)',
        backgroundColor: 'var(--proto-dns-dim)',
        color: 'var(--nv-text-primary)',
        flexShrink: 0
      }}
    >
      <CircleDot size={14} aria-hidden style={{ color: 'var(--proto-dns)', flexShrink: 0 }} />
      <span
        style={{
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 13
        }}
      >
        Challenge Active: {challengeTitle}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => activateChallenge(null)}
        aria-label="Exit challenge"
        style={{ marginLeft: 'auto', width: 28, height: 28, padding: 0 }}
      >
        <X size={14} aria-hidden />
      </Button>
    </div>
  )
}

export function CapturePage(): React.JSX.Element {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: 'minmax(520px, 1fr) minmax(300px, 28%)',
        gridTemplateRows: 'minmax(0, 1fr) minmax(176px, 30%)',
        gap: 10,
        padding: 10,
        overflow: 'hidden',
        backgroundColor: 'var(--nv-bg-base)'
      }}
    >
      <div
        style={{
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          overflow: 'hidden'
        }}
      >
        <ChallengeBanner />
        <BentoPanel label="packets" framing="what happened, in order?">
          <PacketList />
        </BentoPanel>
      </div>

      <section
        aria-label="inspector"
        style={{
          gridColumn: '2',
          gridRow: '1 / span 2',
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          overflow: 'hidden',
          backgroundColor: 'var(--nv-bg-surface-1)',
          border: '1px solid var(--nv-border-subtle)',
          borderRadius: 'var(--nv-radius-lg)',
          boxShadow: 'var(--nv-shadow-sm)'
        }}
      >
        <PacketDetailInspector />
      </section>

      <div
        style={{
          minWidth: 0,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 1fr) minmax(320px, 1.15fr)',
          gap: 10,
          overflow: 'hidden'
        }}
      >
        <BentoPanel label="protocols" framing="click to filter">
          <ProtocolChart />
        </BentoPanel>
        <BentoPanel label="timeline" framing="when did traffic happen?">
          <PacketFlowTimeline />
        </BentoPanel>
      </div>
    </div>
  )
}
