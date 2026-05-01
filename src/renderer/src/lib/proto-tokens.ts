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
  TCP: { color: '#4E9CE8', dim: 'rgba(78,156,232,0.12)', border: 'rgba(78,156,232,0.3)' },
  UDP: { color: '#9B7FE8', dim: 'rgba(155,127,232,0.12)', border: 'rgba(155,127,232,0.3)' },
  ICMP: { color: '#E8A030', dim: 'rgba(232,160,48,0.12)', border: 'rgba(232,160,48,0.3)' },
  DNS: { color: '#35B890', dim: 'rgba(53,184,144,0.12)', border: 'rgba(53,184,144,0.3)' },
  ARP: { color: '#D678A8', dim: 'rgba(214,120,168,0.12)', border: 'rgba(214,120,168,0.3)' },
  IPv4: { color: '#D4824A', dim: 'rgba(212,130,74,0.12)', border: 'rgba(212,130,74,0.3)' },
  IPv6: { color: '#4AB8D4', dim: 'rgba(74,184,212,0.12)', border: 'rgba(74,184,212,0.3)' },
  OTHER: { color: '#7A7A86', dim: 'rgba(122,122,134,0.12)', border: 'rgba(122,122,134,0.3)' },
} as const;

export type Protocol = keyof typeof PROTO_COLORS;
