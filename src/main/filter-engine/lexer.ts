/**
 * Filter Engine — Lexer
 * Single-pass tokenizer for the Filter_Grammar (Req 9.1).
 *
 * Grammar terminals:
 *   field       ::= "proto" | "src" | "dst" | "port" | "len" | "ts"
 *   comparator  ::= "==" | "!=" | ">" | "<" | ">=" | "<="
 *   value       ::= quoted-string | number | ip-address | protocol-name
 *   keyword     ::= "AND" | "OR" | "NOT"
 */

export type TokenType =
  | 'FIELD'
  | 'COMPARATOR'
  | 'STRING'
  | 'NUMBER'
  | 'KEYWORD'
  | 'LPAREN'
  | 'RPAREN'
  | 'EOF'
  | 'UNKNOWN'

export interface Token {
  type: TokenType
  value: string
  position: number
}

const FIELDS = new Set(['proto', 'src', 'dst', 'port', 'len', 'ts'])
const KEYWORDS = new Set(['AND', 'OR', 'NOT'])
const COMPARATORS = new Set(['==', '!=', '>=', '<=', '>', '<'])

/**
 * Tokenize a filter expression string into a Token[].
 * Never throws — unknown characters produce UNKNOWN tokens.
 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let pos = 0

  while (pos < input.length) {
    // Skip whitespace
    if (/\s/.test(input[pos]!)) {
      pos++
      continue
    }

    // Parentheses
    if (input[pos] === '(') {
      tokens.push({ type: 'LPAREN', value: '(', position: pos })
      pos++
      continue
    }
    if (input[pos] === ')') {
      tokens.push({ type: 'RPAREN', value: ')', position: pos })
      pos++
      continue
    }

    // Two-char comparators first
    const twoChar = input.slice(pos, pos + 2)
    if (COMPARATORS.has(twoChar)) {
      tokens.push({ type: 'COMPARATOR', value: twoChar, position: pos })
      pos += 2
      continue
    }

    // Single-char comparators
    const oneChar = input[pos]!
    if (oneChar === '>' || oneChar === '<') {
      tokens.push({ type: 'COMPARATOR', value: oneChar, position: pos })
      pos++
      continue
    }

    // Quoted string
    if (input[pos] === '"') {
      const start = pos
      pos++ // skip opening quote
      let str = ''
      while (pos < input.length && input[pos] !== '"') {
        str += input[pos]
        pos++
      }
      pos++ // skip closing quote (or EOF)
      tokens.push({ type: 'STRING', value: str, position: start })
      continue
    }

    // Number or identifier (field / keyword / protocol-name / ip-address)
    if (/[0-9a-zA-Z_.:[\]]/.test(input[pos]!)) {
      const start = pos
      let word = ''
      while (pos < input.length && /[0-9a-zA-Z_.:\-[\]]/.test(input[pos]!)) {
        word += input[pos]
        pos++
      }

      // Classify the word
      if (KEYWORDS.has(word.toUpperCase())) {
        tokens.push({ type: 'KEYWORD', value: word.toUpperCase(), position: start })
      } else if (FIELDS.has(word.toLowerCase())) {
        tokens.push({ type: 'FIELD', value: word.toLowerCase(), position: start })
      } else if (/^\d+(\.\d+)?$/.test(word)) {
        tokens.push({ type: 'NUMBER', value: word, position: start })
      } else {
        // protocol-name, ip-address, or bare string value
        tokens.push({ type: 'STRING', value: word, position: start })
      }
      continue
    }

    // Unknown character
    tokens.push({ type: 'UNKNOWN', value: input[pos]!, position: pos })
    pos++
  }

  tokens.push({ type: 'EOF', value: '', position: pos })
  return tokens
}
