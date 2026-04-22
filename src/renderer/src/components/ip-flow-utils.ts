/**
 * Utility functions for IPFlowMap.
 * Extracted to a separate file so IPFlowMap.tsx only exports
 * React components — required for Vite Fast Refresh compatibility.
 */

import type { AnonPacket } from '../../../shared/capture-types'

export interface FlowNode {
  id: string
  packetCount: number
  dominantProtocol: string
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  packetCount: number
  dominantProtocol: string
}

export interface FlowGraph {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

/**
 * Build a flow graph from a list of AnonPackets.
 * Nodes are unique IP addresses; edges are directed src→dst pairs.
 * Req 27.1, 27.2
 */
export function buildFlowGraph(packets: AnonPacket[]): FlowGraph {
  const nodeMap = new Map<string, { count: number; protoCounts: Map<string, number> }>()
  const edgeMap = new Map<string, { source: string; target: string; count: number; protoCounts: Map<string, number> }>()

  for (const pkt of packets) {
    const src = pkt.srcAddress
    const dst = pkt.dstAddress
    const proto = pkt.protocol

    if (!src || !dst || src === '' || dst === '') continue

    if (!nodeMap.has(src)) nodeMap.set(src, { count: 0, protoCounts: new Map() })
    const srcNode = nodeMap.get(src)!
    srcNode.count++
    srcNode.protoCounts.set(proto, (srcNode.protoCounts.get(proto) ?? 0) + 1)

    if (!nodeMap.has(dst)) nodeMap.set(dst, { count: 0, protoCounts: new Map() })
    const dstNode = nodeMap.get(dst)!
    dstNode.count++
    dstNode.protoCounts.set(proto, (dstNode.protoCounts.get(proto) ?? 0) + 1)

    const edgeId = `${src}→${dst}`
    if (!edgeMap.has(edgeId)) edgeMap.set(edgeId, { source: src, target: dst, count: 0, protoCounts: new Map() })
    const edge = edgeMap.get(edgeId)!
    edge.count++
    edge.protoCounts.set(proto, (edge.protoCounts.get(proto) ?? 0) + 1)
  }

  const dominantProto = (protoCounts: Map<string, number>): string => {
    let max = 0
    let dominant = 'OTHER'
    for (const [proto, count] of protoCounts) {
      if (count > max) { max = count; dominant = proto }
    }
    return dominant
  }

  return {
    nodes: Array.from(nodeMap.entries()).map(([id, data]) => ({
      id,
      packetCount: data.count,
      dominantProtocol: dominantProto(data.protoCounts)
    })),
    edges: Array.from(edgeMap.entries()).map(([id, data]) => ({
      id,
      source: data.source,
      target: data.target,
      packetCount: data.count,
      dominantProtocol: dominantProto(data.protoCounts)
    }))
  }
}

/**
 * Build a filter expression for a node click (Req 27.3).
 */
export function buildNodeFilter(ip: string): string {
  return `src == "${ip}" OR dst == "${ip}"`
}

/**
 * Build a filter expression for an edge click (Req 27.4).
 */
export function buildEdgeFilter(src: string, dst: string): string {
  return `(src == "${src}" AND dst == "${dst}") OR (src == "${dst}" AND dst == "${src}")`
}
