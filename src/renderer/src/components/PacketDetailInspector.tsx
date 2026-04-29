import { Check, CheckCircle, FileDown, Play } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import type React from 'react'
import type { AnonPacket, ParsedField, ParsedLayer } from '../../../shared/capture-types'
import { getChallengeById, getListedChallenges } from '../data/challenges'
import {
  buildCaptureSummary,
  getPacketRoleInfo,
  sortFieldsByPriority,
  summarizePacket
} from '../lib/packet-analysis'
import { displayLayerProtocol, formatFieldValue, getFieldHelp } from '../lib/field-help'
import { PROTOCOL_COLORS, protocolColorKey } from '../constants/protocol-colors'
import { useNetVisStore } from '../store'
import { Button } from './ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import { ScrollArea } from './ui/scroll-area'

function sentenceCase(text: string): string {
  return text.length > 0 ? `${text[0]!.toUpperCase()}${text.slice(1)}` : text
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

function protocolToken(packet: AnonPacket): { color: string; dim: string; border: string } {
  return PROTOCOL_COLORS[protocolColorKey(packet.protocol)]
}

function ByteStructurePanel({
  packet,
  hoveredField
}: {
  packet: AnonPacket
  hoveredField: { offset: number; length: number } | null
}): React.JSX.Element {
  const ranges = packet.layers
    .filter((layer) => layer.rawByteLength > 0)
    .map((layer) => ({
      start: layer.rawByteOffset,
      end: layer.rawByteOffset + layer.rawByteLength - 1,
      label: `${displayLayerProtocol(layer)} header`
    }))

  const lastHeaderByte = ranges.reduce((max, range) => Math.max(max, range.end), -1)
  if (packet.wireLength > lastHeaderByte + 1) {
    ranges.push({
      start: lastHeaderByte + 1,
      end: packet.wireLength - 1,
      label: 'Payload or undecoded bytes'
    })
  }

  const overlapsHoveredField = (range: { start: number; end: number }): boolean =>
    hoveredField != null &&
    range.start < hoveredField.offset + hoveredField.length &&
    range.end >= hoveredField.offset

  return (
    <div
      aria-label="Packet byte structure"
      style={{
        borderTop: '1px solid var(--nv-border-subtle)',
        padding: '8px 10px',
        backgroundColor: 'var(--nv-bg-surface-2)',
        flexShrink: 0
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--nv-text-tertiary)',
          marginBottom: 4
        }}
      >
        Byte positions
      </div>
      <div style={{ display: 'grid', gap: 4 }}>
        {ranges.length > 0 ? (
          ranges.map((range) => {
            const highlighted = overlapsHoveredField(range)
            return (
              <div
                key={`${range.start}-${range.end}-${range.label}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '88px minmax(0, 1fr)',
                  gap: 8,
                  alignItems: 'center',
                  padding: '3px 5px',
                  borderRadius: 'var(--nv-radius-sm)',
                  backgroundColor: highlighted ? 'rgba(78,156,232,0.18)' : 'transparent'
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: 10,
                    color: highlighted ? 'var(--proto-tcp)' : 'var(--nv-text-tertiary)'
                  }}
                >
                  {range.start === range.end
                    ? `Byte ${range.start}`
                    : `Bytes ${range.start}-${range.end}`}
                </span>
                <span
                  style={{
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--nv-text-secondary)',
                    fontSize: 11
                  }}
                >
                  {range.label}
                </span>
              </div>
            )
          })
        ) : (
          <p style={{ margin: 0, color: 'var(--nv-text-tertiary)', fontSize: 11 }}>
            No byte range metadata is available for this packet.
          </p>
        )}
      </div>
      <p
        style={{
          margin: '6px 0 0',
          color: 'var(--nv-text-tertiary)',
          fontSize: 11,
          lineHeight: 1.4
        }}
      >
        Packet headers are layered. Selecting a field above highlights the byte range that field
        occupies.
      </p>
    </div>
  )
}

function FieldRow({
  field,
  layerProtocol,
  isPriority,
  onHover
}: {
  field: ParsedField
  layerProtocol: string
  isPriority: boolean
  onHover: (field: { offset: number; length: number } | null) => void
}): React.JSX.Element {
  const fieldValue = formatFieldValue(layerProtocol, field)
  const help = getFieldHelp(layerProtocol, field)

  return (
    <div
      tabIndex={0}
      aria-label={`${field.label}: ${fieldValue}`}
      onMouseEnter={() => onHover({ offset: field.byteOffset, length: field.byteLength })}
      onFocus={() => onHover({ offset: field.byteOffset, length: field.byteLength })}
      onMouseLeave={() => onHover(null)}
      onBlur={() => onHover(null)}
      className="nv-focus"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(104px, 0.75fr) minmax(0, 1fr)',
        gap: 10,
        padding: '7px 14px',
        borderBottom: '1px solid var(--nv-border-subtle)',
        backgroundColor: 'var(--nv-bg-surface-1)',
        opacity: isPriority ? 1 : 0.68,
        outline: 'none'
      }}
    >
      <span
        style={{
          color: isPriority ? 'var(--nv-text-primary)' : 'var(--nv-text-secondary)',
          fontFamily: 'var(--font-data)',
          fontSize: 12
        }}
      >
        {field.label}
      </span>
      <span style={{ minWidth: 0, display: 'grid', gap: 3 }}>
        <span
          style={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: 'var(--nv-text-primary)',
            fontFamily: 'var(--font-data)',
            fontSize: 12
          }}
        >
          {fieldValue}
        </span>
        {help && (
          <span
            style={{
              color: 'var(--nv-text-tertiary)',
              fontFamily: 'var(--font-ui)',
              fontSize: 11,
              lineHeight: 1.35,
              whiteSpace: 'normal'
            }}
          >
            {help.explanation}
          </span>
        )}
      </span>
    </div>
  )
}

function LayerSection({
  layer,
  priorityFields,
  onHover
}: {
  layer: ParsedLayer
  priorityFields: string[]
  onHover: (field: { offset: number; length: number } | null) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(true)
  const key = protocolColorKey(layer.protocol)
  const token = PROTOCOL_COLORS[key]
  const layerLabel = displayLayerProtocol(layer)
  const sortedFields = sortFieldsByPriority(layer.fields, priorityFields)
  const isPriority = (field: ParsedField): boolean => {
    const text = `${field.name} ${field.label}`.toLowerCase()
    return priorityFields.some((priority) => text.includes(priority.toLowerCase()))
  }
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      setOpen(true)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setOpen(false)
    }
  }, [])

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        onKeyDown={handleKeyDown}
        className="nv-focus"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          minHeight: 36,
          padding: '0 14px',
          border: 0,
          borderLeft: `4px solid ${token.color}`,
          borderBottom: '1px solid var(--nv-border-subtle)',
          borderRadius: open
            ? 'var(--nv-radius-md) var(--nv-radius-md) 0 0'
            : 'var(--nv-radius-md)',
          backgroundColor: token.dim,
          color: token.color,
          cursor: 'pointer',
          textAlign: 'left',
          marginTop: 8
        }}
      >
        <span
          aria-hidden
          style={{
            fontSize: 9,
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
            flexShrink: 0
          }}
        >
          ▶
        </span>
        <span style={{ fontSize: 12, fontWeight: 700 }}>{layerLabel}</span>
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-data)',
            fontSize: 10,
            color: 'var(--nv-text-tertiary)',
            flexShrink: 0
          }}
        >
          {layer.rawByteLength} B
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          style={{
            paddingTop: 0,
            borderRadius: '0 0 var(--nv-radius-md) var(--nv-radius-md)',
            overflow: 'hidden'
          }}
        >
          {sortedFields.length > 0 ? (
            sortedFields.map((field, index) => (
              <FieldRow
                key={`${field.name}-${index}`}
                field={field}
                layerProtocol={layerLabel}
                isPriority={isPriority(field)}
                onHover={onHover}
              />
            ))
          ) : (
            <div
              style={{
                padding: '10px 14px',
                color: 'var(--nv-text-tertiary)',
                fontSize: 12,
                backgroundColor: 'var(--nv-bg-surface-1)'
              }}
            >
              No fields decoded
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function ProtocolBars({ packets }: { packets: AnonPacket[] }): React.JSX.Element {
  const counts = new Map<string, number>()
  for (const packet of packets) counts.set(packet.protocol, (counts.get(packet.protocol) ?? 0) + 1)
  const total = Math.max(1, packets.length)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {Array.from(counts.entries())
        .slice(0, 5)
        .map(([protocol, count]) => {
          const token = PROTOCOL_COLORS[protocolColorKey(protocol)]
          const pct = Math.round((count / total) * 100)
          return (
            <div
              key={protocol}
              style={{
                display: 'grid',
                gridTemplateColumns: '42px 1fr 36px',
                gap: 8,
                alignItems: 'center'
              }}
            >
              <span style={{ color: token.color, fontFamily: 'var(--font-data)', fontSize: 11 }}>
                {protocol}
              </span>
              <span
                style={{
                  height: 7,
                  borderRadius: 999,
                  backgroundColor: 'var(--nv-bg-surface-3)',
                  overflow: 'hidden'
                }}
              >
                <span
                  style={{
                    display: 'block',
                    width: `${pct}%`,
                    height: '100%',
                    backgroundColor: token.color
                  }}
                />
              </span>
              <span
                style={{
                  color: 'var(--nv-text-tertiary)',
                  fontFamily: 'var(--font-data)',
                  fontSize: 11,
                  textAlign: 'right'
                }}
              >
                {pct}%
              </span>
            </div>
          )
        })}
    </div>
  )
}

function WelcomeState(): React.JSX.Element {
  const setActivePage = useNetVisStore((s) => s.setActivePage)
  const setWelcomeSeen = useNetVisStore((s) => s.setWelcomeSeen)

  const handleOpenGuide = (): void => {
    // Re-show the welcome screen by resetting welcomeSeen
    void window.electronAPI.setSettings({ welcomeSeen: false })
    setWelcomeSeen(false)
  }

  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          backgroundColor: 'var(--proto-tcp)',
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          fontWeight: 700
        }}
      >
        N
      </div>
      <h2 style={{ margin: 0, fontSize: 19 }}>Welcome to NetVis</h2>
      <p style={{ margin: 0, color: 'var(--nv-text-secondary)', lineHeight: 1.6 }}>
        Start a live capture to see network traffic on your machine, or import a saved PCAP file to
        explore an existing capture.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Button
          size="sm"
          style={{ justifyContent: 'center' }}
          onClick={() => setActivePage('capture')}
        >
          <Play size={14} aria-hidden />
          Go to capture
        </Button>
        <Button
          size="sm"
          variant="outline"
          style={{ justifyContent: 'center' }}
          onClick={() => setActivePage('capture')}
        >
          <FileDown size={14} aria-hidden />
          Import PCAP file
        </Button>
      </div>
      <p style={{ margin: 0, color: 'var(--nv-text-tertiary)', fontSize: 12 }}>
        Not sure where to start?
      </p>
      <Button
        size="sm"
        variant="ghost"
        style={{ justifyContent: 'flex-start', paddingLeft: 0 }}
        onClick={handleOpenGuide}
      >
        Open Getting Started Guide
      </Button>
    </div>
  )
}

function RunningState({ packets }: { packets: AnonPacket[] }): React.JSX.Element {
  const captureStatus = useNetVisStore((s) => s.captureStatus)
  const interfaces = useNetVisStore((s) => s.interfaces)
  const summary = buildCaptureSummary(packets)

  // Resolve interface display name
  const rawIface = captureStatus.state === 'active' ? captureStatus.iface : 'capture'
  const interfaceObj = interfaces.find((iface) => iface.name === rawIface)
  const displayName = interfaceObj?.displayName ?? rawIface

  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 16 }}>Capturing on {displayName}</h2>
        <p style={{ margin: '8px 0 0', color: 'var(--nv-text-secondary)', lineHeight: 1.6 }}>
          {packets.length.toLocaleString()} packets captured
        </p>
      </div>
      <p style={{ margin: 0, color: 'var(--nv-text-secondary)', lineHeight: 1.6 }}>
        Select any packet in the list to inspect its contents.
      </p>
      <div
        aria-label="Capture summary"
        style={{
          display: 'grid',
          gap: 8,
          padding: '12px',
          border: '1px solid var(--nv-border-subtle)',
          borderRadius: 'var(--nv-radius-md)',
          backgroundColor: 'var(--nv-bg-surface-2)'
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14 }}>What happened?</h3>
        <p style={{ margin: 0, color: 'var(--nv-text-secondary)', fontSize: 13, lineHeight: 1.55 }}>
          {summary.story}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <span style={{ color: 'var(--nv-text-tertiary)', fontSize: 12 }}>
            Duration: {summary.durationLabel}
          </span>
          <span style={{ color: 'var(--nv-text-tertiary)', fontSize: 12 }}>
            Dominant: {summary.dominantProtocol}
          </span>
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--nv-border-subtle)', paddingTop: 14 }}>
        <p style={{ margin: '0 0 10px', color: 'var(--nv-text-tertiary)', fontSize: 12 }}>
          So far in this capture:
        </p>
        <ProtocolBars packets={packets} />
      </div>
    </div>
  )
}

function ChallengeState(): React.JSX.Element {
  const activeChallengeId = useNetVisStore((s) => s.activeChallengeId)
  const activateChallenge = useNetVisStore((s) => s.activateChallenge)
  const completeChallenge = useNetVisStore((s) => s.completeChallenge)
  const selectedPacketId = useNetVisStore((s) => s.selectedPacketId)
  const packets = useNetVisStore((s) => s.packets)
  const filteredPackets = useNetVisStore((s) => s.filteredPackets)
  const filterExpression = useNetVisStore((s) => s.filterExpression)
  const [feedback, setFeedback] = useState<string | null>(null)
  const challenge = activeChallengeId ? getChallengeById(activeChallengeId) : undefined
  const selectedPacket = selectedPacketId
    ? packets.find((packet) => packet.id === selectedPacketId)
    : null
  const candidatePackets = filteredPackets.length > 0 ? filteredPackets : packets

  const handleFound = (): void => {
    if (!challenge) return

    if (challenge.successCriteria(candidatePackets, filterExpression, selectedPacket)) {
      completeChallenge(challenge.id)
      setFeedback(null)
    } else {
      setFeedback('Not quite yet. Select a matching packet, then try again.')
    }
  }

  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ margin: 0, fontSize: 16, color: 'var(--proto-dns)' }}>Challenge Active</h2>
      <h3 style={{ margin: 0, fontSize: 18 }}>
        {challenge ? titleCase(challenge.title) : 'Identify a Packet'}
      </h3>
      <p style={{ margin: 0, color: 'var(--nv-text-secondary)', lineHeight: 1.6 }}>
        {challenge
          ? sentenceCase(challenge.hint)
          : 'Select a packet that matches the challenge condition.'}
      </p>
      {challenge && (
        <div
          style={{
            display: 'grid',
            gap: 6,
            padding: '10px 12px',
            border: '1px solid var(--nv-border-subtle)',
            borderRadius: 'var(--nv-radius-md)',
            backgroundColor: 'var(--nv-bg-surface-2)'
          }}
        >
          <span style={{ color: 'var(--nv-text-tertiary)', fontSize: 12 }}>Look For:</span>
          {challenge.lookFor.map((item) => (
            <span
              key={item}
              style={{ color: 'var(--nv-text-secondary)', fontSize: 12, lineHeight: 1.4 }}
            >
              {sentenceCase(item)}
            </span>
          ))}
        </div>
      )}
      {feedback && (
        <p
          role="status"
          style={{ margin: 0, color: 'var(--color-error)', fontSize: 12, lineHeight: 1.45 }}
        >
          {feedback}
        </p>
      )}
      <Button size="sm" onClick={handleFound} style={{ justifyContent: 'center' }}>
        <Check size={14} aria-hidden />I found one
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => activateChallenge(null)}
        style={{ justifyContent: 'center' }}
      >
        Skip this challenge
      </Button>
    </div>
  )
}

function ChallengeCompleteState(): React.JSX.Element {
  const completion = useNetVisStore((s) => s.challengeCompletion)
  const clearChallengeCompletion = useNetVisStore((s) => s.clearChallengeCompletion)
  const activateChallenge = useNetVisStore((s) => s.activateChallenge)
  const setFilter = useNetVisStore((s) => s.setFilter)
  const challenge = completion ? getChallengeById(completion.challengeId) : undefined
  const listedChallenges = getListedChallenges()
  const currentIndex = challenge
    ? listedChallenges.findIndex((candidate) => candidate.id === challenge.id)
    : -1
  const nextChallenge =
    currentIndex >= 0
      ? listedChallenges
          .slice(currentIndex + 1)
          .find((candidate) => candidate.difficulty === challenge?.difficulty)
      : undefined

  const handleNext = (): void => {
    if (!nextChallenge) {
      clearChallengeCompletion()
      return
    }

    setFilter(nextChallenge.initialFilter)
    activateChallenge(nextChallenge.id)
  }

  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-live)' }}>
        <CheckCircle size={18} aria-hidden />
        <h2 style={{ margin: 0, fontSize: 18 }}>Challenge Complete</h2>
      </div>

      <p style={{ margin: 0, color: 'var(--nv-text-primary)', lineHeight: 1.55 }}>
        {challenge ? sentenceCase(challenge.completion.found) : 'You completed the challenge.'}
      </p>

      <div
        style={{
          display: 'grid',
          gap: 8,
          padding: '12px',
          border: '1px solid var(--nv-border-subtle)',
          borderRadius: 'var(--nv-radius-md)',
          backgroundColor: 'var(--nv-bg-surface-2)'
        }}
      >
        <span style={{ color: 'var(--nv-text-tertiary)', fontSize: 12 }}>What This Means:</span>
        <p style={{ margin: 0, color: 'var(--nv-text-secondary)', fontSize: 13, lineHeight: 1.55 }}>
          {challenge
            ? sentenceCase(challenge.completion.meaning)
            : 'You matched packet evidence to the learning goal.'}
        </p>
      </div>

      <Button
        size="sm"
        onClick={handleNext}
        disabled={!nextChallenge}
        style={{ justifyContent: 'center' }}
      >
        Next Challenge
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={clearChallengeCompletion}
        style={{ justifyContent: 'center' }}
      >
        Back to Capture
      </Button>
    </div>
  )
}

function ReplayCompleteState(): React.JSX.Element {
  const importResult = useNetVisStore((s) => s.importResult)
  const clearPackets = useNetVisStore((s) => s.clearPackets)
  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Replay Complete</h2>
      <p style={{ margin: 0, color: 'var(--nv-text-secondary)', lineHeight: 1.6 }}>
        {(importResult?.packetCount ?? 0).toLocaleString()} packets loaded from this capture.
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          void window.electronAPI.exportPcap()
        }}
      >
        Export as PCAP
      </Button>
      <Button size="sm" variant="ghost" onClick={clearPackets}>
        Clear and Start New
      </Button>
    </div>
  )
}

function SelectedPacketState({ packet }: { packet: AnonPacket }): React.JSX.Element {
  const [hoveredField, setHoveredField] = useState<{ offset: number; length: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const token = protocolToken(packet)
  const summary = summarizePacket(packet)
  const roleInfo = getPacketRoleInfo(packet)
  const role: string | null = null

  return (
    <div
      ref={panelRef}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
    >
      <div
        style={{
          flexShrink: 0,
          display: 'grid',
          gridTemplateColumns: '3px 1fr',
          gap: 12,
          padding: '16px 18px 14px',
          borderBottom: '1px solid var(--nv-border-subtle)'
        }}
      >
        <span aria-hidden style={{ backgroundColor: token.color, borderRadius: 999 }} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: token.color,
              fontFamily: 'var(--font-data)',
              fontSize: 11,
              fontWeight: 700
            }}
          >
            {summary.title}
            {role ? ` · ${role}` : ''}
          </div>
          <p style={{ margin: '6px 0 8px', color: 'var(--nv-text-primary)', lineHeight: 1.5 }}>
            {summary.summary}
          </p>
          <div style={{ display: 'grid', gap: 6 }}>
            <p
              style={{
                margin: 0,
                color: 'var(--nv-text-secondary)',
                fontSize: 12,
                lineHeight: 1.5
              }}
            >
              <strong style={{ color: 'var(--nv-text-primary)' }}>Why it matters: </strong>
              {summary.whyItMatters}
            </p>
            <div style={{ display: 'grid', gap: 3 }}>
              <span style={{ color: 'var(--nv-text-tertiary)', fontSize: 11, fontWeight: 700 }}>
                Inspect next
              </span>
              {summary.whatToInspectNext.map((item) => (
                <span
                  key={item}
                  style={{ color: 'var(--nv-text-tertiary)', fontSize: 12, lineHeight: 1.45 }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
          <p style={{ margin: '8px 0 0', color: 'var(--nv-text-tertiary)', fontSize: 11 }}>
            Table role: {roleInfo.tableLabel}
          </p>
        </div>
      </div>
      <ScrollArea style={{ flex: 1, minHeight: 0 }}>
        <div style={{ padding: '0 12px' }}>
          {packet.layers.map((layer, index) => (
            <LayerSection
              key={`${layer.protocol}-${index}`}
              layer={layer}
              priorityFields={summary.priorityFields}
              onHover={setHoveredField}
            />
          ))}
        </div>
      </ScrollArea>
      <ByteStructurePanel packet={packet} hoveredField={hoveredField} />
    </div>
  )
}

type InspectorView = 'welcome' | 'summary' | 'packet' | 'challenge' | 'complete' | 'replay'

export function PacketDetailInspector(): React.JSX.Element {
  const selectedPacketId = useNetVisStore((s) => s.selectedPacketId)
  const packets = useNetVisStore((s) => s.packets)
  const captureStatus = useNetVisStore((s) => s.captureStatus)
  const activeChallengeId = useNetVisStore((s) => s.activeChallengeId)
  const challengeCompletion = useNetVisStore((s) => s.challengeCompletion)
  const importResult = useNetVisStore((s) => s.importResult)
  const selectPacket = useNetVisStore((s) => s.selectPacket)
  const clearChallengeCompletion = useNetVisStore((s) => s.clearChallengeCompletion)
  const packet =
    selectedPacketId != null ? packets.find((p) => p.id === selectedPacketId) : undefined
  const isRunning =
    captureStatus.state === 'active' ||
    captureStatus.state === 'simulated' ||
    captureStatus.state === 'file'

  // Derive the current view automatically from app state
  const currentView: InspectorView = challengeCompletion
    ? 'complete'
    : activeChallengeId
      ? 'challenge'
      : packet
        ? 'packet'
        : importResult && !isRunning
          ? 'replay'
          : packets.length === 0
            ? 'welcome'
            : 'summary'

  // Back is available when viewing a selected packet (deselects it)
  // or after a challenge completes (clears completion so user returns to challenge/summary)
  const canGoBack = currentView === 'packet' || currentView === 'complete'

  const handleBack = (): void => {
    if (currentView === 'complete') {
      clearChallengeCompletion()
    } else if (currentView === 'packet') {
      selectPacket(null)
    }
  }

  const renderView = (): React.JSX.Element => {
    switch (currentView) {
      case 'complete':
        return <ChallengeCompleteState />
      case 'challenge':
        return <ChallengeState />
      case 'packet':
        return packet ? <SelectedPacketState packet={packet} /> : <WelcomeState />
      case 'replay':
        return importResult ? <ReplayCompleteState /> : <WelcomeState />
      case 'summary':
        return <RunningState packets={packets} />
      case 'welcome':
      default:
        return <WelcomeState />
    }
  }

  return (
    <aside
      aria-label="Packet inspector"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: 'var(--nv-bg-surface-1)'
      }}
    >
      {/* Inspector header — title + optional back button */}
      <div
        style={{
          height: 34,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '0 12px',
          borderBottom: '1px solid var(--nv-border-subtle)',
          backgroundColor: 'var(--nv-bg-surface-2)'
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--nv-text-primary)'
          }}
        >
          Inspector
        </span>
        {canGoBack && (
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back to previous inspector state"
            className="nv-focus"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              height: 22,
              padding: '0 8px',
              border: '1px solid var(--nv-border-subtle)',
              borderRadius: 'var(--nv-radius-sm)',
              backgroundColor: 'transparent',
              color: 'var(--nv-text-tertiary)',
              fontFamily: 'var(--font-ui)',
              fontSize: 11,
              cursor: 'pointer'
            }}
          >
            ← Back
          </button>
        )}
      </div>

      {renderView()}
    </aside>
  )
}
