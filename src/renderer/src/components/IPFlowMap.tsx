import type React from 'react'
import { useEffect, useRef, useMemo, useCallback } from 'react'
import * as d3 from 'd3'
import { useNetVisStore } from '../store'
import { PROTOCOL_COLORS, protocolColorKey } from '../constants/protocol-colors'
import { PhasePlaceholder } from './PhasePlaceholder'
import { buildFlowGraph, buildNodeFilter, buildEdgeFilter } from './ip-flow-utils'

// ─── D3 simulation types ──────────────────────────────────────────────────────

interface SimNode extends d3.SimulationNodeDatum {
    id: string
    packetCount: number
    dominantProtocol: string
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
    id: string
    packetCount: number
    dominantProtocol: string
}

// ─── IPFlowMap ────────────────────────────────────────────────────────────────

declare const __VITE_PHASE__: number

/**
 * IP Flow Map — node-link diagram showing communication relationships between
 * IP addresses observed in the Packet_Buffer.
 *
 * React renders structure; D3 animates positions (no React setState on tick).
 * Req 27.1–27.7, 30.2, 30.4
 */
export function IPFlowMap(): React.JSX.Element {
    if (__VITE_PHASE__ < 2) {
        return <PhasePlaceholder componentName="IP Flow Map" />
    }

    return <IPFlowMapInner />
}

const WIDTH = 480
const HEIGHT = 320
const NODE_RADIUS = 18
const MAX_NODES = 50 // cap for performance

function IPFlowMapInner(): React.JSX.Element {
    const filteredPackets = useNetVisStore((s) => s.filteredPackets)
    const setFilter = useNetVisStore((s) => s.setFilter)

    const svgRef = useRef<SVGSVGElement>(null)
    const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null)
    const nodesGRef = useRef<SVGGElement | null>(null)
    const linksGRef = useRef<SVGGElement | null>(null)

    const graph = useMemo(() => buildFlowGraph(filteredPackets), [filteredPackets])

    // Limit nodes for performance
    const displayNodes = useMemo(
        () => graph.nodes.slice(0, MAX_NODES),
        [graph.nodes]
    )
    const displayNodeIds = useMemo(
        () => new Set(displayNodes.map((n) => n.id)),
        [displayNodes]
    )
    const displayEdges = useMemo(
        () => graph.edges.filter((e) => displayNodeIds.has(e.source) && displayNodeIds.has(e.target)),
        [graph.edges, displayNodeIds]
    )

    const handleNodeClick = useCallback(
        (ip: string) => {
            setFilter(buildNodeFilter(ip))
        },
        [setFilter]
    )

    const handleEdgeClick = useCallback(
        (src: string, dst: string) => {
            setFilter(buildEdgeFilter(src, dst))
        },
        [setFilter]
    )

    useEffect(() => {
        const svg = svgRef.current
        if (!svg) return

        // Stop previous simulation
        simulationRef.current?.stop()

        if (displayNodes.length === 0) return

        // Build sim nodes/links with copies so D3 can mutate x/y
        const simNodes: SimNode[] = displayNodes.map((n) => ({
            ...n,
            x: WIDTH / 2 + (Math.random() - 0.5) * 100,
            y: HEIGHT / 2 + (Math.random() - 0.5) * 100,
        }))

        const nodeById = new Map(simNodes.map((n) => [n.id, n]))

        const simLinks: SimLink[] = displayEdges
            .map((e) => ({
                id: e.id,
                source: nodeById.get(e.source) ?? e.source,
                target: nodeById.get(e.target) ?? e.target,
                packetCount: e.packetCount,
                dominantProtocol: e.dominantProtocol,
            }))
            .filter((l) => typeof l.source === 'object' && typeof l.target === 'object')

        // ── Render static structure via React-owned refs ──────────────────────────
        const linksG = linksGRef.current
        const nodesG = nodesGRef.current
        if (!linksG || !nodesG) return

        // Clear previous elements
        while (linksG.firstChild) linksG.removeChild(linksG.firstChild)
        while (nodesG.firstChild) nodesG.removeChild(nodesG.firstChild)

        // Render edges
        const linkEls: SVGLineElement[] = simLinks.map((link) => {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
            const color = PROTOCOL_COLORS[protocolColorKey(link.dominantProtocol)].color
            line.setAttribute('stroke', color)
            line.setAttribute('stroke-opacity', '0.5')
            line.setAttribute('stroke-width', String(Math.min(1 + Math.log1p(link.packetCount), 4)))
            line.setAttribute('cursor', 'pointer')
            line.setAttribute('role', 'button')
            line.setAttribute('aria-label', `Flow: ${(link.source as SimNode).id} ↔ ${(link.target as SimNode).id}, ${link.packetCount} packets`)
            line.addEventListener('click', () => {
                handleEdgeClick((link.source as SimNode).id, (link.target as SimNode).id)
            })
            linksG.appendChild(line)
            return line
        })

        // Render nodes
        const nodeEls: { circle: SVGCircleElement; label: SVGTextElement }[] = simNodes.map((node) => {
            const color = PROTOCOL_COLORS[protocolColorKey(node.dominantProtocol)].color
            const r = Math.min(NODE_RADIUS, 8 + Math.log1p(node.packetCount) * 2)

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
            circle.setAttribute('r', String(r))
            circle.setAttribute('fill', color)
            circle.setAttribute('fill-opacity', '0.85')
            circle.setAttribute('stroke', color)
            circle.setAttribute('stroke-width', '1.5')
            circle.setAttribute('cursor', 'pointer')
            circle.setAttribute('role', 'button')
            circle.setAttribute('tabindex', '0')
            circle.setAttribute('aria-label', `IP: ${node.id}, ${node.packetCount} packets`)
            circle.addEventListener('click', () => handleNodeClick(node.id))
            circle.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleNodeClick(node.id)
                }
            })
            nodesG.appendChild(circle)

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
            text.setAttribute('text-anchor', 'middle')
            text.setAttribute('dominant-baseline', 'central')
            text.setAttribute('font-size', '8')
            text.setAttribute('font-family', 'var(--font-data)')
            text.setAttribute('fill', 'var(--nv-text-primary)')
            text.setAttribute('pointer-events', 'none')
            text.setAttribute('aria-hidden', 'true')
            // Show last octet or last segment for brevity
            const label = node.id.split('.').pop() ?? node.id.slice(-4)
            text.textContent = label
            nodesG.appendChild(text)

            return { circle, label: text }
        })

        // ── D3 force simulation — writes x/y directly to DOM ─────────────────────
        const simulation = d3
            .forceSimulation<SimNode>(simNodes)
            .force('link', d3.forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance(80).strength(0.5))
            .force('charge', d3.forceManyBody().strength(-120))
            .force('center', d3.forceCenter(WIDTH / 2, HEIGHT / 2))
            .force('collision', d3.forceCollide(NODE_RADIUS + 4))
            .on('tick', () => {
                // D3 writes positions directly to DOM — no React setState
                simLinks.forEach((link, i) => {
                    const src = link.source as SimNode
                    const tgt = link.target as SimNode
                    const el = linkEls[i]
                    if (!el) return
                    el.setAttribute('x1', String(src.x ?? 0))
                    el.setAttribute('y1', String(src.y ?? 0))
                    el.setAttribute('x2', String(tgt.x ?? 0))
                    el.setAttribute('y2', String(tgt.y ?? 0))
                })
                simNodes.forEach((node, i) => {
                    const els = nodeEls[i]
                    if (!els) return
                    const x = String(node.x ?? 0)
                    const y = String(node.y ?? 0)
                    els.circle.setAttribute('cx', x)
                    els.circle.setAttribute('cy', y)
                    els.label.setAttribute('x', x)
                    els.label.setAttribute('y', y)
                })
            })

        simulationRef.current = simulation

        return () => {
            simulation.stop()
        }
    }, [displayNodes, displayEdges, handleNodeClick, handleEdgeClick])

    // Placeholder when no IP packets (Req 27.6)
    if (graph.nodes.length === 0) {
        return (
            <div
                role="status"
                aria-label="IP Flow Map — no data"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 160,
                    borderRadius: 8,
                    border: '1px dashed var(--nv-border-subtle)',
                    backgroundColor: 'var(--nv-bg-surface-2)',
                    color: 'var(--nv-text-tertiary)',
                    fontFamily: 'var(--font-ui)',
                    fontSize: 12,
                }}
            >
                No IP flows yet
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 4px',
                }}
            >
                <span
                    style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: 11,
                        fontWeight: 500,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        color: 'var(--nv-text-tertiary)',
                    }}
                >
                    IP Flow Map
                </span>
                <span
                    style={{
                        fontFamily: 'var(--font-data)',
                        fontSize: 11,
                        color: 'var(--nv-text-tertiary)',
                    }}
                >
                    {graph.nodes.length} hosts · {graph.edges.length} flows
                    {graph.nodes.length > MAX_NODES && ` (showing ${MAX_NODES})`}
                </span>
            </div>

            {/* SVG canvas — React renders structure, D3 animates positions */}
            <svg
                ref={svgRef}
                width={WIDTH}
                height={HEIGHT}
                aria-hidden="true"
                style={{
                    width: '100%',
                    height: HEIGHT,
                    borderRadius: 8,
                    border: '1px solid var(--nv-border-subtle)',
                    backgroundColor: 'var(--nv-bg-surface-2)',
                    overflow: 'hidden',
                }}
            >
                <g ref={linksGRef} />
                <g ref={nodesGRef} />
            </svg>

            {/* Accessible table alternative (Req 27.7) */}
            <details style={{ marginTop: 4 }}>
                <summary
                    style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: 11,
                        color: 'var(--nv-text-tertiary)',
                        cursor: 'pointer',
                        userSelect: 'none',
                    }}
                >
                    Show data table
                </summary>
                <div style={{ overflowX: 'auto', marginTop: 6 }}>
                    <table
                        aria-label="IP flow data"
                        style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontFamily: 'var(--font-data)',
                            fontSize: 10,
                        }}
                    >
                        <thead>
                            <tr>
                                {['Source', 'Destination', 'Packets', 'Protocol'].map((h) => (
                                    <th
                                        key={h}
                                        scope="col"
                                        style={{
                                            textAlign: 'left',
                                            padding: '2px 6px',
                                            color: 'var(--nv-text-tertiary)',
                                            fontWeight: 600,
                                            borderBottom: '1px solid var(--nv-border-subtle)',
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {displayEdges.map((edge, index) => (
                                <tr
                                    key={edge.id}
                                    style={{
                                        cursor: 'pointer',
                                        borderBottom: index < displayEdges.length - 1 ? '1px solid var(--nv-border-subtle)' : 'none'
                                    }}
                                    onClick={() => handleEdgeClick(edge.source, edge.target)}
                                >
                                    <td style={{ padding: '2px 6px', color: 'var(--nv-text-secondary)' }}>{edge.source}</td>
                                    <td style={{ padding: '2px 6px', color: 'var(--nv-text-secondary)' }}>{edge.target}</td>
                                    <td style={{ padding: '2px 6px', color: 'var(--nv-text-secondary)' }}>{edge.packetCount}</td>
                                    <td style={{ padding: '2px 6px', color: PROTOCOL_COLORS[protocolColorKey(edge.dominantProtocol)].color }}>{edge.dominantProtocol}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </details>
        </div>
    )
}
