import type React from 'react'
import { useNetVisStore } from '../store'
import type { AnonPacket, ProtocolName } from '../../../shared/capture-types'
import { PROTOCOL_COLORS, protocolColorKey } from '../constants/protocol-colors'
import { PhasePlaceholder } from './PhasePlaceholder'

// ─── OSI Layer definitions ────────────────────────────────────────────────────

interface OsiLayerDef {
    number: number
    name: string
    /** Protocol names that map to this OSI layer */
    protocols: ProtocolName[]
}

const OSI_LAYERS: OsiLayerDef[] = [
    { number: 7, name: 'Application', protocols: ['DNS'] },
    { number: 6, name: 'Presentation', protocols: [] },
    { number: 5, name: 'Session', protocols: [] },
    { number: 4, name: 'Transport', protocols: ['TCP', 'UDP'] },
    { number: 3, name: 'Network', protocols: ['IPv4', 'IPv6', 'ICMP'] },
    { number: 2, name: 'Data Link', protocols: ['ARP', 'OTHER'] },
    { number: 1, name: 'Physical', protocols: [] },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the set of OSI layer numbers that are active for a given packet,
 * along with the dominant protocol color for each active layer.
 */
function getActiveLayers(
    packet: AnonPacket
): Map<number, { color: string; protocol: ProtocolName }> {
    const active = new Map<number, { color: string; protocol: ProtocolName }>()

    for (const layer of packet.layers) {
        for (const osiLayer of OSI_LAYERS) {
            if (osiLayer.protocols.includes(layer.protocol)) {
                // First match wins for color (innermost protocol takes precedence)
                if (!active.has(osiLayer.number)) {
                    const key = protocolColorKey(layer.protocol)
                    active.set(osiLayer.number, {
                        color: PROTOCOL_COLORS[key].color,
                        protocol: layer.protocol
                    })
                }
            }
        }
    }

    // Physical layer is always considered active when any packet is present
    if (packet.layers.length > 0) {
        active.set(1, { color: PROTOCOL_COLORS['OTHER'].color, protocol: 'OTHER' })
    }

    return active
}

// ─── OsiLayerRow ──────────────────────────────────────────────────────────────

interface OsiLayerRowProps {
    layer: OsiLayerDef
    isActive: boolean
    activeColor: string | null
    activeProtocol: ProtocolName | null
    onActivate: () => void
}

function OsiLayerRow({
    layer,
    isActive,
    activeColor,
    activeProtocol,
    onActivate
}: OsiLayerRowProps): React.JSX.Element {
    const handleKeyDown = (e: React.KeyboardEvent): void => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (isActive) onActivate()
        }
    }

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={`Layer ${layer.number}: ${layer.name}${isActive ? ` — ${activeProtocol ?? 'active'}` : ' — inactive'}`}
            aria-pressed={isActive}
            onClick={() => isActive && onActivate()}
            onKeyDown={handleKeyDown}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 6,
                border: `1px solid ${isActive ? (activeColor ?? 'var(--nv-border-default)') : 'var(--nv-border-subtle)'}`,
                backgroundColor: isActive
                    ? `${activeColor}1a` // 10% opacity tint
                    : 'var(--nv-bg-surface-2)',
                opacity: isActive ? 1 : 0.35,
                cursor: isActive ? 'pointer' : 'default',
                outline: 'none',
                transition: 'opacity 150ms ease, border-color 150ms ease, background-color 150ms ease',
                userSelect: 'none'
            }}
            className="nv-focus"
        >
            {/* Layer number badge */}
            <span
                aria-hidden
                style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontFamily: 'var(--font-data)',
                    fontWeight: 700,
                    flexShrink: 0,
                    backgroundColor: isActive ? (activeColor ?? 'var(--nv-border-default)') : 'var(--nv-border-subtle)',
                    color: isActive ? '#fff' : 'var(--nv-text-tertiary)'
                }}
            >
                {layer.number}
            </span>

            {/* Layer name */}
            <span
                style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--nv-text-primary)' : 'var(--nv-text-tertiary)',
                    flex: 1
                }}
            >
                {layer.name}
            </span>

            {/* Active protocol badge */}
            {isActive && activeProtocol && (
                <span
                    style={{
                        fontFamily: 'var(--font-data)',
                        fontSize: 10,
                        fontWeight: 600,
                        color: activeColor ?? 'var(--nv-text-secondary)',
                        letterSpacing: '0.04em'
                    }}
                >
                    {activeProtocol}
                </span>
            )}
        </div>
    )
}

// ─── OSILayerDiagram ──────────────────────────────────────────────────────────

declare const __VITE_PHASE__: number

/**
 * OSI Layer Diagram — maps a selected packet's decoded protocol headers onto
 * the 7-layer OSI model, visually indicating which layers are present.
 *
 * Req 26.1–26.7, 30.2, 30.4
 * - Vertical stack of 7 labeled layer boxes
 * - Active layers use PROTOCOL_COLORS tint; inactive at opacity 0.3
 * - Click active layer → expand corresponding PDI node via store.selectPacket
 * - Placeholder when no packet selected (Req 26.7)
 * - Keyboard nav: Tab between layers, Enter to activate
 * - Renders PhasePlaceholder when VITE_PHASE < 2
 */
export function OSILayerDiagram(): React.JSX.Element {
    if (__VITE_PHASE__ < 2) {
        return <PhasePlaceholder componentName="OSI Layer Diagram" />
    }

    return <OSILayerDiagramInner />
}

function OSILayerDiagramInner(): React.JSX.Element {
    const selectedPacketId = useNetVisStore((s) => s.selectedPacketId)
    const packets = useNetVisStore((s) => s.packets)
    const selectPacket = useNetVisStore((s) => s.selectPacket)

    const packet = selectedPacketId != null ? packets.find((p) => p.id === selectedPacketId) : null
    const activeLayers = packet ? getActiveLayers(packet) : new Map()

    const handleLayerActivate = (layerNumber: number): void => {
        // Re-select the packet to trigger PDI scroll/expand for the relevant layer
        if (selectedPacketId) {
            selectPacket(null)
            // Small delay so PDI re-mounts and scrolls to top
            setTimeout(() => selectPacket(selectedPacketId), 50)
        }
        // Suppress unused warning — layerNumber used for future PDI deep-link
        void layerNumber
    }

    return (
        <div
            aria-label="OSI Layer Diagram"
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: '8px 0'
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 12px 6px',
                    borderBottom: '1px solid var(--nv-border-subtle)',
                    marginBottom: 4
                }}
            >
                <span
                    style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: 11,
                        fontWeight: 500,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        color: 'var(--nv-text-tertiary)'
                    }}
                >
                    OSI Model
                </span>
                {packet && (
                    <span
                        style={{
                            fontFamily: 'var(--font-data)',
                            fontSize: 10,
                            color: 'var(--nv-text-tertiary)'
                        }}
                    >
                        {activeLayers.size} layer{activeLayers.size !== 1 ? 's' : ''} active
                    </span>
                )}
            </div>

            {/* Layer stack — top = layer 7, bottom = layer 1 */}
            <div
                role="list"
                aria-label="OSI layers"
                style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '0 8px' }}
            >
                {OSI_LAYERS.map((layer) => {
                    const activeInfo = activeLayers.get(layer.number)
                    return (
                        <div key={layer.number} role="listitem">
                            <OsiLayerRow
                                layer={layer}
                                isActive={activeInfo != null}
                                activeColor={activeInfo?.color ?? null}
                                activeProtocol={activeInfo?.protocol ?? null}
                                onActivate={() => handleLayerActivate(layer.number)}
                            />
                        </div>
                    )
                })}
            </div>

            {/* Placeholder when no packet selected (Req 26.7) */}
            {!packet && (
                <div
                    role="status"
                    aria-live="polite"
                    style={{
                        padding: '12px 12px 4px',
                        fontFamily: 'var(--font-ui)',
                        fontSize: 12,
                        color: 'var(--nv-text-tertiary)',
                        textAlign: 'center',
                        fontStyle: 'italic'
                    }}
                >
                    Select a packet to see its OSI layers
                </div>
            )}
        </div>
    )
}
