/**
 * Filter Engine — Parser
 * Recursive descent parser for the Filter_Grammar (Req 9.1).
 *
 * Grammar:
 *   expression  ::= term ( ( "AND" | "OR" ) term )*
 *   term        ::= [ "NOT" ] predicate
 *   predicate   ::= field comparator value
 *                 | "(" expression ")"
 *   field       ::= "proto" | "src" | "dst" | "port" | "len" | "ts"
 *   comparator  ::= "==" | "!=" | ">" | "<" | ">=" | "<="
 *   value       ::= quoted-string | number | ip-address | protocol-name
 */

import { tokenize } from './lexer'
import type { Token } from './lexer'

// ─── AST Node Types ───────────────────────────────────────────────────────────

export type FieldName = 'proto' | 'src' | 'dst' | 'port' | 'len' | 'ts'
export type Comparator = '==' | '!=' | '>' | '<' | '>=' | '<='
export type LogicalOp = 'AND' | 'OR'

export interface PredicateNode {
  kind: 'predicate'
  field: FieldName
  comparator: Comparator
  value: string | number
}

export interface NotNode {
  kind: 'not'
  operand: FilterAST
}

export interface BinaryNode {
  kind: 'binary'
  op: LogicalOp
  left: FilterAST
  right: FilterAST
}

export interface MatchAllNode {
  kind: 'match-all'
}

export type FilterAST = PredicateNode | NotNode | BinaryNode | MatchAllNode

// ─── Parse Result ─────────────────────────────────────────────────────────────

export type ParseResult =
  | { ok: true; ast: FilterAST }
  | { ok: false; error: string; position: number }

// ─── Parser ───────────────────────────────────────────────────────────────────

class Parser {
  private tokens: Token[]
  private pos = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  private peek(): Token {
    return this.tokens[this.pos] ?? { type: 'EOF', value: '', position: -1 }
  }

  private consume(): Token {
    const t = this.peek()
    this.pos++
    return t
  }

  private expect(type: Token['type'], value?: string): Token {
    const t = this.peek()
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new ParseError(`Expected ${value ?? type} but got "${t.value}"`, t.position)
    }
    return this.consume()
  }

  parse(): FilterAST {
    const node = this.parseExpression()
    const next = this.peek()
    if (next.type !== 'EOF') {
      throw new ParseError(`Unexpected token "${next.value}"`, next.position)
    }
    return node
  }

  private parseExpression(): FilterAST {
    let left = this.parseTerm()

    while (
      this.peek().type === 'KEYWORD' &&
      (this.peek().value === 'AND' || this.peek().value === 'OR')
    ) {
      const op = this.consume().value as LogicalOp
      const right = this.parseTerm()
      left = { kind: 'binary', op, left, right }
    }

    return left
  }

  private parseTerm(): FilterAST {
    if (this.peek().type === 'KEYWORD' && this.peek().value === 'NOT') {
      this.consume() // consume NOT
      const operand = this.parsePredicate()
      return { kind: 'not', operand }
    }
    return this.parsePredicate()
  }

  private parsePredicate(): FilterAST {
    // Parenthesized sub-expression
    if (this.peek().type === 'LPAREN') {
      this.consume() // consume (
      const inner = this.parseExpression()
      this.expect('RPAREN')
      return inner
    }

    // field comparator value
    const fieldToken = this.peek()
    if (fieldToken.type !== 'FIELD') {
      throw new ParseError(
        `Expected a field name (proto, src, dst, port, len, ts) but got "${fieldToken.value}"`,
        fieldToken.position
      )
    }
    this.consume()
    const field = fieldToken.value as FieldName

    const compToken = this.peek()
    if (compToken.type !== 'COMPARATOR') {
      throw new ParseError(
        `Expected a comparator (==, !=, >, <, >=, <=) but got "${compToken.value}"`,
        compToken.position
      )
    }
    this.consume()
    const comparator = compToken.value as Comparator

    const valToken = this.peek()
    if (valToken.type !== 'STRING' && valToken.type !== 'NUMBER') {
      throw new ParseError(`Expected a value but got "${valToken.value}"`, valToken.position)
    }
    this.consume()
    const value: string | number =
      valToken.type === 'NUMBER' ? Number(valToken.value) : valToken.value

    return { kind: 'predicate', field, comparator, value }
  }
}

class ParseError extends Error {
  constructor(
    message: string,
    public readonly position: number
  ) {
    super(message)
    this.name = 'ParseError'
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a filter expression string into a FilterAST.
 * Returns { ok: true, ast } on success or { ok: false, error, position } on failure.
 * An empty expression returns a dedicated match-all node.
 */
export function parse(expression: string): ParseResult {
  const trimmed = expression.trim()
  if (!trimmed) {
    // Empty expression — match all packets
    return {
      ok: true,
      ast: { kind: 'match-all' }
    }
  }

  try {
    const tokens = tokenize(trimmed)

    // Check for UNKNOWN tokens before parsing
    const unknown = tokens.find((t) => t.type === 'UNKNOWN')
    if (unknown) {
      return {
        ok: false,
        error: `Unexpected character "${unknown.value}" at position ${unknown.position}`,
        position: unknown.position
      }
    }

    const parser = new Parser(tokens)
    const ast = parser.parse()
    return { ok: true, ast }
  } catch (err) {
    if (err instanceof ParseError) {
      return { ok: false, error: err.message, position: err.position }
    }
    return { ok: false, error: String(err), position: 0 }
  }
}
