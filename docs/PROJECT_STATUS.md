# Project Status

**Last Modified:** 2026-04-22

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
- ✅ Tailwind CSS + Design System (Sora/Space Mono fonts, token system, Radix UI)
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
- ✅ Dead `clampLength` function removed from parser
- ✅ Redundant `import { PROTO_COLORS }` removed (then restored — was needed for `protocolColorKey`)
- ✅ `setInterfaces` removed from `App.tsx` effect dependency array (was never called there)
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

## Development Commands

```bash
npm run dev                    # Start development server
npm test                       # Run all tests once
npm run typecheck              # Type-check all TypeScript (including tests)
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

---

## Completed Work

### Phase 1 Backend (Tasks 1-11) ✅

- ✅ Capture Engine (live, file, simulated replay)
- ✅ Parser (Ethernet → IPv4/IPv6 → TCP/UDP/ICMP/DNS/ARP)
- ✅ Anonymizer (HMAC-based payload pseudonymization, main-process IPC boundary)
- ✅ Packet Buffer (ring buffer, 1K-100K capacity)
- ✅ Logger (Pino, rotation, structured JSON)
- ✅ Settings Store (persistent JSON)
- ✅ IPC Layer (Zod validation, contextBridge)
- ✅ Worker Thread (capture/parse pipeline)
- ✅ IPC Batching (50ms/100 packets)
- ✅ Error Normalization (platform-specific hints)

### Phase 1 UI (Tasks 13-21) ✅

- ✅ Zustand Store + Renderer Bootstrap
- ✅ Tailwind CSS + Design System (Sora/Space Mono fonts, token system, Radix UI components)
- ✅ AppShell layout (Toolbar, StatusBar, InterfaceSelector, CaptureControls, FilterBar)
- ✅ Packet List with virtualization (@tanstack/virtual, keyboard nav, ARIA)
- ✅ Packet Detail Inspector (collapsible tree, hex strip, slide-in animation)
- ✅ Field Explanations + HelpIcon (all protocol fields, help-text.json)
- ✅ Protocol Chart (Recharts PieChart, protocol colors, accessible table)
- ✅ Packet Flow Timeline (60-bucket BarChart, time-range filter on click)
- ✅ Filter Engine (lexer, recursive-descent parser, evaluator, `ts` field support)

### Phase 1 Completion Bugfixes (Task 21.5) ✅

- ✅ 21.5.1: `PacketBuffer.setCapacity()` method implemented
- ✅ 21.5.2: `WorkerOutMessage` type documentation corrected
- ✅ 21.5.3: Capture control IPC handlers wired (capture:start/stop/getInterfaces/startSimulated with FILE-SEC-01)
- ✅ 21.5.4: Buffer management IPC handlers wired (buffer:clear, buffer:setCapacity)
- ✅ 21.5.5: Double anonymization in filter:apply fixed (hash consistency with buffer:getAll)
- ✅ 21.5.6: Simulated replay UI built (speed selector, pcap:selectFile dialog separation)

### Phase 1 Stabilization Sprint (Task 21.6) ✅

- ✅ 21.6.1: Worker restart rebinding fix
- ✅ 21.6.2: Settings bootstrap uses persisted buffer capacity
- ✅ 21.6.3: UDP/ICMP payload boundary — `rawByteLength` now header-only (8 for UDP, 4 for ICMP); anonymizer correctly identifies payload start
- ✅ 21.6.4: pcap:startFile path hardening (FILE-SEC-01)
- ✅ 21.6.5: File-mode status flow completion
- ✅ 21.6.6: pps cleanup
- ✅ 21.6.7: buffer:stats throttling (500ms spacing)
- ✅ 21.6.8: Single owner for interface enumeration
- ✅ 21.6.9: setActiveInterface store action
- ✅ 21.6.10: AdvancedSettingsPanel replay-speed ownership cleanup
- ✅ 21.6.11: Overflow notification wired to real PacketBuffer 'overflow' events
- ✅ 21.6.12: DNS anonymization claim/code alignment
- ✅ 21.6.13: Stabilization regression tests
- ✅ 21.6.14: Docs re-baselined

### Additional Bugfixes ✅

- ✅ Bug D: `sendToRenderer` wired to `mainWindow` in `main/index.ts`
- ✅ Bug A: `packet-buffer.unit.test.ts` and `phase1-bugfixes.unit.test.ts` corrected to use `ParsedPacket`
- ✅ Bug B: Invalid `captureMode` literal removed from `filter-engine.property.test.ts`
- ✅ Bug C: `pcap:import` now has 30s timeout + no-op handler restore
- ✅ Bug E: `PacketBuffer.setCapacity()` IPC-level bounds check removed (validation stays at IPC layer)
- ✅ BUG-C1: `capture:status`, `buffer:stats`, `buffer:overflow` push channels wired
- ✅ BUG-H1: `anonPacketArb` missing `id` field fixed
- ✅ BUG-H2: `CaptureEngine.on()` converted to `EventEmitter` pattern
- ✅ BUG-M1: `Parser.print()` guarded against missing `rawData`
- ✅ BUG-M2: README updated
- ✅ RISK-1: `getInterfaces()` guarded against worker crash mid-call
- ✅ RISK-4: `SpeedMultiplier` cast validated in `CaptureControls`
- ✅ StatusBar overflow effect now returns cleanup (clears timer on unmount)
- ✅ build:mac and build:linux now gate on `npm run typecheck` (consistent with all other build targets)

### Test Suite Hardening ✅

- ✅ T1: `createMockPacket()` in overflow test corrected to real `ParsedPacket` shape
- ✅ T2: `packet-buffer.property.test.ts` now uses `ParsedPacket` (not `AnonPacket`)
- ✅ T3: `store.unit.test.ts` replaced with real `useNetVisStore` tests (43 tests, no mocks)
- ✅ T4: Type errors in `capture-command-semantics`, `file-mode-status-flow`, `phase2-bugfixes` resolved
- ✅ T5: `simulated-replay.property.test.ts` — deferred (tests pure `computeDelay` helper; acceptable)
- ✅ T6: `Math.random()` inside fast-check `.map()` replaced with deterministic `fc.array(fc.integer(...))` generator
- ✅ B1: jsdom environment configured for renderer tests via `environmentMatchGlobs`
- ✅ B2: Renderer test utilities created (`test-utils.ts`: `renderWithStore`, `resetStore`, `mockElectronAPI`, `makeAnonPacket`)
- ✅ B3: Split TypeScript test configs (`tsconfig.tests.main.json` / `tsconfig.tests.renderer.json`) extending project configs; `typecheck:tests` wired into `typecheck`
- ✅ `overflow-event-semantics.unit.test.ts` deleted; replaced with `packet-buffer-overflow.unit.test.ts` (pure main-side, no renderer imports)

### Property Tests ✅

- ✅ P2–P12, P16–P20 passing (100+ iterations each)
- ✅ P19 (timeline bucket construction) — complete
- ✅ P20 (time-range filter generation) — complete

---

## Next Steps

### Remaining Phase 1 Tasks (Tasks 22-28)

- [ ] Task 22: PCAP import/export (PARTIAL: backend exists, renderer wiring incomplete)
- [ ] Task 23: Onboarding — WelcomeScreen
- [ ] Task 24: AdvancedSettingsPanel (PARTIAL: implementation exists)
- [ ] Task 25: Guided challenges
- [ ] Task 26: Privilege minimization setup
- [ ] Task 27: Checkpoint — Phase 1 complete
- [ ] Task 28: Property-based test suite completion (P1, P15 required)

### Phase 2 Tasks (Tasks 29-33)

- [ ] Task 29: OSI Layer Diagram
- [ ] Task 30: IP Flow Map (D3)
- [ ] Task 31: Bandwidth Chart
- [ ] Task 32: Protocol Animations
- [ ] Task 33: Final checkpoint

→ **Full task breakdown:** See `.kiro/specs/netvis-core/tasks.md`

---

## Known Issues

**Partial implementations:**
- Task 22 (PCAP import/export): Backend exists, renderer wiring incomplete
- Task 24 (AdvancedSettingsPanel): Implementation exists, needs refinement

**Missing property tests (required before Task 27):**
- P1 (interface enumeration completeness)
- P15 (buffer clear resets all state)

---

## Performance Metrics

**Current (Phase 1):**
- ✅ Parser: <1ms per packet
- ✅ Anonymizer: <0.5ms per packet
- ✅ Ring buffer: O(1) operations
- ✅ packet:batch channel capped at ≤20 calls/sec at 1,000 pps
- ✅ buffer:stats throttled to 500ms spacing (Task 21.6.7)

**Phase 2 targets:**
- 1,000 pps sustained without UI lag
- Packet visible within 200ms of capture
- 30 fps renderer at 1,000 pps
- ≤500 MB memory at 100K buffer

---

## Dependencies

**Production:** Electron 40.6.1, React 19.2.1, Zustand 5.x, Recharts 3.x, @tanstack/react-virtual 3.x, Radix UI, motion 12.x, cap, pcap-parser, pino + pino-roll, zod, lucide-react, tailwindcss 4.x

**Development:** Vitest 4.x, fast-check 4.x, jsdom 29.x, @testing-library/react 16.x, @testing-library/user-event 14.x, TypeScript 5.9.3, ESLint, Prettier, electron-vite 5.x, electron-builder 26.x

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

## Questions?

- **Architecture?** → `docs/ARCHITECTURE.md`
- **Requirements?** → `.kiro/specs/netvis-core/requirements.md`
- **Design?** → `.kiro/specs/netvis-core/design.md`
- **Tasks?** → `.kiro/specs/netvis-core/tasks.md`
