/**
 * proto-tokens — shared protocol color constants and Protocol type.
 *
 * This is the single source of truth for protocol colors.
 * Ported from NetVis Design System (frozen reference).
 *
 * Invariant: protocol colors do not change between light and dark mode.
 * They are defined as raw hex/rgba values, not CSS variables, because they
 * must also be usable as Recharts fill props and canvas drawing colors.
 *
 * Color values must stay in sync with the CSS variables in theme.css:
 *   --proto-tcp / --proto-udp / --proto-icmp / --proto-dns / --proto-arp
 *   --proto-ipv4 / --proto-ipv6 / --proto-other
 */

export const PROTO_COLORS = {
  TCP: { color: '#3B82F6', dim: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)' },
  UDP: { color: '#10B981', dim: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
  ICMP: { color: '#F59E0B', dim: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  DNS: { color: '#8B5CF6', dim: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)' },
  ARP: { color: '#EF4444', dim: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
  IPv4: { color: '#06B6D4', dim: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.3)' },
  IPv6: { color: '#EC4899', dim: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.3)' },
  OTHER: { color: '#6B7280', dim: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)' },
} as const;

export type Protocol = keyof typeof PROTO_COLORS;
