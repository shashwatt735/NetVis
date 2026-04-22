/**
 * Filter Engine — Evaluator
 * Evaluates a FilterAST against an AnonPacket. Read-only — never mutates the buffer (Req 9.5).
 */

import type { FilterAST, PredicateNode, Comparator } from './parser'
import type { AnonPacket } from '../../shared/capture-types'

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Evaluate a FilterAST against a single packet.
 * Returns true if the packet matches, false otherwise.
 * INVARIANT: never mutates the packet or any shared state.
 */
export function evaluate(ast: FilterAST, packet: AnonPacket): boolean {
  switch (ast.kind) {
    case 'match-all':
      return true
    case 'predicate':
      return evaluatePredicate(ast, packet)
    case 'not':
      return !evaluate(ast.operand, packet)
    case 'binary':
      if (ast.op === 'AND') {
        return evaluate(ast.left, packet) && evaluate(ast.right, packet)
      }
      // OR
      return evaluate(ast.left, packet) || evaluate(ast.right, packet)
  }
}

// ─── Predicate Evaluation ─────────────────────────────────────────────────────

function evaluatePredicate(node: PredicateNode, packet: AnonPacket): boolean {
  switch (node.field) {
    case 'proto':
      return compareStrings(packet.protocol, node.comparator, String(node.value))

    case 'src':
      return compareStrings(packet.srcAddress, node.comparator, String(node.value))

    case 'dst':
      return compareStrings(packet.dstAddress, node.comparator, String(node.value))

    case 'port': {
      const portValue =
        typeof node.value === 'number' ? node.value : parseInt(String(node.value), 10)
      if (isNaN(portValue)) return false
      // Check any layer for srcPort or dstPort matching
      return packet.layers.some((layer) =>
        layer.fields.some((field) => {
          if (field.name !== 'srcPort' && field.name !== 'dstPort') return false
          const fieldPort =
            typeof field.value === 'number' ? field.value : parseInt(String(field.value), 10)
          return compareNumbers(fieldPort, node.comparator, portValue)
        })
      )
    }

    case 'len': {
      const lenValue =
        typeof node.value === 'number' ? node.value : parseInt(String(node.value), 10)
      if (isNaN(lenValue)) return false
      return compareNumbers(packet.length, node.comparator, lenValue)
    }

    case 'ts': {
      const tsValue = typeof node.value === 'number' ? node.value : Number(String(node.value))
      if (isNaN(tsValue)) return false
      return compareNumbers(packet.timestamp, node.comparator, tsValue)
    }
  }
}

// ─── Comparison Helpers ───────────────────────────────────────────────────────

function compareStrings(actual: string, op: Comparator, expected: string): boolean {
  const a = actual.toUpperCase()
  const b = expected.toUpperCase()
  switch (op) {
    case '==':
      return a === b
    case '!=':
      return a !== b
    case '>':
      return a > b
    case '<':
      return a < b
    case '>=':
      return a >= b
    case '<=':
      return a <= b
  }
}

function compareNumbers(actual: number, op: Comparator, expected: number): boolean {
  switch (op) {
    case '==':
      return actual === expected
    case '!=':
      return actual !== expected
    case '>':
      return actual > expected
    case '<':
      return actual < expected
    case '>=':
      return actual >= expected
    case '<=':
      return actual <= expected
  }
}
