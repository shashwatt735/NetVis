# Project Status

**Last Modified:** 2026-04-27

→ **Product Overview:** See `.kiro/steering/product.md`
→ **Architecture:** See `docs/ARCHITECTURE.md`
→ **Tech Stack:** See `.kiro/steering/tech.md`

---

## Current Phase

**Phase 1 + Phase 2** — Complete  
All core pipeline, UI, visualizations, and educational features are implemented and integrated.

---

## Completed Work

### Phase 1 Backend (Tasks 1–11) ✅

- ✅ Capture Engine (live on main thread, file/simulated in worker)
- ✅ Parser (Ethernet → IPv4/IPv6 → TCP/UDP/ICMP/DNS/ARP) with header-size and length validation
- ✅ Anonymizer (HMAC-based payload pseudonymization, main-process IPC boundary)
- ✅ Packet Buffer (ring buffer, 1K–100K capacity)
- ✅ Logger (Pino, rotation, structured JSON)
- ✅ Settings Store (persistent JSON)
- ✅ IPC Layer (Zod validation, contextBridge)
- ✅ IPC Batching (50ms/100 packets)
- ✅ Error Normalization (platform-specific hints)
- ✅ Filter Engine (lexer, recursive-descent parser, evaluator, `ts` field)

### Phase 1 UI (Tasks 13–21) ✅

- ✅ Zustand Store + Renderer Bootstrap
- ✅ Tailwind CSS + Design System (IBM Plex Sans/JetBrains Mono via Fontsource, locked protocol palette, warm-dark-ready token system, Radix UI)
- ✅ AppShell layout (Toolbar, StatusBar, InterfaceSelector, CaptureControls, FilterBar)
- ✅ Packet List with virtualization (@tanstack/virtual, keyboard nav, ARIA)
- ✅ Packet Detail Inspector (collapsible tree, hex strip, slide-in animation)
- ✅ Field Explanations + HelpIcon (all protocol fields, help-text.json)
- ✅ Protocol Chart (Recharts PieChart, protocol colors, accessible table)
- ✅ Packet Flow Timeline (60-bucket BarChart, time-range filter on click)

### Phase 1 Completion + Stabilization (Tasks 21.5–21.6) ✅

All capture control IPC handlers, buffer management, simulated replay UI, worker restart rebinding, settings bootstrap, path hardening, status flow, buffer stats throttling, and overflow notifications are complete.

### Phase 1 Remaining Tasks (22–28) ✅

- ✅ Task 22: PCAP import/export (backend + renderer wiring complete)
- ✅ Task 23: Onboarding — WelcomeScreen
- ✅ Task 24: AdvancedSettingsPanel (buffer capacity, theme, reduced motion, log folder)
- ✅ Task 25: Guided challenges (5 challenges, persistence, debounced evaluation)
- ✅ Task 26: Privilege minimization (platform-specific error messages)

### Phase 2 Visualizations (Tasks 29–33) ✅

- ✅ Task 29: OSI Layer Diagram (7-layer stack, active layer highlighting, keyboard nav)
- ✅ Task 30: IP Flow Map (D3 force simulation, node/edge click → filter)
- ✅ Task 31: Bandwidth Chart (Recharts stacked area, 60s window, click → time filter)
- ✅ Task 32: Protocol Animations (TCP handshake, DNS query, ICMP echo; play/pause/step)

### Post-Phase-2 Bugfixes and Hardening ✅

- ✅ Live capture moved to main thread (CapSource) — eliminates Npcap/pcap_dispatch crash on Windows
- ✅ Link-type normalization: `cap.open()` returns string `'ETHERNET'`; explicit `LINK_TYPE_MAP` maps to numeric libpcap constants; unknown types logged once and mapped to `-1`
- ✅ Parser validation hardened: TCP `dataOffset` bounds check, UDP `length` minimum validation, DNS gate uses UDP-declared payload length (not raw buffer length)
- ✅ Stop button race fixed: `setCaptureStatus` called immediately in `handleStop` after IPC resolves
- ✅ Replay speed change during replay: stop + restart with new speed
- ✅ Import timeout increased to 5 minutes for large PCAP files
- ✅ `PROTO_COLORS` import restored in `protocol-colors.ts` (was causing `ReferenceError` crash)
- ✅ Locked protocol palette applied: TCP `#4E9CE8`, UDP `#9B7FE8`, ICMP `#E8A030`, DNS `#35B890`, ARP `#D678A8`, OTHER `#7A7A86`, plus IPv4 `#D4824A` and IPv6 `#4AB8D4`
- ✅ `warm-dark` added to theme validation, persistence, and renderer class application
- ✅ Error boundary added (`ErrorBoundary.tsx`) — render errors show message instead of blank screen
- ✅ Fast Refresh incompatibilities fixed: utility functions extracted from component files into `*-utils.ts` modules
- ✅ `--nv-accent` / `--nv-accent-dim` CSS variables added to theme
- ✅ `getInterfaces()` guarded against being called during active capture
- ✅ `completeChallenge` now persists to settings
- ✅ `importResult` cleared on capture start
- ✅ `statsThrottler.cleanup()` called on `before-quit`
- ✅ Initial `buffer:stats` push on `did-finish-load`
- ✅ `'stopped'` → `'idle'` transition after 800ms
- ✅ Stale filter cleared on PCAP import
- ✅ Concurrent `filter:apply` IPC calls protected by generation counter
- ✅ `ChallengePanel.handleChallengeSuccess` wrapped in `useCallback`
- ✅ Interface selector double-sort fixed (priority sort preserved)
- ✅ `BandwidthChart` window anchored to latest packet timestamp (not `Date.now()`) — fixes empty chart for imported PCAPs

---

## Architecture Notes

### Live Capture Threading

`CapSource` runs on the **main process thread**, not the worker thread. The `cap` library's `pcap_dispatch` spawns a native OS background thread whose callbacks fire into the Node.js environment. In a `worker_threads` Worker on Windows with Npcap + Electron 40.x, that environment pointer becomes invalid, causing an `(env) != nullptr` assertion crash. The main process has a stable, long-lived environment that eliminates this crash. File and simulated replay sources remain in the worker thread.

### Parser Validation

The parser validates:
- All minimum header sizes (Ethernet 14B, IPv4 20B, IPv6 40B, TCP 20B, UDP 8B, ICMP 4B, ARP 28B, DNS 12B)
- IPv4 IHL (≥20, fits in buffer)
- TCP `dataOffset` (≥20, fits in buffer; falls back to 20 if invalid)
- UDP `length` (≥8; throws on invalid, preventing DNS dispatch on that packet)
- DNS dispatch gated on `udpLength - 8 >= 12` AND buffer bounds (not just buffer length)

---

## Test Suite

- **50 test files** (22 main, 27 renderer + setup/utils)
- **Property-based tests:** 100+ iterations each via fast-check
- **Main process:** anonymizer, buffer, parser round-trip, parser layer ordering, parser payload boundaries, simulated replay, filter engine, IPC input sanitization, capture command semantics, capture import batching, interface enumeration, file-mode status flow, buffer stats throttling, phase 1 + phase 2 bugfix regressions, logger, settings store
- **Renderer:** store, packet list virtualization, packet detail rendering, protocol chart, timeline buckets, bandwidth chart, OSI layer diagram, IP flow map, protocol animations, challenge activation/completion/persistence, field explanations, help text, filter challenges, accessibility regressions, capture controls feedback, interface selector, learn page, theme persistence, status bar overflow, time-range filter generation

---

## Performance Metrics

- ✅ Parser: <1ms per packet
- ✅ Anonymizer: <0.5ms per packet
- ✅ Ring buffer: O(1) operations
- ✅ `packet:batch` channel capped at ≤20 calls/sec at 1,000 pps
- ✅ `buffer:stats` throttled to ≤500ms spacing

**Targets (all met):**
- 1,000 pps sustained without UI lag
- Packet visible within 200ms of capture
- 30 fps renderer at 1,000 pps
- ≤500 MB memory at 100K buffer

---

## Dependencies

**Production:** Electron 40.6.1, React 19.2.1, Zustand 5.x, Recharts 3.x, @tanstack/react-virtual 3.x, Radix UI, motion 12.x, cap, pcap-parser, pino + pino-roll, zod, lucide-react, tailwindcss 4.x, d3 7.x

**Development:** Vitest 4.x, fast-check 4.x, jsdom 29.x, @testing-library/react 16.x, TypeScript 5.9.3, ESLint, Prettier, electron-vite 5.x, electron-builder 26.x

---

## Development Commands

```bash
npm run dev                    # Start development server
npm test                       # Run all tests once
npm run typecheck              # Type-check all TypeScript (including tests)
npm run typecheck:tests        # Type-check test files only
npm run lint                   # Run ESLint
npm run format                 # Format with Prettier
npm run build                  # Development build (includes typecheck)
npm run build:prod             # Production build (includes typecheck)
```

---

## Document Index

| Document | Purpose |
|----------|---------|
| `docs/ARCHITECTURE.md` | System architecture, threading model, IPC contract |
| `docs/PROJECT_STATUS.md` | This file — current implementation state |
| `docs/PROJECT_DESIGN.md` | High-level product design and UX decisions |
| `.kiro/specs/netvis-core/requirements.md` | Normative requirements (canonical) |
| `.kiro/specs/netvis-core/design.md` | Technical design (canonical) |
| `.kiro/specs/netvis-core/tasks.md` | Implementation task breakdown (canonical) |
| `.kiro/steering/tech.md` | Technology stack and invariants |
| `.kiro/steering/structure.md` | Project structure and conventions |
| `.kiro/steering/product.md` | Product overview and principles |
| `README.md` | Setup and getting started |
