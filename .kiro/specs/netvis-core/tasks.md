# Implementation Plan: NetVis Core

## Overview

Incremental implementation following the Phase 1 → Phase 2 dependency order. Each task builds on the previous, ending with all components wired together. Phase 2 tasks begin only after all Phase 1 acceptance criteria are met.

## Tasks

### Phase 1

- [x] 1. Project scaffold and tooling
  - Configure TypeScript strict mode in `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`
  - Add ESLint and Prettier configs; wire into `package.json` scripts
  - Add `VITE_PHASE` env var support to `electron.vite.config.ts`; define `__DEV_OVERLAY__` Vite define
  - Create three build profiles (`dev`, `staging`, `production`) in `electron.vite.config.ts` and `electron-builder.yml`
  - Create `src/shared/ipc-types.ts` stub (empty exports — filled in task 9)
  - Create `src/renderer/src/constants/animations.ts` with `ANIMATION` constants
  - _Requirements: ARCH-06, Req 30.1_

- [x] 2. Security foundations
  - Configure `BrowserWindow` in `src/main/index.ts`: `nodeIntegration: false`, `contextIsolation: true`, no remote URLs
  - Add CSP header via `session.webRequest.onHeadersReceived` (APP-SEC-01)
  - Create `src/preload/index.ts` skeleton exposing `window.electronAPI` via `contextBridge` (empty methods — filled in task 9)
  - Install `zod`; create `src/main/ipc-schemas.ts` with placeholder schemas
  - _Requirements: ARCH-01, ARCH-02, ARCH-03, Req 15.1, Req 15.4_

- [x] 3. Capture Engine — core types and error normalization
  - Create `src/shared/capture-types.ts`: `RawPacket`, `CaptureError`, `CaptureErrorCode`, `PacketSource`, `NetworkInterface`, `SpeedMultiplier`, `CaptureStatus`
  - Implement `mapError()` with platform hints (Windows/Linux/macOS) in `src/main/capture/errors.ts`
  - _Requirements: Req 1.3, Req 2.7, Req 25.3_

- [x] 4. Capture Engine — PacketSource implementations
  - Implement `CapSource` in `src/main/capture/cap-source.ts` (buffer copy, truncation drop, idempotent stop)
  - Implement `PcapFileSource` in `src/main/capture/pcap-file-source.ts` (streaming, correct µs timestamp, idempotent stop)
  - Implement `SimulatedReplaySource` in `src/main/capture/simulated-replay-source.ts` (streaming, pause/resume, delay clamped to 2000 ms, idempotent stop)
  - Add `MAX_FRAME_SIZE = 65535` guard in both file sources (FILE-SEC-01)
  - _Requirements: Req 2.1, Req 2.2, Req 2.8, Req 7.1, Req 7.2_

- [x] 5. Capture Engine — CaptureController, WorkerSupervisor, IpcBatcher
  - Implement `CaptureController` state machine (`idle → live/file/simulated → idle`) in `src/main/capture/capture-controller.ts`
  - Implement `WorkerSupervisor` with 500 ms restart in `src/main/capture/worker-supervisor.ts`
  - Implement `IpcBatcher` (50 ms / 100-packet flush) in `src/main/capture/ipc-batcher.ts`
  - Wire worker thread message protocol (`start-live`, `start-file`, `start-simulated`, `stop`, `packet-batch`, `stopped`, `error`, `metrics`)
  - Expose `CaptureEngine` public interface in `src/main/capture/index.ts`
  - _Requirements: Req 2.1, Req 2.2, Req 2.3, Req 2.4, Req 2.7, Req 14.2_

  - [x] 5.1 Write property test for ring-buffer capacity invariant (P2)
    - **Property 2: Ring-buffer capacity invariant**
    - **Validates: Requirements 2.5, 12.1, 12.2**

  - [x] 5.2 Write property test for simulated capture order (P3)
    - **Property 3: Simulated capture preserves packet order**
    - **Validates: Requirements 2.8**

- [x] 6. Parser and Pretty_Printer
  - Create `src/main/parser/index.ts` implementing `Parser.parse()`: Ethernet → IPv4/IPv6 → TCP/UDP/ICMP/DNS layer decoder
  - Handle unknown protocol layers (`protocol: 'OTHER'`, preserve byte length, no raw bytes)
  - Handle malformed packets (partial `ParsedPacket` with `error` annotation, no throw)
  - Implement `Parser.print()` (Pretty_Printer) producing valid PCAP record bytes
  - _Requirements: Req 3.1, Req 3.2, Req 3.3, Req 3.4, Req 3.5, Req 8.2_

  - [x] 6.1 Write property test for parser layer ordering (P4)
    - **Property 4: Parser layer ordering**
    - **Validates: Requirements 3.1, 3.2**

  - [x] 6.2 Write property test for parse–print round trip (P5)
    - **Property 5: Parse–print round trip**
    - **Validates: Requirements 3.5, 3.6, 8.2**

- [x] 7. Anonymizer
  - Implement `Anonymizer` in `src/main/anonymizer/index.ts`
  - Generate HMAC session key via `crypto.randomBytes(32)` at startup (ANON-SEC-01)
  - Replace transport-layer payload with `sha256(key || payload)[0..7]` hex
  - Anonymize DNS answer IPs; preserve query name and record type (Req 4.4)
  - Ensure key is never written to disk, log, IPC, or exported PCAP
  - _Requirements: Req 4.1, Req 4.2, Req 4.3, Req 4.4, Req 4.5, ARCH-04_

  - [x] 7.1 Write property test for anonymization invariant (P6)
    - **Property 6: Anonymization invariant**
    - **Validates: Requirements 4.1, 4.3, 4.4, 4.5**

- [x] 8. Packet_Buffer
  - Implement ring buffer in `src/main/packet-buffer/index.ts` using fixed-size circular array with head/tail pointers
  - Configurable capacity (1,000–100,000, default 10,000); emit `'change'` and `'overflow'` events
  - Implement `push()`, `getAll()`, `getRange()`, `clear()`, `size`, `capacity`
  - _Requirements: Req 2.5, Req 2.6, Req 12.1, Req 12.2, Req 12.3, Req 12.4_

  - [x] 8.1 Write unit tests for Packet_Buffer boundary conditions
    - Test empty, one-below-capacity, at-capacity, overflow scenarios
    - _Requirements: Req 12.1, Req 12.2_

- [x] 9. Logger
  - Install `pino`; implement `Logger` in `src/main/logger/index.ts` wrapping pino
  - Write JSON lines to `app.getPath('userData')/netvis.log`; rotate at 10 MB, retain 2 files
  - Suppress DEBUG in production builds; enforce LOG-SEC-01 (no payload content in any log entry)
  - Catch `process.on('uncaughtException')` and log type, message, stack
  - _Requirements: Req 13.1, Req 13.2, Req 13.3, Req 13.5_

  - [x] 9.1 Write property test for logger entry structure (P16)
    - **Property 16: Logger entry structure**
    - **Validates: Requirements 13.1, 13.3**

- [x] 10. Settings_Store
  - Implement `SettingsStore` in `src/main/settings-store/index.ts`: load from `settings.json`, write on mutation, emit `'change'`
  - Default values: `bufferCapacity: 10000`, `theme: 'system'`, `welcomeSeen: false`, `completedChallenges: []`, `reducedMotion: false`
  - Handle missing/corrupt file: reset to defaults, log WARN
  - _Requirements: Req 12.1, Req 18.3, Req 19.3, Req 20.2_

  - [x] 10.1 Write unit tests for Settings_Store
    - Test default values on missing file, patch merge, persistence across reload
    - _Requirements: Req 12.1, Req 20.2_

- [x] 11. IPC Bridge and Preload — full channel implementation
  - Populate `src/shared/ipc-types.ts` with all types: `ElectronAPI`, `AnonPacket`, `NetworkInterface`, `CaptureStatus`, `BufferStats`, `ImportResult`, `ExportResult`, `Settings`, `SpeedMultiplier`
  - Implement all `ipcMain.handle()` handlers in `src/main/index.ts` for every channel in the Channel Inventory
  - Add `zod` schemas in `src/main/ipc-schemas.ts` for all invoke payloads; reject invalid payloads with structured error (IPC-SEC-01)
  - Implement `src/preload/index.ts` exposing full `window.electronAPI` via `contextBridge`
  - Wire `IpcBatcher` → `mainWindow.webContents.send('packet:batch', ...)` push
  - Wire `buffer:overflow`, `capture:status`, `buffer:stats` push channels
  - _Requirements: ARCH-01, ARCH-05, Req 1.1, Req 2.1, Req 2.2, Req 12.3, Req 13.4, Req 15.1_

  - [x] 11.1 Write property test for input sanitization (P17)
    - **Property 17: Input sanitization**
    - **Validates: Requirements 15.2**

- [x] 12. Checkpoint — core pipeline integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Zustand store and renderer bootstrap
  - Install `zustand`; create `src/renderer/src/store/index.ts` with full `NetVisStore` shape
  - Implement all actions: `addPacket`, `addPackets`, `setPackets`, `clearPackets`, `selectPacket`, `setFilter`, `setCaptureStatus`, `setInterfaces`, `setTheme`, `toggleFocusVisualization`, `activateChallenge`, `completeChallenge`
  - Wire `window.electronAPI.onPacketBatch`, `onCaptureStatus`, `onBufferOverflow`, `onBufferStats` listeners in `App.tsx`
  - Load initial settings and packets via `getSettings()` / `getAllPackets()` on mount
  - _Requirements: ARCH-05, Req 5.1, Req 12.3_

- [ ] 14. MUI theme and Visual Design System
  - Install `@mui/material @emotion/react @emotion/styled`
  - Create `src/renderer/src/theme/index.ts`: `lightTheme`, `darkTheme` with Inter/Roboto font, 14 px body, 13 px button, 8 px spacing, 6 px border radius
  - Define `PROTOCOL_COLORS` token map in `src/renderer/src/constants/protocol-colors.ts`
  - Wrap `App.tsx` in `ThemeProvider`; derive active theme from Zustand `theme` field + `window.matchMedia`
  - Add `@media (prefers-reduced-motion: reduce)` CSS overrides zeroing all `--anim-*` custom properties
  - _Requirements: Req 18.1, Req 18.2, Req 18.3, Req 18.4, Req 18.5, Req 18.6, Req 16.5, Req 21.5_

  - [ ]\* 14.1 Write property test for protocol color invariant (P18)
    - **Property 18: Protocol color invariant**
    - **Validates: Requirements 18.2, 22.3, 23.2, 24.5, 26.5**

- [ ] 15. AppShell layout and Toolbar
  - Create `AppShell`, `Toolbar`, `StatusBar`, `MainLayout` components in `src/renderer/src/components/`
  - Implement `InterfaceSelector` (sorted alphabetically, calls `getInterfaces()` on mount)
  - Implement `CaptureControls` (Start/Stop/Simulated buttons wired to IPC)
  - Implement `FilterBar` input wired to `store.setFilter()`
  - Implement `ThemeToggle` wired to `store.setTheme()`
  - Implement `CaptureActiveIndicator` pulsing dot (CSS `@keyframes`, `aria-label="Capture active"`, `role="status"`)
  - Implement `StatusBar` with `CaptureStatusMessage`, `BufferOccupancy`, `FileInfo` contextual messages (Req 20.3, 20.4)
  - Allocate ≥40% window area to `VisualizationPane` at ≥1280 px width; implement Focus Visualization mode
  - _Requirements: Req 1.1, Req 1.4, Req 20.3, Req 20.4, Req 21.4, Req 24.1, Req 24.2, Req 24.6_

- [ ] 16. Packet_List with virtualization
  - Install `@tanstack/virtual`; implement `PacketList` in `src/renderer/src/components/PacketList.tsx`
  - Use `useVirtualizer` with `estimateSize: 36`, `overscan: 10`; outer div height = `getTotalSize()`
  - Display per-row: timestamp (ms precision), src, dst, protocol, length; color row background by `PROTOCOL_COLORS[proto]`
  - Row fade-in animation (`ROW_FADE_IN_MS`); placeholder when empty (Req 5.4)
  - Keyboard navigation: arrow keys move rows, Enter selects (Req 5.5); ARIA roles on rows
  - Inline message when filter returns no results (Req 20.5)
  - _Requirements: Req 5.1, Req 5.2, Req 5.3, Req 5.4, Req 5.5, Req 16.1, Req 16.3, Req 21.1_

  - [ ]\* 16.1 Write unit tests for virtualized list rendering
    - Verify only visible rows + overscan are rendered; test keyboard navigation
    - _Requirements: Req 5.3, Req 5.5_

- [ ] 17. Packet_Detail_Inspector
  - Implement `PacketDetailInspector` in `src/renderer/src/components/PacketDetailInspector.tsx`
  - Render `packet.layers[]` as collapsible tree (MUI Accordion or custom TreeNode); layer header colored by `PROTOCOL_COLORS`
  - Expanded fields: name, decoded value, byte offset; indentation shows encapsulation depth
  - Hex strip at bottom highlights byte range on field hover/focus (Req 23.5)
  - Slide-in animation (`PDI_SLIDE_IN_MS`, `transform: translateX`) on panel open (Req 21.3)
  - Keyboard: arrow keys expand/collapse, Tab between fields; ARIA attributes (Req 23.6)
  - _Requirements: Req 23.1, Req 23.2, Req 23.3, Req 23.4, Req 23.5, Req 23.6, Req 16.1, Req 16.3_

  - [ ]\* 17.1 Write property test for packet detail rendering completeness (P12)
    - **Property 12: Packet detail rendering completeness**
    - **Validates: Requirements 23.1, 23.3**

- [ ] 18. Field explanation data and HelpIcon
  - Create `src/renderer/src/data/field-explanations.json` covering all fields in Req 10.2 (Ethernet, IPv4, TCP, UDP, ICMP, DNS) with `protocol`, `field`, `label`, `explanation`, `byteOffset`, `byteLength`, `symbolicValues`
  - Create `src/renderer/src/data/help-text.json` with entries for all non-obvious controls (filter-bar, buffer-capacity, simulated-speed, etc.)
  - Implement `HelpIcon` component: accepts `helpId`, renders MUI `Tooltip` + `IconButton aria-label="Help"` with `?` icon
  - Wire `HelpIcon` onto `FilterBar`, `InterfaceSelector`, buffer capacity control, simulated speed control
  - _Requirements: Req 10.1, Req 10.2, Req 10.3, Req 10.4, Req 20.1_

  - [ ]\* 18.1 Write property test for field explanation completeness (P11)
    - **Property 11: Field explanation completeness**
    - **Validates: Requirements 10.2, 10.3**

  - [ ]\* 18.2 Write unit test for help-text completeness
    - Verify all `data-help-id` values in components resolve to entries in `help-text.json`
    - _Requirements: Req 20.1_

- [ ] 19. Protocol_Chart
  - Install `recharts`; implement `ProtocolChart` in `src/renderer/src/components/ProtocolChart.tsx`
  - Recharts `PieChart` / `Cell`; data derived from `filteredPackets` as `Map<ProtocolName, number>`
  - Each segment colored by `PROTOCOL_COLORS[proto]`; label shows protocol name, count, percentage
  - Animated segment transitions (`CHART_TRANSITION_MS`, easing); placeholder when empty
  - Accessible `<table aria-label="Protocol distribution">` alongside chart (Req 6.4)
  - Updates within 500 ms of buffer change via Zustand subscription
  - _Requirements: Req 6.1, Req 6.2, Req 6.3, Req 6.4, Req 16.3, Req 21.2, Req 24.1_

  - [ ]\* 19.1 Write property test for protocol distribution correctness (P10)
    - **Property 10: Protocol distribution correctness**
    - **Validates: Requirements 6.1, 6.3**

- [ ] 20. Packet_Flow_Timeline
  - Implement `PacketFlowTimeline` in `src/renderer/src/components/PacketFlowTimeline.tsx`
  - Recharts `BarChart`; 60 one-second buckets; bar color = dominant protocol color for bucket
  - Scrolls to keep latest bucket visible; x-axis HH:MM:SS labels
  - Click handler calls `store.setFilter(timeRangeFilter(bucket))` (Req 22.4)
  - Accessible data table (Req 22.5); placeholder when empty (Req 22.6)
  - _Requirements: Req 22.1, Req 22.2, Req 22.3, Req 22.4, Req 22.5, Req 22.6, Req 16.3, Req 24.1_

  - [ ]\* 20.1 Write property test for timeline bucket construction (P19)
    - **Property 19: Timeline bucket construction**
    - **Validates: Requirements 22.1**

  - [ ]\* 20.2 Write property test for time-range filter generation (P20)
    - **Property 20: Time-range filter generation**
    - **Validates: Requirements 22.4, 28.3**

- [ ] 21. Filter_Engine
  - Implement `src/main/filter-engine/lexer.ts`: single-pass tokenizer producing `Token[]`
  - Implement `src/main/filter-engine/parser.ts`: recursive descent `parseExpression → parseTerm → parsePredicate`; returns `FilterAST` or `{ ok: false, error, position }`
  - Implement `src/main/filter-engine/evaluator.ts`: `evaluate(ast, packet): boolean`; read-only, never mutates buffer
  - Wire filter IPC: renderer sends expression, main evaluates against buffer, returns filtered `AnonPacket[]`
  - Surface parse errors to Zustand `filterError`; display inline in `FilterBar`
  - _Requirements: Req 9.1, Req 9.2, Req 9.3, Req 9.4, Req 9.5_

  - [ ]\* 21.1 Write property test for filter grammar parse–evaluate round trip (P8)
    - **Property 8: Filter grammar parse–evaluate round trip**
    - **Validates: Requirements 9.1, 9.4**

  - [ ]\* 21.2 Write property test for filter read-only invariant (P7)
    - **Property 7: Filter read-only invariant**
    - **Validates: Requirements 9.5**

  - [ ]\* 21.3 Write property test for filter clear restores full packet list (P9)
    - **Property 9: Filter clear restores full packet list**
    - **Validates: Requirements 9.3**

- [ ] 22. PCAP import and export
  - Implement `pcap:import` handler: open file dialog, validate path (FILE-SEC-01: `path.resolve()`, home-dir check, `fs.access()`), stream via `PcapFileSource`, populate buffer
  - Implement `pcap:startFile` handler: stream file as `captureMode: 'file'` through full pipeline
  - Implement `pcap:export` handler: write buffer to temp path via `Parser.print()`, rename on success; return `ExportResult { ok: false }` without partial file on failure
  - Display progress indicator during export; do not block Packet_List (Req 8.4)
  - Show total packet count and file size in status bar after import (Req 7.4)
  - _Requirements: Req 7.1, Req 7.2, Req 7.3, Req 7.4, Req 8.1, Req 8.2, Req 8.3, Req 8.4_

- [ ] 23. Onboarding — WelcomeScreen
  - Implement `WelcomeScreen` overlay in `src/renderer/src/components/WelcomeScreen.tsx`
  - Three-step walkthrough: what NetVis does, how to start capture / load PCAP, where to find challenges
  - Persist completion to `localStorage` via `settings:set { welcomeSeen: true }` on dismiss/complete
  - Show only when `!store.welcomeSeen`; re-openable via "Show Welcome Guide" menu action
  - Full keyboard navigation; WCAG 2.1 AA focus management (Req 19.5)
  - _Requirements: Req 19.1, Req 19.2, Req 19.3, Req 19.4, Req 19.5_

- [ ] 24. AdvancedSettingsPanel
  - Implement `AdvancedSettingsPanel` as MUI `Drawer` (anchor `"right"`) in `src/renderer/src/components/AdvancedSettingsPanel.tsx`
  - Controls: Buffer Capacity `<Slider>` (1000–100000, step 1000), Theme `<ToggleButtonGroup>`, Replay Speed `<Select>`, Reduced Motion `<Switch>`, Open Log Folder `<Button>`
  - On open: call `getSettings()` to populate; on change: call `setSettings(patch)`
  - Gear icon in Toolbar opens panel; panel collapsed by default (Req 20.2)
  - _Requirements: Req 12.1, Req 13.4, Req 18.6, Req 20.2_

- [ ] 25. Guided challenges
  - Create `src/renderer/src/data/challenges.ts` with 5 challenges: TCP handshake, DNS query/response, ICMP echo pair, filter by port, compare packet lengths
  - Implement `ChallengePanel` in `src/renderer/src/components/ChallengePanel.tsx`: goal description, success criteria, reveal-on-demand hint, completion notification
  - Evaluate success criteria on 500 ms debounced interval while challenge is active (Req 11.3)
  - Persist completed challenge IDs to `localStorage` under `netvis:completedChallenges`; sync to `Settings_Store` via `settings:set`
  - _Requirements: Req 11.1, Req 11.2, Req 11.3, Req 11.4, Req 11.5_

  - [ ]\* 25.1 Write property test for challenge activation rendering (P13)
    - **Property 13: Challenge activation rendering**
    - **Validates: Requirements 11.2**

  - [ ]\* 25.2 Write property test for challenge completion persistence (P14)
    - **Property 14: Challenge completion persistence**
    - **Validates: Requirements 11.5**

- [ ] 26. Privilege minimization setup
  - Add platform-specific privilege instructions to `README.md` and in-app error messages per CAP-SEC-01
  - Linux: display `setcap cap_net_raw,cap_net_admin=eip` instructions when `PERMISSION_DENIED`
  - Windows: check Npcap Users group membership at startup; show actionable error if absent
  - macOS: display `sudo` / System Preferences instructions when `PERMISSION_DENIED`
  - _Requirements: Req 1.3, Req 25.1, Req 25.3, CAP-SEC-01_

- [ ] 27. Checkpoint — Phase 1 complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 28. Property-based test suite — Phase 1 properties
  - Install `fast-check`; configure Vitest in `vitest.config.ts` with 100-iteration minimum
  - Create test files under `src/__tests__/main/` and `src/__tests__/renderer/` per the test file organization in the design
  - Implement all P1–P20 property tests not already created as sub-tasks above (P1 interface enumeration completeness, P15 buffer clear resets all state)
  - Each test includes comment tag `// Feature: netvis-core, Property N: <text>`
  - _Requirements: Req 1.1, Req 1.2, Req 1.4, Req 12.4, Req 24.4_

  - [ ]\* 28.1 Write property test for interface enumeration completeness (P1)
    - **Property 1: Interface enumeration completeness**
    - **Validates: Requirements 1.1, 1.2, 1.4**

  - [ ]\* 28.2 Write property test for buffer clear resets all state (P15)
    - **Property 15: Buffer clear resets all state**
    - **Validates: Requirements 12.4, 24.4**

---

### Phase 2

> Begin only after all Phase 1 acceptance criteria (Requirements 5, 6, 22, 23, 24) are verified.

- [ ] 29. OSI_Layer_Diagram
  - Implement `OSILayerDiagram` in `src/renderer/src/components/OSILayerDiagram.tsx`
  - Vertical stack of 7 labeled layer boxes; active layers use `PROTOCOL_COLORS[proto]` tint, inactive at `opacity: 0.3`
  - Click active layer → expand corresponding PDI node via `store.selectPacket` + PDI scroll
  - Placeholder when no packet selected (Req 26.7); keyboard nav: Tab between layers, Enter to activate
  - Render `<PhasePlaceholder>` when `VITE_PHASE < 2`
  - _Requirements: Req 26.1, Req 26.2, Req 26.3, Req 26.4, Req 26.5, Req 26.6, Req 26.7, Req 30.2, Req 30.4_

  - [ ]\* 29.1 Write property test for OSI layer active/inactive rendering (P24)
    - **Property 24: OSI layer active/inactive rendering**
    - **Validates: Requirements 26.2, 26.3**

- [ ] 30. IP_Flow_Map
  - Install `d3`; implement `IPFlowMap` in `src/renderer/src/components/IPFlowMap.tsx` using React-renders-structure / D3-animates-positions pattern
  - React renders `<svg>` with `<g>` nodes and `<line>` edges keyed by ID; `useRef` holds D3 simulation
  - D3 force simulation writes `x`/`y` directly to DOM refs on tick (no React setState on tick)
  - Node click → `store.setFilter('src == IP || dst == IP')`; edge click → bidirectional filter
  - Accessible table alternative (Req 27.7); placeholder when no IP packets (Req 27.6)
  - Updates within 1 s of buffer change; render `<PhasePlaceholder>` when `VITE_PHASE < 2`
  - _Requirements: Req 27.1, Req 27.2, Req 27.3, Req 27.4, Req 27.5, Req 27.6, Req 27.7, Req 30.2, Req 30.4_

  - [ ]\* 30.1 Write property test for IP flow graph construction (P21)
    - **Property 21: IP flow graph construction**
    - **Validates: Requirements 27.1, 27.2**

  - [ ]\* 30.2 Write property test for IP flow filter generation (P22)
    - **Property 22: IP flow filter generation**
    - **Validates: Requirements 27.3, 27.4**

- [ ] 31. Bandwidth_Chart
  - Implement `BandwidthChart` in `src/renderer/src/components/BandwidthChart.tsx`
  - Recharts `AreaChart` (stacked); 1-second buckets accumulating bytes per protocol
  - Each area colored by `PROTOCOL_COLORS[proto]`; y-axis in bytes, x-axis timestamps
  - Click region → time-range filter (Req 28.3); accessible table alternative (Req 28.5)
  - Placeholder when empty (Req 28.6); render `<PhasePlaceholder>` when `VITE_PHASE < 2`
  - _Requirements: Req 28.1, Req 28.2, Req 28.3, Req 28.4, Req 28.5, Req 28.6, Req 30.2, Req 30.4_

  - [ ]\* 31.1 Write property test for bandwidth chart data correctness (P23)
    - **Property 23: Bandwidth chart data correctness**
    - **Validates: Requirements 28.1**

- [ ] 32. Protocol_Animations
  - Implement `ProtocolAnimations` in `src/renderer/src/components/ProtocolAnimations.tsx`
  - Two-endpoint SVG diagram; packet envelopes animated with CSS transitions (disabled under `prefers-reduced-motion`)
  - Three animations: TCP three-way handshake, DNS query/response, ICMP echo request/reply
  - Playback controls: play/pause/step-forward/step-back/restart (Req 29.4)
  - Highlight matching real packet rows in Packet_List on each step (Req 29.3)
  - Each step announced via `aria-live` region (Req 29.6); render `<PhasePlaceholder>` when `VITE_PHASE < 2`
  - _Requirements: Req 29.1, Req 29.2, Req 29.3, Req 29.4, Req 29.5, Req 29.6, Req 30.2, Req 30.4_

  - [ ]\* 32.1 Write property test for protocol animation step highlighting (P25)
    - **Property 25: Protocol animation step highlighting**
    - **Validates: Requirements 29.3**

- [ ] 33. Final checkpoint — Phase 2 complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with minimum 100 iterations; each includes a `// Feature: netvis-core, Property N:` comment tag
- Phase 2 components render `<PhasePlaceholder>` when `VITE_PHASE < 2`
- Run tests with `vitest --run` for single-pass execution
