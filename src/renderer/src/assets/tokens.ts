// NetVis Design Tokens — Single source of truth

export const PROTO_COLORS = {
  TCP: { color: '#3B82F6', dim: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)' },
  UDP: { color: '#10B981', dim: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
  ICMP: { color: '#F59E0B', dim: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  DNS: { color: '#8B5CF6', dim: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)' },
  ARP: { color: '#EF4444', dim: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
  IPv4: { color: '#06B6D4', dim: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.3)' }, // Updated to cyan (design system)
  IPv6: { color: '#EC4899', dim: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.3)' }, // Updated to pink (design system)
  OTHER: { color: '#6B7280', dim: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)' }
} as const

export type Protocol = keyof typeof PROTO_COLORS

export const MOTION_TOKENS = [
  {
    name: 'ROW_FADE_IN_MS',
    value: '200ms',
    desc: 'New packet row fade-in · ease-out',
    ref: 'Req 21.1'
  },
  {
    name: 'CHART_TRANSITION_MS',
    value: '300ms',
    desc: 'Protocol chart segment resize · easing',
    ref: 'Req 21.2'
  },
  {
    name: 'PDI_SLIDE_IN_MS',
    value: '200ms',
    desc: 'Inspector panel slide · translateX',
    ref: 'Req 21.3'
  },
  {
    name: 'CAPTURE_PULSE_MS',
    value: '900ms',
    desc: 'Active capture dot pulse · @keyframes',
    ref: 'Req 21.4'
  },
  {
    name: 'TOOLTIP_ENTER_MS',
    value: '150ms',
    desc: 'Tooltip / popover enter · fast fade-in',
    ref: 'Req 20.1'
  },
  {
    name: 'CHALLENGE_BADGE_MS',
    value: '250ms',
    desc: 'Challenge complete badge · spring bounce',
    ref: 'Req 11.4'
  }
] as const

export const SPACING_TOKENS = [
  { token: 'space-1', px: 4, usage: 'Icon gaps, dense table cells' },
  { token: 'space-2', px: 8, usage: 'Badge padding, inline gaps' },
  { token: 'space-3', px: 12, usage: 'Row padding, toolbar items' },
  { token: 'space-4', px: 16, usage: 'Panel padding, card padding' },
  { token: 'space-6', px: 24, usage: 'Section internal spacing' },
  { token: 'space-8', px: 32, usage: 'Between major components' },
  { token: 'space-12', px: 48, usage: 'Page sections, major layout gaps' }
] as const

export const RADIUS_TOKENS = [
  { name: 'none', px: 0, label: '0 · none' },
  { name: 'sm', px: 4, label: '4px · sm' },
  { name: 'md', px: 6, label: '6px · md' },
  { name: 'lg', px: 8, label: '8px · lg' },
  { name: 'xl', px: 12, label: '12px · xl' },
  { name: 'pill', px: 9999, label: '9999px · pill' }
] as const

export const TYPE_SCALE = [
  {
    role: 'Display',
    spec: 'Sora 600 · 28px · -0.5px',
    sample: 'Packet Inspector',
    style: {
      fontFamily: 'var(--font-ui)',
      fontSize: '28px',
      fontWeight: 600,
      letterSpacing: '-0.5px'
    }
  },
  {
    role: 'Title',
    spec: 'Sora 600 · 18px · -0.3px',
    sample: 'Protocol Distribution',
    style: {
      fontFamily: 'var(--font-ui)',
      fontSize: '18px',
      fontWeight: 600,
      letterSpacing: '-0.3px'
    }
  },
  {
    role: 'Section head',
    spec: 'Sora 500 · 13px · 0',
    sample: 'Ethernet Layer — Frame Header',
    style: { fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500 }
  },
  {
    role: 'Body',
    spec: 'Sora 400 · 13px · 1.6 lh',
    sample: "The Time to Live field limits a packet's lifetime. Each router decrements by one.",
    style: { fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 400, lineHeight: 1.6 },
    secondary: true
  },
  {
    role: 'Label / UI',
    spec: 'Sora 400 · 11px · 0.04em',
    sample: 'INTERFACE · CAPTURE · FILTER',
    style: {
      fontFamily: 'var(--font-ui)',
      fontSize: '11px',
      fontWeight: 400,
      letterSpacing: '0.04em',
      textTransform: 'uppercase' as const
    },
    tertiary: true
  },
  {
    role: 'Data / Mono',
    spec: 'Space Mono 400 · 12px',
    sample: '192.168.1.1 → 8.8.8.8 · TCP · seq=2847391920',
    style: { fontFamily: 'var(--font-data)', fontSize: '12px', fontWeight: 400 }
  },
  {
    role: 'Hex / Offset',
    spec: 'Space Mono 400 · 11px',
    sample: '0x00 · 0x06 · 0x0c · 0x12',
    style: { fontFamily: 'var(--font-data)', fontSize: '11px', fontWeight: 400 },
    tertiary: true
  },
  {
    role: 'Filter expression',
    spec: 'Space Mono 700 · 12px',
    sample: 'proto == TCP AND port > 1024',
    style: {
      fontFamily: 'var(--font-data)',
      fontSize: '12px',
      fontWeight: 700,
      color: 'var(--proto-tcp)'
    }
  }
] as const

export const MOCK_PACKETS = [
  {
    id: 1,
    time: '14:23:01.042',
    src: '192.168.1.5',
    dst: '8.8.8.8',
    proto: 'TCP' as Protocol,
    len: 74
  },
  {
    id: 2,
    time: '14:23:01.055',
    src: '8.8.8.8',
    dst: '192.168.1.5',
    proto: 'DNS' as Protocol,
    len: 211
  },
  {
    id: 3,
    time: '14:23:01.071',
    src: '192.168.1.5',
    dst: '192.168.1.1',
    proto: 'ICMP' as Protocol,
    len: 98
  },
  {
    id: 4,
    time: '14:23:01.082',
    src: '10.0.0.4',
    dst: '10.0.0.1',
    proto: 'UDP' as Protocol,
    len: 136
  },
  {
    id: 5,
    time: '14:23:01.099',
    src: '192.168.1.12',
    dst: '255.255.255.0',
    proto: 'ARP' as Protocol,
    len: 42
  }
] as const

export const CONTRAST_PAIRS = [
  // Dark mode
  {
    bg: '#0d1117',
    fg: '#e6edf3',
    ratio: '13.2 : 1',
    level: 'AAA',
    desc: 'Primary text on Base (dark)'
  },
  {
    bg: '#161b22',
    fg: '#e6edf3',
    ratio: '12.1 : 1',
    level: 'AAA',
    desc: 'Primary text on Surface 1 (dark)'
  },
  {
    bg: '#0d1117',
    fg: '#7d8590',
    ratio: '5.1 : 1',
    level: 'AA',
    desc: 'Secondary text on Base (dark)'
  },
  {
    bg: '#21262d',
    fg: '#e6edf3',
    ratio: '10.8 : 1',
    level: 'AAA',
    desc: 'Primary text on Surface 2 (dark)'
  },
  // Light mode
  {
    bg: '#ffffff',
    fg: '#1c2128',
    ratio: '16.0 : 1',
    level: 'AAA',
    desc: 'Primary text on Surface 1 (light)'
  },
  {
    bg: '#f6f8fa',
    fg: '#1c2128',
    ratio: '14.8 : 1',
    level: 'AAA',
    desc: 'Primary text on Base (light)'
  },
  {
    bg: '#ffffff',
    fg: '#57606a',
    ratio: '5.9 : 1',
    level: 'AA',
    desc: 'Secondary text on Surface 1 (light)'
  },
  {
    bg: '#f0f2f5',
    fg: '#1c2128',
    ratio: '13.1 : 1',
    level: 'AAA',
    desc: 'Primary text on Surface 2 (light)'
  }
] as const

export const SURFACE_TOKENS = {
  dark: {
    base: { hex: '#0d1117', token: '--nv-bg-base', use: 'Page background · lowest layer' },
    surface1: {
      hex: '#161b22',
      token: '--nv-bg-surface-1',
      use: 'Panel backgrounds · sidebars · main content'
    },
    surface2: {
      hex: '#21262d',
      token: '--nv-bg-surface-2',
      use: 'Toolbars · header rows · raised cards'
    },
    surface3: {
      hex: '#30363d',
      token: '--nv-bg-surface-3',
      use: 'Hover states · pressed states · tags'
    }
  },
  light: {
    base: { hex: '#f6f8fa', token: '--nv-bg-base', use: 'Page background · lowest layer' },
    surface1: {
      hex: '#ffffff',
      token: '--nv-bg-surface-1',
      use: 'Panel backgrounds · sidebars · main content'
    },
    surface2: {
      hex: '#f0f2f5',
      token: '--nv-bg-surface-2',
      use: 'Toolbars · header rows · raised cards'
    },
    surface3: {
      hex: '#e8eaed',
      token: '--nv-bg-surface-3',
      use: 'Hover states · pressed states · tags'
    }
  }
} as const

export type SurfaceMode = keyof typeof SURFACE_TOKENS
export type SurfaceLevel = keyof typeof SURFACE_TOKENS.dark
