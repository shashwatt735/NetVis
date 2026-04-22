import { useCallback, useRef, useState } from 'react'
import type React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useNetVisStore } from '../store'
import type { AnonPacket, ParsedField, ParsedLayer } from '../../../shared/capture-types'
import { PROTOCOL_COLORS, protocolColorKey } from '../constants/protocol-colors'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import { ScrollArea } from './ui/scroll-area'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatValue(value: string | number): string {
  if (typeof value === 'number') return String(value)
  return value
}

// ─── HexStrip ─────────────────────────────────────────────────────────────────

interface HexStripProps {
  packet: AnonPacket
  hoveredField: { offset: number; length: number } | null
}

/**
 * Hex dump strip at the bottom of the inspector.
 * Highlights byte range on field hover/focus (Req 23.5).
 */
function HexStrip({ packet, hoveredField }: HexStripProps): React.JSX.Element {
  const totalBytes = packet.wireLength
  const BYTES_PER_ROW = 16

  const rows: number[][] = []
  for (let i = 0; i < Math.min(totalBytes, 256); i += BYTES_PER_ROW) {
    rows.push(Array.from({ length: Math.min(BYTES_PER_ROW, totalBytes - i) }, (_, j) => i + j))
  }

  const isHighlighted = (byteIndex: number): boolean => {
    if (!hoveredField) return false
    return byteIndex >= hoveredField.offset && byteIndex < hoveredField.offset + hoveredField.length
  }

  return (
    <div
      aria-label="Hex byte strip"
      style={{
        borderTop: '1px solid var(--nv-border-subtle)',
        padding: '8px 12px',
        backgroundColor: 'var(--nv-bg-surface-2)',
        flexShrink: 0
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontFamily: 'var(--font-ui)',
          fontWeight: 500,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--nv-text-tertiary)',
          marginBottom: 4
        }}
      >
        Byte positions · {totalBytes > 256 ? `first 256 of ${totalBytes}` : totalBytes} bytes
        {totalBytes > 0 && (
          <span style={{ marginLeft: 6, fontWeight: 400, opacity: 0.7 }}>(values anonymized)</span>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        {rows.map((row, rowIdx) => (
          <div
            key={rowIdx}
            style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 1 }}
          >
            <span
              style={{
                fontFamily: 'var(--font-data)',
                fontSize: 10,
                color: 'var(--nv-text-tertiary)',
                width: 28,
                flexShrink: 0
              }}
            >
              {(rowIdx * BYTES_PER_ROW).toString(16).padStart(4, '0')}
            </span>
            {row.map((byteIndex) => (
              <span
                key={byteIndex}
                style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: 10,
                  width: 18,
                  textAlign: 'center',
                  borderRadius: 2,
                  backgroundColor: isHighlighted(byteIndex)
                    ? 'rgba(59,130,246,0.3)'
                    : 'transparent',
                  color: isHighlighted(byteIndex) ? 'var(--proto-tcp)' : 'var(--nv-text-secondary)',
                  transition: 'background-color 80ms ease'
                }}
              >
                --
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── FieldRow ─────────────────────────────────────────────────────────────────

interface FieldRowProps {
  field: ParsedField
  depth: number
  onHover: (field: { offset: number; length: number } | null) => void
}

/**
 * Interactive field row — focusable, tabbable, wires hover/focus to hex strip.
 * Req 23.5: byte-range highlighting on hover/focus.
 */
function FieldRow({ field, depth, onHover }: FieldRowProps): React.JSX.Element {
  return (
    <div
      tabIndex={0}
      aria-label={`${field.label}: ${formatValue(field.value)}`}
      onMouseEnter={() => onHover({ offset: field.byteOffset, length: field.byteLength })}
      onFocus={() => onHover({ offset: field.byteOffset, length: field.byteLength })}
      onMouseLeave={() => onHover(null)}
      onBlur={() => onHover(null)}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 60px',
        alignItems: 'center',
        gap: 8,
        padding: `3px 12px 3px ${12 + depth * 16}px`,
        borderBottom: '1px solid var(--nv-border-subtle)',
        outline: 'none',
        cursor: 'default'
      }}
      className="nv-focus"
    >
      <span style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--nv-text-secondary)' }}>
        {field.label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-data)',
          fontSize: 12,
          color: 'var(--nv-text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {formatValue(field.value)}
      </span>
      <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--nv-text-tertiary)', textAlign: 'right' }}>
        +{field.byteOffset}
      </span>
    </div>
  )
}

// ─── LayerSection ─────────────────────────────────────────────────────────────

interface LayerSectionProps {
  layer: ParsedLayer
  depth: number
  defaultOpen?: boolean
  onHover: (field: { offset: number; length: number } | null) => void
}

/**
 * Collapsible protocol layer section.
 * Uses ui/collapsible wrapper directly so field rows can wire hover state.
 * Trigger styled to match InspectorSection visual pattern from domain layer.
 */
function LayerSection({ layer, depth, defaultOpen = true, onHover }: LayerSectionProps): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen)
  const key = protocolColorKey(layer.protocol)
  const color = PROTOCOL_COLORS[key].color
  const dim = PROTOCOL_COLORS[key].dim

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setOpen(true) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setOpen(false) }
  }, [])

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        aria-expanded={open}
        onKeyDown={handleKeyDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          padding: `5px 12px 5px ${12 + depth * 16}px`,
          backgroundColor: dim,
          borderBottom: '1px solid var(--nv-border-subtle)',
          borderLeft: `3px solid ${color}`,
          cursor: 'pointer',
          outline: 'none',
          textAlign: 'left',
          borderRadius: 0
        }}
        className="nv-focus"
      >
        <span
          aria-hidden
          style={{
            fontSize: 10,
            color,
            transition: 'transform 150ms ease',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            display: 'inline-block'
          }}
        >
          ▶
        </span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color }}>
          {layer.protocol}
        </span>
        {layer.error && (
          <span role="alert" style={{ fontSize: 10, color: 'var(--nv-status-error)', fontFamily: 'var(--font-ui)', marginLeft: 4 }}>
            ⚠ {layer.error}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--nv-text-tertiary)', fontFamily: 'var(--font-data)' }}>
          {layer.rawByteLength}B @ +{layer.rawByteOffset}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div>
          {layer.fields.map((field, i) => (
            <FieldRow key={`${field.name}-${i}`} field={field} depth={depth + 1} onHover={onHover} />
          ))}
          {layer.fields.length === 0 && (
            <div style={{ padding: `4px 12px 4px ${12 + (depth + 1) * 16}px`, fontSize: 11, fontFamily: 'var(--font-ui)', color: 'var(--nv-text-tertiary)', fontStyle: 'italic' }}>
              No fields decoded
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─── PacketDetailInspector ────────────────────────────────────────────────────

/**
 * Layered protocol tree panel for a selected packet.
 * Req 23.1–23.6, 16.1, 16.3, 21.3
 * - Radix Collapsible per layer, colored by PROTOCOL_COLORS
 * - Hex strip highlights byte range on field hover/focus (Req 23.5)
 * - Slide-in animation via motion/react AnimatePresence
 * - Keyboard: ArrowLeft/Right expand/collapse, Tab between fields
 * - Layer and field content exposed via labeled groups instead of incomplete grid semantics
 */
export function PacketDetailInspector(): React.JSX.Element {
  const selectedPacketId = useNetVisStore((s) => s.selectedPacketId)
  const packets = useNetVisStore((s) => s.packets)

  const [hoveredField, setHoveredField] = useState<{ offset: number; length: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const packet: AnonPacket | undefined =
    selectedPacketId != null ? packets.find((p) => p.id === selectedPacketId) : undefined

  return (
    <AnimatePresence>
      {packet != null && (
        <motion.div
          key={packet.id}
          ref={panelRef}
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: 'var(--nv-bg-surface-1)',
            borderLeft: '1px solid var(--nv-border-subtle)',
            overflow: 'hidden'
          }}
          aria-label="Packet detail inspector"
        >
          {/* Panel header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 12px',
              borderBottom: '1px solid var(--nv-border-default)',
              flexShrink: 0,
              backgroundColor: 'var(--nv-bg-surface-2)'
            }}
          >
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--nv-text-tertiary)' }}>
              Packet Inspector
            </span>
            <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--nv-text-tertiary)' }}>
              {packet.wireLength}B · {new Date(packet.timestamp).toISOString().slice(11, 23)}
            </span>
          </div>

          {/* Layer tree */}
          <ScrollArea style={{ flex: 1, minHeight: 0 }}>
            <div aria-label="Protocol layers">
              {packet.layers.map((layer, i) => (
                <LayerSection
                  key={`${layer.protocol}-${i}`}
                  layer={layer}
                  depth={i}
                  defaultOpen={i === 0}
                  onHover={setHoveredField}
                />
              ))}
            </div>
          </ScrollArea>

          {/* Hex strip — highlights byte range on field hover/focus (Req 23.5) */}
          <HexStrip packet={packet} hoveredField={hoveredField} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
