import { ArrowRight, BookOpen, Database, Play, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type React from 'react'
import {
  DEFAULT_LEARN_TOPIC_ID,
  LEARN_TOPIC_GROUPS,
  LEARN_TOPIC_INDEX,
  type LearnTopic
} from '../data/learn-topics'
import { useNetVisStore } from '../store'
import { ProtocolAnimations } from './ProtocolAnimations'
import { Button } from './ui/button'

function topicMatchesQuery(topic: LearnTopic, query: string): boolean {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true

  const haystack = [
    topic.title,
    topic.answer,
    topic.exampleSummary,
    ...topic.paragraphs,
    ...topic.searchTerms,
    ...topic.keyFields.flatMap((field) => [field.field, field.meaning, field.lookFor])
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(normalized)
}

function getTopic(id: string): LearnTopic {
  return LEARN_TOPIC_INDEX[id] ?? LEARN_TOPIC_INDEX[DEFAULT_LEARN_TOPIC_ID]!
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
    .replace(/\bIp\b/g, 'IP')
    .replace(/\bipv4\b/g, 'IPv4')
    .replace(/\bipv6\b/g, 'IPv6')
    .replace(/\bIpv4\b/g, 'IPv4')
    .replace(/\bIpv6\b/g, 'IPv6')
    .replace(/\bOsi\b/g, 'OSI')
    .replace(/\bPcap\b/g, 'PCAP')
}

function sentenceCase(text: string): string {
  return text.length > 0 ? `${text[0]!.toUpperCase()}${text.slice(1)}` : text
}

function MiniInspector({ topic }: { topic: LearnTopic }): React.JSX.Element {
  return (
    <section
      aria-label="Sample packet inspector"
      style={{
        border: '1px solid var(--nv-border-subtle)',
        borderRadius: 'var(--nv-radius-lg)',
        backgroundColor: 'var(--nv-bg-surface-1)',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--nv-border-subtle)',
          backgroundColor: 'var(--nv-bg-surface-2)'
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--nv-text-primary)' }}
        >
          <Database size={15} aria-hidden />
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
            {titleCase(topic.exampleTitle)}
          </h2>
        </div>
        <p
          style={{
            margin: '6px 0 0',
            color: 'var(--nv-text-secondary)',
            fontSize: 12,
            lineHeight: 1.45
          }}
        >
          {sentenceCase(topic.exampleSummary)}
        </p>
      </div>

      <div style={{ padding: '6px 14px 10px' }}>
        {topic.exampleFields.map((field, index) => (
          <div
            key={`${topic.id}-${field.name}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '86px minmax(90px, 0.8fr) minmax(0, 1fr)',
              gap: 10,
              padding: '8px 0',
              borderBottom:
                index < topic.exampleFields.length - 1
                  ? '1px solid var(--nv-border-subtle)'
                  : 'none',
              alignItems: 'baseline'
            }}
          >
            <span style={{ color: 'var(--nv-text-tertiary)', fontSize: 12 }}>{field.name}</span>
            <span
              style={{
                color: 'var(--nv-text-primary)',
                fontFamily: 'var(--font-data)',
                fontSize: 12,
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {field.value}
            </span>
            <span style={{ color: 'var(--nv-text-secondary)', fontSize: 12, lineHeight: 1.35 }}>
              {field.note}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

function KeyFieldsTable({ topic }: { topic: LearnTopic }): React.JSX.Element {
  return (
    <section>
      <h2 style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--nv-text-primary)' }}>
        Key fields
      </h2>
      <div
        role="table"
        aria-label={`${topic.title} key fields`}
        style={{
          borderTop: '1px solid var(--nv-border-subtle)',
          borderBottom: '1px solid var(--nv-border-subtle)'
        }}
      >
        {topic.keyFields.map((field, index) => (
          <div
            role="row"
            key={`${topic.id}-${field.field}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '124px minmax(0, 1fr) minmax(0, 1fr)',
              gap: 14,
              padding: '10px 0',
              borderBottom:
                index < topic.keyFields.length - 1 ? '1px solid var(--nv-border-subtle)' : 'none'
            }}
          >
            <span
              role="cell"
              style={{
                color: 'var(--nv-text-primary)',
                fontFamily: 'var(--font-data)',
                fontSize: 12,
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {field.field}
            </span>
            <span
              role="cell"
              style={{ color: 'var(--nv-text-secondary)', fontSize: 12, lineHeight: 1.45 }}
            >
              {field.meaning}
            </span>
            <span
              role="cell"
              style={{ color: 'var(--nv-text-tertiary)', fontSize: 12, lineHeight: 1.45 }}
            >
              {field.lookFor}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

function AnimationSlot({
  topic,
  hasPackets
}: {
  topic: LearnTopic
  hasPackets: boolean
}): React.JSX.Element | null {
  if (!topic.animation) return null

  return (
    <section
      aria-label={`${topic.animation.title} animation placeholder`}
      style={{
        border: '1px solid var(--nv-border-subtle)',
        borderRadius: 'var(--nv-radius-lg)',
        backgroundColor: 'var(--nv-bg-surface-1)',
        padding: 14
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--nv-text-primary)' }}
      >
        <Play size={15} aria-hidden />
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
          {titleCase(topic.animation.title)}
        </h2>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <span
          style={{
            minHeight: 26,
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0 10px',
            borderRadius: 'var(--nv-radius-md)',
            border: '1px solid var(--nv-accent-border)',
            color: 'var(--nv-accent)',
            backgroundColor: 'var(--nv-accent-dim)',
            fontSize: 12
          }}
        >
          {sentenceCase(topic.animation.modeLabel)}
        </span>
        <span
          style={{
            minHeight: 26,
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0 10px',
            borderRadius: 'var(--nv-radius-md)',
            border: '1px solid var(--nv-border-subtle)',
            color: hasPackets ? 'var(--nv-text-secondary)' : 'var(--nv-text-tertiary)',
            backgroundColor: 'var(--nv-bg-base)',
            fontSize: 12,
            opacity: hasPackets ? 1 : 0.5
          }}
        >
          {hasPackets ? 'Use my capture' : 'No capture yet'}
        </span>
      </div>

      <ol
        style={{
          margin: '14px 0 0',
          padding: 0,
          listStyle: 'none',
          display: 'grid',
          gap: 8
        }}
      >
        {topic.animation.steps.map((step, index) => (
          <li
            key={`${topic.id}-step-${step}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '24px 1fr',
              gap: 8,
              alignItems: 'center',
              color: 'var(--nv-text-secondary)',
              fontSize: 12
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--nv-radius-sm)',
                backgroundColor: 'var(--nv-bg-surface-2)',
                color: 'var(--nv-text-primary)',
                fontFamily: 'var(--font-data)',
                fontSize: 11
              }}
            >
              {index + 1}
            </span>
            {sentenceCase(step)}
          </li>
        ))}
      </ol>

      <div style={{ marginTop: 14 }}>
        <ProtocolAnimations animationId={topic.animation.id} />
      </div>
    </section>
  )
}

export function LearnPage(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [selectedTopicId, setSelectedTopicId] = useState(DEFAULT_LEARN_TOPIC_ID)
  const setActivePage = useNetVisStore((s) => s.setActivePage)
  const setFilter = useNetVisStore((s) => s.setFilter)
  const activateChallenge = useNetVisStore((s) => s.activateChallenge)
  const packetCount = useNetVisStore((s) => s.packets.length)
  const previousPage = useNetVisStore((s) => s.previousPage)
  const goBack = useNetVisStore((s) => s.goBack)

  const selectedTopic = getTopic(selectedTopicId)

  const visibleGroups = useMemo(
    () =>
      LEARN_TOPIC_GROUPS.map((group) => ({
        ...group,
        topics: group.topicIds.map(getTopic).filter((topic) => topicMatchesQuery(topic, query))
      })).filter((group) => group.topics.length > 0),
    [query]
  )

  const visibleTopicCount = visibleGroups.reduce((sum, group) => sum + group.topics.length, 0)

  const handleSeeLive = (): void => {
    setFilter(selectedTopic.bridge.filterExpression)
    activateChallenge(selectedTopic.bridge.challengeId)
    setActivePage('capture')
  }

  return (
    <section
      aria-label="Learn"
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: 'minmax(236px, 280px) minmax(0, 1fr)',
        backgroundColor: 'var(--nv-bg-base)',
        overflow: 'hidden'
      }}
    >
      <aside
        style={{
          borderRight: '1px solid var(--nv-border-subtle)',
          padding: 16,
          overflow: 'auto',
          backgroundColor: 'var(--nv-bg-surface-1)'
        }}
      >
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 34,
            padding: '0 10px',
            border: '1px solid var(--nv-border-subtle)',
            borderRadius: 'var(--nv-radius-md)',
            backgroundColor: 'var(--nv-bg-base)',
            color: 'var(--nv-text-tertiary)'
          }}
        >
          <Search size={14} aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="search topics or fields"
            aria-label="Search learning topics"
            style={{
              width: '100%',
              border: 0,
              outline: 0,
              background: 'transparent',
              color: 'var(--nv-text-primary)',
              fontFamily: 'var(--font-ui)',
              fontSize: 13
            }}
          />
        </label>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 14,
            color: 'var(--nv-text-tertiary)'
          }}
        >
          <BookOpen size={14} aria-hidden />
          <span style={{ fontSize: 12 }}>{visibleTopicCount} Topics</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 18 }}>
          {visibleGroups.map((group) => (
            <div key={group.id}>
              <div
                style={{
                  marginBottom: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--nv-text-tertiary)'
                }}
              >
                {titleCase(group.title)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {group.topics.map((topic) => {
                  const isActive = selectedTopic.id === topic.id
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => setSelectedTopicId(topic.id)}
                      className="nv-focus"
                      style={{
                        minHeight: 32,
                        textAlign: 'left',
                        border: `1px solid ${isActive ? 'var(--nv-border-default)' : 'transparent'}`,
                        borderRadius: 'var(--nv-radius-md)',
                        padding: '0 9px',
                        backgroundColor: isActive ? 'var(--nv-bg-surface-2)' : 'transparent',
                        color: isActive ? 'var(--nv-text-primary)' : 'var(--nv-text-secondary)',
                        fontFamily: 'var(--font-ui)',
                        fontSize: 13,
                        fontWeight: isActive ? 600 : 500,
                        cursor: 'pointer'
                      }}
                    >
                      {titleCase(topic.title)}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {visibleTopicCount === 0 && (
            <div
              style={{
                padding: 12,
                border: '1px solid var(--nv-border-subtle)',
                borderRadius: 'var(--nv-radius-md)',
                color: 'var(--nv-text-secondary)',
                fontSize: 13,
                lineHeight: 1.5
              }}
            >
              No topics match "{query}"
            </div>
          )}
        </div>
      </aside>

      <article style={{ overflow: 'auto', minWidth: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 380px)',
            gap: 24,
            alignItems: 'start',
            padding: '28px 34px 34px',
            maxWidth: 1180
          }}
        >
          <div style={{ minWidth: 0 }}>
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
            <p style={{ margin: 0, color: 'var(--nv-text-tertiary)', fontSize: 12 }}>Learn</p>
            <h1
              style={{
                margin: '4px 0 10px',
                fontSize: 28,
                lineHeight: 1.1,
                color: 'var(--nv-text-primary)',
                fontWeight: 600
              }}
            >
              {titleCase(selectedTopic.title)}
            </h1>
            <p
              style={{
                margin: 0,
                maxWidth: 720,
                color: 'var(--nv-text-primary)',
                fontSize: 16,
                lineHeight: 1.55
              }}
            >
              {selectedTopic.answer}
            </p>

            <div style={{ display: 'grid', gap: 12, marginTop: 20, maxWidth: 760 }}>
              {selectedTopic.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  style={{
                    margin: 0,
                    color: 'var(--nv-text-secondary)',
                    lineHeight: 1.65,
                    fontSize: 13
                  }}
                >
                  {paragraph}
                </p>
              ))}
            </div>

            <div
              style={{
                marginTop: 22,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap'
              }}
            >
              <Button onClick={handleSeeLive} size="sm" variant="default">
                {sentenceCase(selectedTopic.bridge.label)}
                <ArrowRight size={14} aria-hidden />
              </Button>
              <span style={{ color: 'var(--nv-text-tertiary)', fontSize: 12, lineHeight: 1.4 }}>
                {selectedTopic.bridge.hint}
              </span>
            </div>

            <div style={{ marginTop: 30 }}>
              <KeyFieldsTable topic={selectedTopic} />
            </div>
          </div>

          <aside style={{ display: 'grid', gap: 14 }}>
            <MiniInspector topic={selectedTopic} />
            <AnimationSlot topic={selectedTopic} hasPackets={packetCount > 0} />
          </aside>
        </div>
      </article>
    </section>
  )
}
