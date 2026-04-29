import { ArrowRight, Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react'
import { useEffect, useState } from 'react'
import type React from 'react'
import type { AnonPacket } from '../../../shared/capture-types'
import { PROTO_COLORS } from '../lib/proto-tokens'
import { useNetVisStore } from '../store'
import { Button } from './ui/button'

export type EducationalAnimationId =
  | 'osi-encapsulation'
  | 'tcp-handshake'
  | 'dns-flow'
  | 'icmp-ping'
export type AnimationDataMode = 'example' | 'live'

export interface AnimationStep {
  index: number
  description: string
  direction: 'ltr' | 'rtl'
  label: string
  color: string
  matchPacket?: (p: AnonPacket) => boolean
}

export interface AnimationDef {
  id: string
  title: string
  description: string
  steps: AnimationStep[]
}

interface EducationalAnimationStep {
  label: string
  explanation: string
  leftLabel: string
  rightLabel: string
  packetLabel: string
  color: string
  direction: 'ltr' | 'rtl' | 'stack'
}

interface AnimationDefinition {
  id: EducationalAnimationId
  title: string
  description: string
  filterExpression: string
  steps: EducationalAnimationStep[]
}

export const EDUCATIONAL_ANIMATIONS: Record<EducationalAnimationId, AnimationDefinition> = {
  'osi-encapsulation': {
    id: 'osi-encapsulation',
    title: 'OSI Layer Encapsulation',
    description:
      'Watch application data get wrapped by transport, network, and local delivery headers.',
    filterExpression: '',
    steps: [
      {
        label: 'Application Data',
        explanation:
          'The message starts as application data. A browser request or DNS question begins here.',
        leftLabel: 'Application',
        rightLabel: 'Packet',
        packetLabel: 'Data',
        color: PROTO_COLORS.DNS.color,
        direction: 'stack'
      },
      {
        label: 'Transport Header',
        explanation:
          'TCP or UDP adds ports so the receiving machine knows which application should read it.',
        leftLabel: 'Transport',
        rightLabel: 'Packet',
        packetLabel: 'TCP/UDP + Data',
        color: PROTO_COLORS.TCP.color,
        direction: 'stack'
      },
      {
        label: 'IP Header',
        explanation:
          'IP adds source and destination addresses so routers can move the packet between networks.',
        leftLabel: 'Network',
        rightLabel: 'Packet',
        packetLabel: 'IP + TCP/UDP',
        color: PROTO_COLORS.IPv4.color,
        direction: 'stack'
      },
      {
        label: 'Ethernet Frame',
        explanation: 'Ethernet wraps the packet for local delivery on Wi-Fi or Ethernet.',
        leftLabel: 'Data Link',
        rightLabel: 'Wire',
        packetLabel: 'Ethernet Frame',
        color: PROTO_COLORS.OTHER.color,
        direction: 'ltr'
      }
    ]
  },
  'tcp-handshake': {
    id: 'tcp-handshake',
    title: 'TCP Three-Way Handshake',
    description: 'See how a client and server agree that a reliable connection can begin.',
    filterExpression: 'proto == TCP',
    steps: [
      {
        label: 'SYN',
        explanation: 'The client sends SYN. It is asking to start a TCP connection.',
        leftLabel: 'Client',
        rightLabel: 'Server',
        packetLabel: 'SYN',
        color: PROTO_COLORS.TCP.color,
        direction: 'ltr'
      },
      {
        label: 'SYN-ACK',
        explanation:
          'The server replies SYN-ACK. It acknowledges the request and says it is ready.',
        leftLabel: 'Client',
        rightLabel: 'Server',
        packetLabel: 'SYN-ACK',
        color: PROTO_COLORS.TCP.color,
        direction: 'rtl'
      },
      {
        label: 'ACK',
        explanation: 'The client sends ACK. The connection is established and data can follow.',
        leftLabel: 'Client',
        rightLabel: 'Server',
        packetLabel: 'ACK',
        color: PROTO_COLORS.TCP.color,
        direction: 'ltr'
      }
    ]
  },
  'dns-flow': {
    id: 'dns-flow',
    title: 'DNS Resolution Flow',
    description: 'Follow a name lookup from your app to a resolver and back with an answer.',
    filterExpression: 'proto == DNS',
    steps: [
      {
        label: 'Ask Resolver',
        explanation:
          'Your computer asks a DNS resolver to translate a domain name into an IP address.',
        leftLabel: 'Computer',
        rightLabel: 'Resolver',
        packetLabel: 'QUERY',
        color: PROTO_COLORS.DNS.color,
        direction: 'ltr'
      },
      {
        label: 'Resolver Works',
        explanation:
          'The resolver checks cache or asks other DNS servers until it finds an answer.',
        leftLabel: 'Resolver',
        rightLabel: 'DNS Servers',
        packetLabel: 'LOOKUP',
        color: PROTO_COLORS.DNS.color,
        direction: 'ltr'
      },
      {
        label: 'Answer Returns',
        explanation:
          'The resolver returns a response with the address or an error if the name does not exist.',
        leftLabel: 'Computer',
        rightLabel: 'Resolver',
        packetLabel: 'RESPONSE',
        color: PROTO_COLORS.DNS.color,
        direction: 'rtl'
      },
      {
        label: 'Connection Starts',
        explanation:
          'Now your computer can contact the returned address using TCP, UDP, or another protocol.',
        leftLabel: 'Computer',
        rightLabel: 'Server',
        packetLabel: 'CONNECT',
        color: PROTO_COLORS.TCP.color,
        direction: 'ltr'
      }
    ]
  },
  'icmp-ping': {
    id: 'icmp-ping',
    title: 'ICMP Ping Round Trip',
    description: 'See how an echo request and echo reply measure reachability.',
    filterExpression: 'proto == ICMP',
    steps: [
      {
        label: 'Echo Request',
        explanation:
          'Your computer sends an ICMP echo request to ask if the destination can answer.',
        leftLabel: 'Sender',
        rightLabel: 'Target',
        packetLabel: 'PING',
        color: PROTO_COLORS.ICMP.color,
        direction: 'ltr'
      },
      {
        label: 'Target Receives',
        explanation:
          'The target receives the request. If it can respond, it prepares an echo reply.',
        leftLabel: 'Sender',
        rightLabel: 'Target',
        packetLabel: 'RECEIVED',
        color: PROTO_COLORS.ICMP.color,
        direction: 'ltr'
      },
      {
        label: 'Echo Reply',
        explanation: 'The target sends an echo reply back to the sender.',
        leftLabel: 'Sender',
        rightLabel: 'Target',
        packetLabel: 'REPLY',
        color: PROTO_COLORS.ICMP.color,
        direction: 'rtl'
      },
      {
        label: 'Round Trip Time',
        explanation: 'The time between request and reply is the round trip time.',
        leftLabel: 'Sender',
        rightLabel: 'Target',
        packetLabel: 'RTT',
        color: PROTO_COLORS.ICMP.color,
        direction: 'stack'
      }
    ]
  }
}

export const ANIMATIONS: AnimationDef[] = [
  {
    id: 'tcp-handshake',
    title: EDUCATIONAL_ANIMATIONS['tcp-handshake'].title,
    description: EDUCATIONAL_ANIMATIONS['tcp-handshake'].description,
    steps: [
      {
        index: 0,
        description: 'Client sends SYN to initiate a connection request.',
        direction: 'ltr',
        label: 'SYN',
        color: PROTO_COLORS.TCP.color,
        matchPacket: (p) =>
          p.protocol === 'TCP' &&
          p.layers.some((layer) =>
            layer.fields.some((field) => {
              const value = String(field.value).toUpperCase()
              return field.name === 'flags' && value.includes('SYN') && !value.includes('ACK')
            })
          )
      },
      {
        index: 1,
        description: 'Server replies with SYN-ACK to acknowledge and request connection.',
        direction: 'rtl',
        label: 'SYN-ACK',
        color: PROTO_COLORS.TCP.color,
        matchPacket: (p) =>
          p.protocol === 'TCP' &&
          p.layers.some((layer) =>
            layer.fields.some((field) => {
              const value = String(field.value).toUpperCase()
              return field.name === 'flags' && value.includes('SYN') && value.includes('ACK')
            })
          )
      },
      {
        index: 2,
        description: 'Client sends ACK and the connection is established.',
        direction: 'ltr',
        label: 'ACK',
        color: PROTO_COLORS.TCP.color,
        matchPacket: (p) =>
          p.protocol === 'TCP' &&
          p.layers.some((layer) =>
            layer.fields.some(
              (field) => field.name === 'flags' && String(field.value).toUpperCase() === 'ACK'
            )
          )
      }
    ]
  },
  {
    id: 'dns-query',
    title: 'DNS Query / Response',
    description: EDUCATIONAL_ANIMATIONS['dns-flow'].description,
    steps: [
      {
        index: 0,
        description: 'Client sends a DNS query for a domain name.',
        direction: 'ltr',
        label: 'QUERY',
        color: PROTO_COLORS.DNS.color,
        matchPacket: (p) => p.protocol === 'DNS'
      },
      {
        index: 1,
        description: 'Server sends a DNS response with an answer.',
        direction: 'rtl',
        label: 'RESPONSE',
        color: PROTO_COLORS.DNS.color,
        matchPacket: (p) => p.protocol === 'DNS'
      }
    ]
  },
  {
    id: 'icmp-echo',
    title: 'ICMP Echo Request / Reply',
    description: EDUCATIONAL_ANIMATIONS['icmp-ping'].description,
    steps: [
      {
        index: 0,
        description: 'Sender issues an ICMP echo request.',
        direction: 'ltr',
        label: 'PING',
        color: PROTO_COLORS.ICMP.color,
        matchPacket: (p) => p.protocol === 'ICMP'
      },
      {
        index: 1,
        description: 'Target replies with an ICMP echo reply.',
        direction: 'rtl',
        label: 'REPLY',
        color: PROTO_COLORS.ICMP.color,
        matchPacket: (p) => p.protocol === 'ICMP'
      }
    ]
  }
]

export function findMatchingPacketId(packets: AnonPacket[], step: AnimationStep): string | null {
  if (!step.matchPacket) return null
  return packets.find(step.matchPacket)?.id ?? null
}

function hasRelevantLiveData(id: EducationalAnimationId, packets: AnonPacket[]): boolean {
  if (id === 'osi-encapsulation') return packets.some((packet) => packet.layers.length >= 3)
  if (id === 'tcp-handshake') return packets.some((packet) => packet.protocol === 'TCP')
  if (id === 'dns-flow') return packets.some((packet) => packet.protocol === 'DNS')
  if (id === 'icmp-ping') return packets.some((packet) => packet.protocol === 'ICMP')
  return false
}

function AnimationCanvas({ step }: { step: EducationalAnimationStep }): React.JSX.Element {
  const packetLeft = step.direction === 'rtl' ? '68%' : step.direction === 'stack' ? '42%' : '18%'

  return (
    <div
      aria-hidden
      style={{
        position: 'relative',
        height: 150,
        border: '1px solid var(--nv-border-subtle)',
        borderRadius: 'var(--nv-radius-lg)',
        backgroundColor: 'var(--nv-bg-surface-2)',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 24,
          top: 24,
          bottom: 24,
          width: 112,
          border: '1px solid var(--nv-border-default)',
          borderRadius: 'var(--nv-radius-md)',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--nv-text-secondary)',
          backgroundColor: 'var(--nv-bg-surface-1)',
          fontSize: 12,
          fontWeight: 600
        }}
      >
        {step.leftLabel}
      </div>
      <div
        style={{
          position: 'absolute',
          right: 24,
          top: 24,
          bottom: 24,
          width: 112,
          border: '1px solid var(--nv-border-default)',
          borderRadius: 'var(--nv-radius-md)',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--nv-text-secondary)',
          backgroundColor: 'var(--nv-bg-surface-1)',
          fontSize: 12,
          fontWeight: 600
        }}
      >
        {step.rightLabel}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 146,
          right: 146,
          top: 74,
          height: 1,
          backgroundColor: 'var(--nv-border-default)'
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: packetLeft,
          top: step.direction === 'stack' ? 54 : 58,
          width: step.direction === 'stack' ? 160 : 112,
          minHeight: 38,
          display: 'grid',
          placeItems: 'center',
          padding: '0 10px',
          border: `1px solid ${step.color}`,
          borderRadius: 'var(--nv-radius-md)',
          color: step.color,
          backgroundColor: 'var(--nv-bg-base)',
          fontFamily: 'var(--font-data)',
          fontSize: 12,
          fontWeight: 700,
          transform: 'translateX(-50%)',
          boxShadow: 'var(--nv-shadow-sm)'
        }}
      >
        {step.packetLabel}
      </div>
    </div>
  )
}

export function ProtocolAnimations({
  animationId = 'osi-encapsulation'
}: {
  animationId?: EducationalAnimationId
}): React.JSX.Element {
  const packets = useNetVisStore((s) => s.packets)
  const setFilter = useNetVisStore((s) => s.setFilter)
  const setActivePage = useNetVisStore((s) => s.setActivePage)
  const [mode, setMode] = useState<AnimationDataMode>('example')
  const [stepIndex, setStepIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  const definition = EDUCATIONAL_ANIMATIONS[animationId]
  const hasLiveData = hasRelevantLiveData(animationId, packets)
  const safeStepIndex = Math.min(stepIndex, definition.steps.length - 1)
  const step = definition.steps[safeStepIndex]!

  useEffect(() => {
    setIsPlaying(false)
    setStepIndex(0)
    setMode('example')
  }, [animationId])

  useEffect(() => {
    if (!isPlaying) return
    const timer = window.setTimeout(() => {
      setStepIndex((current) => {
        if (current >= definition.steps.length - 1) {
          setIsPlaying(false)
          return current
        }
        return current + 1
      })
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [definition.steps.length, isPlaying, stepIndex])

  const goLive = (): void => {
    setFilter(definition.filterExpression)
    setActivePage('capture')
  }

  return (
    <section
      aria-label={`${definition.title} animation`}
      style={{
        border: '1px solid var(--nv-border-subtle)',
        borderRadius: 'var(--nv-radius-lg)',
        backgroundColor: 'var(--nv-bg-surface-1)',
        padding: 14,
        display: 'grid',
        gap: 12
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 12 }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 14, color: 'var(--nv-text-primary)' }}>
            {definition.title}
          </h2>
          <p
            style={{
              margin: '5px 0 0',
              color: 'var(--nv-text-secondary)',
              fontSize: 12,
              lineHeight: 1.45
            }}
          >
            {definition.description}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <Button
            size="sm"
            variant={mode === 'example' ? 'default' : 'outline'}
            aria-pressed={mode === 'example'}
            onClick={() => setMode('example')}
          >
            Example
          </Button>
          <Button
            size="sm"
            variant={mode === 'live' ? 'default' : 'outline'}
            disabled={!hasLiveData}
            aria-pressed={mode === 'live'}
            onClick={() => setMode('live')}
          >
            My Capture
          </Button>
        </div>
      </div>

      <AnimationCanvas step={step} />

      <div
        role="status"
        aria-live="polite"
        style={{
          minHeight: 64,
          padding: 10,
          border: '1px solid var(--nv-border-subtle)',
          borderRadius: 'var(--nv-radius-md)',
          backgroundColor: 'var(--nv-bg-base)'
        }}
      >
        <div
          style={{
            color: step.color,
            fontFamily: 'var(--font-data)',
            fontSize: 12,
            fontWeight: 700
          }}
        >
          {step.label}
        </div>
        <p
          style={{
            margin: '5px 0 0',
            color: 'var(--nv-text-secondary)',
            fontSize: 12,
            lineHeight: 1.5
          }}
        >
          {mode === 'live' && hasLiveData
            ? `${step.explanation} NetVis will use matching packets from your current capture when available.`
            : step.explanation}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Button
          size="sm"
          variant="outline"
          disabled={stepIndex === 0}
          onClick={() => {
            setIsPlaying(false)
            setStepIndex((current) => Math.max(0, current - 1))
          }}
          aria-label="Previous animation step"
        >
          <SkipBack size={14} aria-hidden />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsPlaying((current) => !current)}
          aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
        >
          {isPlaying ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={stepIndex === definition.steps.length - 1}
          onClick={() => {
            setIsPlaying(false)
            setStepIndex((current) => Math.min(definition.steps.length - 1, current + 1))
          }}
          aria-label="Next animation step"
        >
          <SkipForward size={14} aria-hidden />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setIsPlaying(false)
            setStepIndex(0)
          }}
          aria-label="Restart animation"
        >
          <RotateCcw size={14} aria-hidden />
        </Button>
        <span
          style={{ color: 'var(--nv-text-tertiary)', fontFamily: 'var(--font-data)', fontSize: 12 }}
        >
          {safeStepIndex + 1}/{definition.steps.length}
        </span>
        <Button size="sm" variant="ghost" onClick={goLive} style={{ marginLeft: 'auto' }}>
          See This In Capture
          <ArrowRight size={14} aria-hidden />
        </Button>
      </div>
    </section>
  )
}
