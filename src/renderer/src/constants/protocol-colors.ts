// Re-export from lib/proto-tokens — canonical source of truth
// lib/proto-tokens.ts is the authoritative TS source, kept in sync with theme.css
import { PROTO_COLORS } from '../lib/proto-tokens'
export { PROTO_COLORS as PROTOCOL_COLORS } from '../lib/proto-tokens'
export type { Protocol } from '../lib/proto-tokens'

/**
 * Helper to map protocol names to PROTOCOL_COLORS keys.
 * Preserves canonical casing (IPv4, IPv6) and falls back to OTHER for unknown protocols.
 */
export function protocolColorKey(proto: string): keyof typeof PROTO_COLORS {
  return Object.prototype.hasOwnProperty.call(PROTO_COLORS, proto)
    ? (proto as keyof typeof PROTO_COLORS)
    : 'OTHER'
}
