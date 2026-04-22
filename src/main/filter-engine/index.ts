/**
 * Filter Engine — public interface.
 * Exports parse() and evaluate() for use in IPC handlers.
 */

export { tokenize } from './lexer'
export type { Token, TokenType } from './lexer'
export { parse } from './parser'
export type { FilterAST, ParseResult, FieldName, Comparator, LogicalOp } from './parser'
export { evaluate } from './evaluator'
