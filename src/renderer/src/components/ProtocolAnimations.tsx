import type React from 'react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNetVisStore } from '../store'
import type { AnonPacket } from '../../../shared/capture-types'
import { PhasePlaceholder } from './PhasePlaceholder'

// ─── Animation step types ─────────────────────────────────────────────────────

export interface AnimationStep {
    /** Unique step index within the animation */
    index: number
    /** Human-readable description announced via aria-live */
    description: string
    /** Direction of the packet envelope: left-to-right or right-to-left */
    direction: 'ltr' | 'rtl'
    /** Label shown on the packet envelope */
    label: string
    /** Color for the envelope (hex) */
    color: string
    /**
     * Predicate to find a matching real packet in the store.
     * Used to highlight the corresponding row in Packet_List (Req 29.3).
     */
    matchPacket?: (p: AnonPacket) => boolean
}

export interface AnimationDef {
    id: string
    title: string
    description: string
    steps: AnimationStep[]
}

// ─── Animation definitions ────────────────────────────────────────────────────

export const ANIMATIONS: AnimationDef[] = [
    {
        id: 'tcp-handshake',
        title: 'TCP Three-Way Handshake',
        description:
            'The TCP handshake establishes a reliable connection between client and server using three messages: SYN, SYN-ACK, and ACK.',
        steps: [
            {
                index: 0,
                description: 'Step 1 of 3: Client sends SYN — initiates connection request.',
                direction: 'ltr',
                label: 'SYN',
                color: '#3B82F6',
                matchPacket: (p) =>
                    p.protocol === 'TCP' &&
                    p.layers.some((l) =>
                        l.fields.some(
                            (f) => f.name === 'flags' && String(f.value).includes('SYN') && !String(f.value).includes('ACK')
                        )
                    ),
            },
            {
                index: 1,
                description: 'Step 2 of 3: Server replies with SYN-ACK — acknowledges and requests connection.',
                direction: 'rtl',
                label: 'SYN-ACK',
                color: '#10B981',
                matchPacket: (p) =>
                    p.protocol === 'TCP' &&
                    p.layers.some((l) =>
                        l.fields.some(
                            (f) => f.name === 'flags' && String(f.value).includes('SYN') && String(f.value).includes('ACK')
                        )
                    ),
            },
            {
                index: 2,
                description: 'Step 3 of 3: Client sends ACK — connection established.',
                direction: 'ltr',
                label: 'ACK',
                color: '#3B82F6',
                matchPacket: (p) =>
                    p.protocol === 'TCP' &&
                    p.layers.some((l) =>
                        l.fields.some(
                            (f) => f.name === 'flags' && String(f.value) === 'ACK'
                        )
                    ),
            },
        ],
    },
    {
        id: 'dns-query',
        title: 'DNS Query / Response',
        description:
            'DNS resolves human-readable domain names to IP addresses. The client sends a query; the server responds with the resolved address.',
        steps: [
            {
                index: 0,
                description: 'Step 1 of 2: Client sends DNS query — asks for the IP address of a domain.',
                direction: 'ltr',
                label: 'DNS Query',
                color: '#8B5CF6',
                matchPacket: (p) =>
                    p.protocol === 'DNS' &&
                    p.layers.some((l) =>
                        l.fields.some((f) => f.name === 'flags' && String(f.value).includes('query'))
                    ),
            },
            {
                index: 1,
                description: 'Step 2 of 2: Server sends DNS response — returns the resolved IP address.',
                direction: 'rtl',
                label: 'DNS Response',
                color: '#8B5CF6',
                matchPacket: (p) =>
                    p.protocol === 'DNS' &&
                    p.layers.some((l) =>
                        l.fields.some((f) => f.name === 'flags' && String(f.value).includes('response'))
                    ),
            },
        ],
    },
    {
        id: 'icmp-echo',
        title: 'ICMP Echo Request / Reply',
        description:
            'ICMP echo (ping) tests network reachability. The sender issues an Echo Request; the target replies with an Echo Reply.',
        steps: [
            {
                index: 0,
                description: 'Step 1 of 2: Sender issues ICMP Echo Request (ping).',
                direction: 'ltr',
                label: 'Echo Request',
                color: '#F59E0B',
                matchPacket: (p) =>
                    p.protocol === 'ICMP' &&
                    p.layers.some((l) =>
                        l.fields.some((f) => f.name === 'type' && (f.value === 8 || f.value === '8'))
                    ),
            },
            {
                index: 1,
                description: 'Step 2 of 2: Target replies with ICMP Echo Reply (pong).',
                direction: 'rtl',
                label: 'Echo Reply',
                color: '#F59E0B',
                matchPacket: (p) =>
                    p.protocol === 'ICMP' &&
                    p.layers.some((l) =>
                        l.fields.some((f) => f.name === 'type' && (f.value === 0 || f.value === '0'))
                    ),
            },
        ],
    },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Find the first real packet in the store that matches a step's predicate.
 * Returns the packet id or null.
 * Req 29.3
 */
export function findMatchingPacketId(
    packets: AnonPacket[],
    step: AnimationStep
): string | null {
    if (!step.matchPacket) return null
    const match = packets.find(step.matchPacket)
    return match?.id ?? null
}

// ─── PacketEnvelope — animated SVG element ────────────────────────────────────

interface PacketEnvelopeProps {
    step: AnimationStep
    /** 0 = at source, 1 = at destination */
    progress: number
    svgWidth: number
    svgHeight: number
}

const ENDPOINT_X_MARGIN = 60
const ENVELOPE_Y = 60

function PacketEnvelope({ step, progress, svgWidth, svgHeight }: PacketEnvelopeProps): React.JSX.Element {
    const startX = step.direction === 'ltr' ? ENDPOINT_X_MARGIN : svgWidth - ENDPOINT_X_MARGIN
    const endX = step.direction === 'ltr' ? svgWidth - ENDPOINT_X_MARGIN : ENDPOINT_X_MARGIN
    const x = startX + (endX - startX) * progress
    const y = svgHeight / 2

    return (
        <g transform={`translate(${x}, ${y})`} aria-hidden="true">
            {/* Envelope rectangle */}
            <rect
                x={-28}
                y={-12}
                width={56}
                height={24}
                rx={4}
                fill={step.color}
                fillOpacity={0.9}
                stroke={step.color}
                strokeWidth={1.5}
            />
            {/* Label */}
            <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={9}
                fontFamily="var(--font-data)"
                fontWeight={700}
                fill="#fff"
            >
                {step.label}
            </text>
        </g>
    )
    void ENVELOPE_Y
}

// ─── ProtocolAnimations ───────────────────────────────────────────────────────

declare const __VITE_PHASE__: number

/**
 * Protocol Animations — step-by-step animated walkthroughs of protocol exchanges.
 *
 * Three animations: TCP three-way handshake, DNS query/response, ICMP echo.
 * Playback controls: play/pause/step-forward/step-back/restart (Req 29.4).
 * Highlights matching real packet rows in Packet_List on each step (Req 29.3).
 * Each step announced via aria-live region (Req 29.6).
 * Renders PhasePlaceholder when VITE_PHASE < 2.
 *
 * Req 29.1–29.6, 30.2, 30.4
 */
export function ProtocolAnimations(): React.JSX.Element {
    if (__VITE_PHASE__ < 2) {
        return <PhasePlaceholder componentName="Protocol Animations" />
    }

    return <ProtocolAnimationsInner />
}

const SVG_WIDTH = 480
const SVG_HEIGHT = 120
const STEP_DURATION_MS = 1200
const REDUCED_MOTION_DURATION_MS = 0

function ProtocolAnimationsInner(): React.JSX.Element {
    const packets = useNetVisStore((s) => s.packets)
    const selectPacket = useNetVisStore((s) => s.selectPacket)

    const [activeAnimId, setActiveAnimId] = useState<string>(ANIMATIONS[0]!.id)
    const [stepIndex, setStepIndex] = useState(0)
    const [isPlaying, setIsPlaying] = useState(false)
    const [progress, setProgress] = useState(0)

    const animDef = ANIMATIONS.find((a) => a.id === activeAnimId) ?? ANIMATIONS[0]!
    const currentStep = animDef.steps[stepIndex] ?? animDef.steps[0]!

    // Detect reduced motion preference (Req 29.5)
    const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const stepDuration = prefersReducedMotion ? REDUCED_MOTION_DURATION_MS : STEP_DURATION_MS

    // Highlight matching real packet when step changes (Req 29.3)
    useEffect(() => {
        const matchId = findMatchingPacketId(packets, currentStep)
        if (matchId) {
            selectPacket(matchId)
        }
    }, [stepIndex, activeAnimId, packets, currentStep, selectPacket])

    // Animation loop
    const rafRef = useRef<number | null>(null)
    const startTimeRef = useRef<number | null>(null)

    const stopAnimation = useCallback(() => {
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = null
        }
        startTimeRef.current = null
    }, [])

    const advanceStep = useCallback(() => {
        setStepIndex((prev) => {
            const next = prev + 1
            if (next >= animDef.steps.length) {
                setIsPlaying(false)
                setProgress(1)
                return prev
            }
            setProgress(0)
            return next
        })
    }, [animDef.steps.length])

    useEffect(() => {
        if (!isPlaying) {
            stopAnimation()
            if (prefersReducedMotion) {
                setProgress(1)
            }
            return
        }

        if (prefersReducedMotion) {
            // Instant transition — skip animation
            setProgress(1)
            const timer = setTimeout(() => {
                advanceStep()
            }, 200)
            return () => clearTimeout(timer)
        }

        const animate = (timestamp: number) => {
            if (startTimeRef.current === null) startTimeRef.current = timestamp
            const elapsed = timestamp - startTimeRef.current
            const p = Math.min(elapsed / stepDuration, 1)
            setProgress(p)

            if (p < 1) {
                rafRef.current = requestAnimationFrame(animate)
            } else {
                // Step complete — advance after brief pause
                setTimeout(() => {
                    advanceStep()
                    startTimeRef.current = null
                }, 300)
            }
        }

        rafRef.current = requestAnimationFrame(animate)
        return stopAnimation
    }, [isPlaying, stepIndex, stepDuration, prefersReducedMotion, advanceStep, stopAnimation])

    // Reset when animation changes
    useEffect(() => {
        stopAnimation()
        setStepIndex(0)
        setProgress(0)
        setIsPlaying(false)
    }, [activeAnimId, stopAnimation])

    const handlePlay = () => {
        if (stepIndex >= animDef.steps.length - 1 && progress >= 1) {
            // Restart from beginning
            setStepIndex(0)
            setProgress(0)
        }
        setIsPlaying(true)
    }

    const handlePause = () => setIsPlaying(false)

    const handleStepForward = () => {
        stopAnimation()
        setIsPlaying(false)
        setProgress(1)
        setTimeout(() => {
            setStepIndex((prev) => Math.min(prev + 1, animDef.steps.length - 1))
            setProgress(0)
        }, 50)
    }

    const handleStepBack = () => {
        stopAnimation()
        setIsPlaying(false)
        setStepIndex((prev) => Math.max(prev - 1, 0))
        setProgress(0)
    }

    const handleRestart = () => {
        stopAnimation()
        setIsPlaying(false)
        setStepIndex(0)
        setProgress(0)
    }

    const isAtEnd = stepIndex >= animDef.steps.length - 1 && progress >= 1
    const isAtStart = stepIndex === 0 && progress === 0

    return (
        <div
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            aria-label="Protocol Animations"
        >
            {/* Animation selector */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ANIMATIONS.map((anim) => (
                    <button
                        key={anim.id}
                        onClick={() => setActiveAnimId(anim.id)}
                        aria-pressed={activeAnimId === anim.id}
                        style={{
                            padding: '4px 10px',
                            borderRadius: 4,
                            border: `1px solid ${activeAnimId === anim.id ? 'var(--nv-accent)' : 'var(--nv-border-default)'}`,
                            backgroundColor:
                                activeAnimId === anim.id ? 'var(--nv-accent-dim)' : 'var(--nv-bg-surface-2)',
                            color:
                                activeAnimId === anim.id ? 'var(--nv-accent)' : 'var(--nv-text-secondary)',
                            fontFamily: 'var(--font-ui)',
                            fontSize: 11,
                            fontWeight: activeAnimId === anim.id ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'all 150ms ease',
                        }}
                    >
                        {anim.title}
                    </button>
                ))}
            </div>

            {/* Description */}
            <p
                style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: 12,
                    color: 'var(--nv-text-secondary)',
                    margin: 0,
                    lineHeight: 1.5,
                }}
            >
                {animDef.description}
            </p>

            {/* SVG diagram */}
            <div style={{ position: 'relative' }}>
                <svg
                    width={SVG_WIDTH}
                    height={SVG_HEIGHT}
                    aria-hidden="true"
                    style={{
                        width: '100%',
                        height: SVG_HEIGHT,
                        borderRadius: 8,
                        border: '1px solid var(--nv-border-subtle)',
                        backgroundColor: 'var(--nv-bg-surface-2)',
                        overflow: 'hidden',
                    }}
                >
                    {/* Endpoint labels */}
                    <text
                        x={ENDPOINT_X_MARGIN}
                        y={SVG_HEIGHT / 2 - 28}
                        textAnchor="middle"
                        fontSize={10}
                        fontFamily="var(--font-ui)"
                        fontWeight={600}
                        fill="var(--nv-text-secondary)"
                    >
                        Client
                    </text>
                    <text
                        x={SVG_WIDTH - ENDPOINT_X_MARGIN}
                        y={SVG_HEIGHT / 2 - 28}
                        textAnchor="middle"
                        fontSize={10}
                        fontFamily="var(--font-ui)"
                        fontWeight={600}
                        fill="var(--nv-text-secondary)"
                    >
                        Server
                    </text>

                    {/* Endpoint circles */}
                    <circle
                        cx={ENDPOINT_X_MARGIN}
                        cy={SVG_HEIGHT / 2}
                        r={14}
                        fill="var(--nv-bg-surface-3, var(--nv-bg-surface-2))"
                        stroke="var(--nv-border-default)"
                        strokeWidth={1.5}
                    />
                    <circle
                        cx={SVG_WIDTH - ENDPOINT_X_MARGIN}
                        cy={SVG_HEIGHT / 2}
                        r={14}
                        fill="var(--nv-bg-surface-3, var(--nv-bg-surface-2))"
                        stroke="var(--nv-border-default)"
                        strokeWidth={1.5}
                    />

                    {/* Connection line */}
                    <line
                        x1={ENDPOINT_X_MARGIN + 14}
                        y1={SVG_HEIGHT / 2}
                        x2={SVG_WIDTH - ENDPOINT_X_MARGIN - 14}
                        y2={SVG_HEIGHT / 2}
                        stroke="var(--nv-border-subtle)"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                    />

                    {/* Step progress indicators */}
                    {animDef.steps.map((step, i) => (
                        <circle
                            key={step.index}
                            cx={ENDPOINT_X_MARGIN + ((SVG_WIDTH - ENDPOINT_X_MARGIN * 2) / (animDef.steps.length + 1)) * (i + 1)}
                            cy={SVG_HEIGHT - 16}
                            r={4}
                            fill={
                                i < stepIndex
                                    ? step.color
                                    : i === stepIndex
                                        ? step.color
                                        : 'var(--nv-border-subtle)'
                            }
                            fillOpacity={i <= stepIndex ? 1 : 0.4}
                        />
                    ))}

                    {/* Animated packet envelope */}
                    <PacketEnvelope
                        step={currentStep}
                        progress={progress}
                        svgWidth={SVG_WIDTH}
                        svgHeight={SVG_HEIGHT}
                    />
                </svg>
            </div>

            {/* Playback controls (Req 29.4) */}
            <div
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                role="toolbar"
                aria-label="Animation playback controls"
            >
                <button
                    onClick={handleRestart}
                    disabled={isAtStart && !isPlaying}
                    aria-label="Restart animation"
                    title="Restart"
                    style={controlButtonStyle(isAtStart && !isPlaying)}
                >
                    ⏮
                </button>
                <button
                    onClick={handleStepBack}
                    disabled={isAtStart}
                    aria-label="Step back"
                    title="Step back"
                    style={controlButtonStyle(isAtStart)}
                >
                    ◀
                </button>
                {isPlaying ? (
                    <button
                        onClick={handlePause}
                        aria-label="Pause animation"
                        title="Pause"
                        style={controlButtonStyle(false)}
                    >
                        ⏸
                    </button>
                ) : (
                    <button
                        onClick={handlePlay}
                        aria-label={isAtEnd ? 'Restart and play animation' : 'Play animation'}
                        title={isAtEnd ? 'Restart' : 'Play'}
                        style={controlButtonStyle(false)}
                    >
                        ▶
                    </button>
                )}
                <button
                    onClick={handleStepForward}
                    disabled={isAtEnd}
                    aria-label="Step forward"
                    title="Step forward"
                    style={controlButtonStyle(isAtEnd)}
                >
                    ▶
                </button>

                {/* Step counter */}
                <span
                    style={{
                        fontFamily: 'var(--font-data)',
                        fontSize: 11,
                        color: 'var(--nv-text-tertiary)',
                        marginLeft: 4,
                    }}
                >
                    Step {stepIndex + 1} / {animDef.steps.length}
                </span>
            </div>

            {/* aria-live region — announces each step (Req 29.6) */}
            <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: 12,
                    color: 'var(--nv-text-secondary)',
                    minHeight: 36,
                    padding: '6px 8px',
                    borderRadius: 4,
                    backgroundColor: 'var(--nv-bg-surface-2)',
                    border: '1px solid var(--nv-border-subtle)',
                }}
            >
                {currentStep.description}
            </div>
        </div>
    )
}

function controlButtonStyle(disabled: boolean): React.CSSProperties {
    return {
        padding: '4px 10px',
        borderRadius: 4,
        border: '1px solid var(--nv-border-default)',
        backgroundColor: 'var(--nv-bg-surface-2)',
        color: disabled ? 'var(--nv-text-tertiary)' : 'var(--nv-text-primary)',
        fontFamily: 'var(--font-ui)',
        fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'opacity 150ms ease',
    }
}
