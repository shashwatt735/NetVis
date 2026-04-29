# NetVis Code Index

## Dependency Tree

```
Main Process Entry (src/main/index.ts)
├── IPC Handlers (ipc-handlers.ts)
│   ├── Capture Engine (capture/)
│   │   ├── Cap Source (cap-source.ts)          ← live capture, MAIN thread
│   │   ├── Capture Controller (capture-controller.ts)
│   │   ├── Worker Supervisor (worker-supervisor.ts)
│   │   │   └── Capture Worker (capture-worker.ts)
│   │   │       ├── PCAP File Source (pcap-file-source.ts)
│   │   │       └── Simulated Replay Source (simulated-replay-source.ts)
│   │   └── IPC Batcher (ipc-batcher.ts)
│   ├── Parser (parser/)                         ← main thread (live) / worker (file/simulated)
│   ├── Anonymizer (anonymizer/)
│   ├── Packet Buffer (packet-buffer/)
│   ├── Filter Engine (filter-engine/)
│   ├── Settings Store (settings-store/)
│   ├── Logger (logger/)
│   └── Buffer Stats Throttler (buffer-stats-throttler.ts)
├── IPC Schemas (ipc-schemas.ts) — Zod validation
└── Shared Types (src/shared/)
    ├── capture-types.ts
    └── ipc-types.ts

Preload (src/preload/index.ts)
└── contextBridge → ElectronAPI

Renderer (src/renderer/src/)
├── main.tsx
└── App.tsx
    ├── store/index.ts
    └── components/
        ├── AppShell.tsx → MainLayout.tsx
        ├── CapturePage.tsx
        ├── ChallengesPage.tsx
        ├── LearnPage.tsx
        └── SettingsPage.tsx
```

## Module Index

### Main Process (src/main/)

#### Capture Engine (capture/)

- **index.ts** — CaptureEngine orchestrator; worker lifecycle; live capture via CapSource on main thread
- **cap-source.ts** — Live capture via libpcap/Npcap; runs on main thread; link-type normalization via `LINK_TYPE_MAP`
- **capture-controller.ts** — Worker-side state machine: idle→file/simulated→idle
- **capture-worker.ts** — Worker thread entry point: file/simulated pipeline
- **pcap-file-source.ts** — PCAP file streaming via pcap-parser (worker thread)
- **simulated-replay-source.ts** — Timed replay with speed control 0.5×–5× (worker thread)
- **worker-supervisor.ts** — Auto-restart on worker crash (500ms delay); rebinds CaptureEngine on replacement
- **ipc-batcher.ts** — Batches AnonPackets (50ms or 100 packets); sole emitter of `packet:batch`
- **errors.ts** — Platform-aware error normalization → `CaptureError`

**Key APIs:**
- `CaptureEngine.startCapture(iface)` — Begin live capture (main thread)
- `CaptureEngine.startFile(path)` — Stream PCAP file (worker)
- `CaptureEngine.startSimulated(path, speed)` — Simulated replay (worker)

#### Parser (parser/)

- **index.ts** — Protocol decoder: Ethernet→IPv4/IPv6→TCP/UDP/ICMP/DNS/ARP
- `Parser.parse(RawPacket)` → `ParsedPacket`
- `Parser.print(ParsedPacket)` → PCAP bytes (for export)
- Unknown protocols → `protocol: 'OTHER'`; malformed → partial decode with error annotation
- `rawByteLength` on transport layers is header length only (anonymizer uses `rawByteOffset + rawByteLength` as `payloadStart`)

#### Anonymizer (anonymizer/)

- **index.ts** — HMAC-based payload pseudonymization at IPC boundary
- `Anonymizer.anonymize(ParsedPacket)` → `AnonPacket`
- Session key: 32 bytes, generated once, never exported
- Algorithm: `sha256(SESSION_KEY || payload).slice(0, 8)` hex
- DNS: query name/type preserved; answer IPs anonymized

#### Packet Buffer (packet-buffer/)

- **index.ts** — Ring buffer (1K–100K capacity, default 10K); stores `ParsedPacket`
- `push()`, `getAll()`, `getRange()`, `clear()`, `setCapacity()`
- Events: `'change'`, `'overflow'`

#### Filter Engine (filter-engine/)

- **lexer.ts** — Single-pass tokenizer
- **parser.ts** — Recursive-descent parser → `FilterAST`
- **evaluator.ts** — Read-only evaluation against `AnonPacket[]`
- **index.ts** — Public `parse()` and `evaluate()` exports
- Fields: `proto`, `src`, `dst`, `port`, `len`, `ts`; operators: `AND`, `OR`, `NOT`

#### Logger (logger/)

- **index.ts** — Pino structured logging; file: `userData/netvis.log`; rotation: 10MB, retain 2 files

#### Settings Store (settings-store/)

- **index.ts** — Persistent settings (`userData/settings.json`)
- Fields: `bufferCapacity`, `theme`, `welcomeSeen`, `completedChallenges`, `reducedMotion`
- `get()`, `set(patch)`, emits `'change'`

#### IPC Layer

- **ipc-handlers.ts** — All `ipcMain.handle()` registrations; Zod validation (IPC-SEC-01)
- **ipc-schemas.ts** — Zod schemas for all IPC payloads
- **buffer-stats-throttler.ts** — Throttles `buffer:stats` push channel to ≤500ms

### Preload (src/preload/)

- **index.ts** — contextBridge exposing `window.electronAPI`
- **index.d.ts** — Type definitions for `window.electronAPI`

### Renderer (src/renderer/src/)

- **main.tsx** — React entry point; ErrorBoundary wrapper
- **App.tsx** — Root component; wires IPC push channels; loads initial settings/packets
- **store/index.ts** — Zustand store: packets, filter, captureStatus, interfaces, theme, challenges, bufferStats

#### Components (components/)

**Layout**
- **AppShell.tsx** — Main layout container
- **MainLayout.tsx** — Page routing (Capture / Challenges / Learn / Settings)
- **Toolbar.tsx**, **StatusBar.tsx**, **SidebarNav.tsx** — Shell chrome
- **ErrorBoundary.tsx** — React error boundary; shows message on render crash

**Capture**
- **CapturePage.tsx** — Main capture view with visualizations
- **CaptureControls.tsx** — Start/Stop/Simulated buttons; file selection
- **InterfaceSelector.tsx** — Network interface dropdown; owns `getInterfaces()` lifecycle
- **CaptureActiveIndicator.tsx** — Pulsing dot during active capture
- **CaptureToolbarActions.tsx** — Toolbar-level capture actions

**Packet Inspection**
- **PacketList.tsx** — Virtualized packet table (@tanstack/virtual); keyboard nav; ARIA
- **PacketDetailInspector.tsx** — Collapsible protocol tree; hex strip; slide-in animation
- **FilterBar.tsx** — Filter expression input; 300ms debounce; error display
- **HelpIcon.tsx** — Radix UI Tooltip with help text

**Visualizations**
- **ProtocolChart.tsx** — Recharts PieChart; protocol distribution; accessible table
- **PacketFlowTimeline.tsx** — 60-bucket BarChart; click → time-range filter
- **BandwidthChart.tsx** — Recharts stacked area; 60s window anchored to latest packet
- **OSILayerDiagram.tsx** — 7-layer OSI stack; active-layer highlighting; keyboard nav
- **IPFlowMap.tsx** — D3 force simulation; node/edge click → filter expression
- **ProtocolAnimations.tsx** — TCP handshake, DNS query, ICMP echo; play/pause/step
- **VisualizationPane.tsx** — Container for visualization components

**Utilities**
- **bandwidth-utils.ts** — Bandwidth chart data aggregation
- **ip-flow-utils.ts** — IP flow graph construction
- **packet-flow-utils.ts** — Timeline bucket aggregation

**Educational / Challenges**
- **ChallengesPage.tsx** — Challenge library and progress tracking
- **ChallengePanel.tsx** — Goal, criteria, hint, completion; 500ms debounced evaluation
- **ChallengeSelector.tsx** — Challenge list
- **LearnPage.tsx** — Educational content and protocol explanations

**Settings / Onboarding**
- **SettingsPage.tsx** — Full settings page
- **AdvancedSettingsPanel.tsx** — Buffer capacity, theme, reduced motion, log folder
- **WelcomeScreen.tsx** — First-launch onboarding overlay; persisted via Settings_Store
- **LoadingSplash.tsx** — Startup loading indicator
- **ThemeToggle.tsx** — Dark/light/warm-dark/system toggle

**UI Primitives (components/ui/)**
Radix UI wrappers: Accordion, AlertDialog, Checkbox, Collapsible, Dialog, DropdownMenu, HoverCard, Label, Popover, Progress, RadioGroup, ScrollArea, Select, Separator, Slider, Switch, Tabs, ToggleGroup, Tooltip, Sonner (toasts)

### Data & Constants (renderer/src/)

- **data/challenges.ts** — 5 guided challenges (TCP handshake, DNS, ICMP echo, port filter, length compare)
- **data/field-explanations.json** — Protocol field explanations (Ethernet, IPv4, IPv6, ARP, TCP, UDP, ICMP, DNS)
- **data/help-text.json** — UI control help text
- **data/learn-topics.ts** — Educational content topics
- **constants/protocol-colors.ts** — Fixed palette: TCP `#4E9CE8`, UDP `#9B7FE8`, ICMP `#E8A030`, DNS `#35B890`, ARP `#D678A8`, IPv4 `#D4824A`, IPv6 `#4AB8D4`, OTHER `#7A7A86`
- **constants/animations.ts** — Animation duration constants
- **lib/packet-analysis.ts** — Packet analysis utilities
- **lib/proto-tokens.ts** — Protocol token definitions

### Shared Types (src/shared/)

- **capture-types.ts** — `RawPacket`, `ParsedPacket`, `AnonPacket`, `ParsedLayer`, `ParsedField`, `CaptureStatus`, `BufferStats`, `NetworkInterface`, `SpeedMultiplier`, `Theme`
- **ipc-types.ts** — `ElectronAPI` interface contract; `InterfaceResult`; `Unsubscribe`

### Tests (src/__tests__/)

#### Main Process (main/)

- **anonymizer.property.test.ts** — P6: Anonymization invariants
- **buffer-stats-throttling.unit.test.ts** — Throttler behavior
- **capture-command-semantics.property.test.ts** — Command/ack protocol
- **capture-import-batching.test.ts** — Import batching
- **capture-interface-enumeration.test.ts** — Interface enumeration
- **file-mode-status-flow.test.ts** — File capture status transitions
- **filter-engine.property.test.ts** — P8: Filter parse/evaluate round trip
- **interface-enumeration-completeness.property.test.ts** — P1: Interface completeness
- **ipc-input-sanitization.property.test.ts** — P17: IPC input validation
- **ipc-interface-probe.test.ts** — IPC channel availability
- **logger.unit.test.ts** — Logger functionality
- **packet-buffer-overflow.unit.test.ts** — Overflow semantics
- **packet-buffer.property.test.ts** — P2: Ring buffer invariants
- **packet-buffer.unit.test.ts** — Buffer operations
- **parser-layer-ordering.property.test.ts** — P4: Layer ordering
- **parser-payload-boundaries.unit.test.ts** — Payload boundary validation
- **parser-round-trip.property.test.ts** — P5: Parse→print→parse consistency
- **phase1-bugfixes.unit.test.ts** — Phase 1 bugfix regressions
- **phase2-bugfixes.property.test.ts** — Phase 2 property regressions
- **phase2-bugfixes.unit.test.ts** — Phase 2 unit regressions
- **settings-store.unit.test.ts** — Settings persistence
- **simulated-replay.property.test.ts** — P3: Replay timing

#### Renderer (renderer/)

- **store.unit.test.ts** — Zustand store (43 tests, no mocks)
- **packet-list-virtualization.unit.test.ts** — Virtualized list rendering
- **packet-detail-rendering.property.test.ts** — P12: Packet detail completeness
- **protocol-distribution-correctness.property.test.ts** — P10: Protocol distribution
- **timeline-bucket-construction.property.test.ts** — P19: Timeline bucket aggregation
- **time-range-filter-generation.property.test.ts** — P20: Time-range filter
- **bandwidth-chart-data-correctness.property.test.ts** — Bandwidth aggregation
- **osi-layer-rendering.property.test.ts** — OSI layer diagram
- **ip-flow-graph-construction.property.test.ts** — IP flow graph
- **ip-flow-filter-generation.property.test.ts** — IP flow filter generation
- **protocol-animation-step-highlighting.property.test.ts** — Animation highlighting
- **protocol-color-invariant.property.test.ts** — P18: Protocol color consistency
- **challenge-activation-rendering.property.test.tsx** — P13: Challenge rendering
- **challenge-completion-persistence.property.test.ts** — P14: Challenge persistence
- **challenge-page-flow.test.tsx** — Challenge page navigation
- **challenge-panel-persistence.test.tsx** — Challenge panel state
- **filter-by-port-challenge.test.ts** — Port filter challenge
- **field-explanation-completeness.property.test.ts** — P11: Field explanation coverage
- **help-text-completeness.unit.test.ts** — Help text coverage
- **accessibility-and-status-regressions.test.tsx** — Accessibility compliance
- **capture-controls-feedback.test.tsx** — Capture control UI feedback
- **interface-selector-enumeration.test.tsx** — Interface selector
- **learn-page-live-bridge.test.tsx** — Learn page integration
- **status-bar-overflow-notice.test.ts** — Overflow notification
- **theme-persistence-and-init.test.tsx** — Theme initialization
- **test-utils.ts** — `renderWithStore`, `resetStore`, `mockElectronAPI`, `makeAnonPacket`
- **setup.ts** — jsdom test environment setup

## Data Flow

```
Live Capture:
  CapSource (main thread) → Parser (main thread) → PacketBuffer
  → Anonymizer → IpcBatcher → packet:batch → Renderer

PCAP File:
  PcapFileSource (worker) → CaptureWorker → Parser (worker)
  → [main thread] PacketBuffer → Anonymizer → IpcBatcher → packet:batch → Renderer

Simulated Replay:
  SimulatedReplaySource (worker) → CaptureWorker → Parser (worker)
  → [main thread] PacketBuffer → Anonymizer → IpcBatcher → packet:batch → Renderer

Filter:
  Renderer (FilterBar 300ms debounce) → filter:apply IPC
  → FilterEngine.parse() + FilterEngine.evaluate(PacketBuffer.getAll())
  → AnonPacket[] → Renderer (generation-guarded)
```
