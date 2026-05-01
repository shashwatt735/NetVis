# NetVis Code Index

This index is a quick orientation map for collaborators. It names the major
runtime modules, the ownership boundaries between Electron processes, and the
tests that protect the core behavior. For deeper design rationale, see
[ARCHITECTURE.md](ARCHITECTURE.md) and [PROJECT_DESIGN.md](PROJECT_DESIGN.md).

## Runtime Map

```text
src/main/index.ts
  -> ipc-handlers.ts
  -> capture/
       -> index.ts                      CaptureEngine facade
       -> cap-source.ts                 live Npcap/libpcap capture on main thread
       -> capture-controller.ts         worker-side file/simulated state machine
       -> capture-worker.ts             worker entry point
       -> pcap-file-source.ts           PCAP import source
       -> simulated-replay-source.ts    timed replay source
       -> worker-supervisor.ts          worker restart and lifecycle supervision
       -> ipc-batcher.ts                packet batch emission
       -> errors.ts                     platform-aware capture errors
  -> parser/                            Ethernet/IP/TCP/UDP/ICMP/DNS/ARP decoder
  -> anonymizer/                        IPC-boundary payload pseudonymization
  -> packet-buffer/                     bounded packet ring buffer
  -> filter-engine/                     filter lexer, parser, and evaluator
  -> settings-store/                    persisted local settings
  -> logger/                            local rotating log file
  -> buffer-stats-throttler.ts          throttled buffer status channel
  -> ipc-schemas.ts                     Zod validation for IPC payloads

src/preload/index.ts
  -> contextBridge                      typed ElectronAPI surface

src/renderer/src/
  -> main.tsx                           React entry point
  -> App.tsx                            root wiring for IPC, settings, and store init
  -> store/index.ts                     Zustand application state
  -> components/                        capture, visualization, learning, settings UI
  -> lib/interface-display.ts           privacy-safe interface labels

src/shared/
  -> capture-types.ts                   shared packet, capture, interface, and settings types
  -> interface-classification.ts        interface classification and recommendation helpers
  -> ipc-types.ts                       preload and renderer IPC contracts
```

## Main Process

### Capture Engine

- `capture/index.ts` owns the public `CaptureEngine` facade, worker lifecycle,
  live capture start/stop, interface enumeration, and interface enrichment.
- `capture/cap-source.ts` owns live packet capture through Cap/Npcap. Live
  capture remains on the main thread because native capture handles do not
  transfer reliably to worker threads.
- `capture/capture-worker.ts`, `capture/capture-controller.ts`,
  `capture/pcap-file-source.ts`, and `capture/simulated-replay-source.ts` own
  worker-based file import and simulated replay.
- `capture/ipc-batcher.ts` is the sole source of `packet:batch` emissions.
- `capture/errors.ts` normalizes native and platform errors into user-facing
  capture errors.

### Interface Detection

- `CaptureEngine.getInterfaces()` starts with `Cap.deviceList()`.
- On Windows, the main process enriches capture devices with local OS metadata
  from adapter status, IP interface, route, and address information.
- `src/shared/interface-classification.ts` classifies interfaces as Ethernet,
  Wi-Fi, VPN, virtual, loopback, or unknown and computes recommendation scores.
- Raw local addresses and GUID-like identifiers are internal scoring data. The
  normal renderer UI uses privacy-safe labels from
  `src/renderer/src/lib/interface-display.ts`.

### Packet Pipeline

- `parser/index.ts` decodes packets into `ParsedPacket` records.
- `packet-buffer/index.ts` stores parsed packets in a bounded ring buffer.
- `anonymizer/index.ts` converts parsed packets into `AnonPacket` records before
  renderer delivery.
- `filter-engine/` parses and evaluates user filter expressions against the
  current buffer snapshot.

### Settings And IPC

- `settings-store/index.ts` persists local settings in Electron `userData`.
  Current settings include buffer capacity, theme, onboarding state, reduced
  motion, completed challenges, preferred interface, and auto-selection mode.
- `ipc-handlers.ts` registers all IPC handlers.
- `ipc-schemas.ts` validates every IPC payload with Zod before execution.
- `buffer-stats-throttler.ts` keeps buffer status updates from flooding the
  renderer.

## Preload

- `src/preload/index.ts` exposes the narrow `window.electronAPI` surface via
  Electron `contextBridge`.
- `src/preload/index.d.ts` defines renderer-visible types for that API.

## Renderer

### Application State

- `App.tsx` initializes settings, packets, interfaces, and push-channel
  subscriptions.
- `store/index.ts` owns packets, filtered packets, capture status, interface
  selection, buffer stats, theme, and challenge progress.

### Capture UI

- `components/CapturePage.tsx` is the primary capture workspace.
- `components/CaptureControls.tsx` owns capture, stop, simulated replay, and PCAP
  selection controls.
- `components/InterfaceSelector.tsx` owns interface list loading, recommended
  interface display, semantic labels, manual selection, and persisted preference
  behavior.
- `components/FilterBar.tsx` owns debounced filter expression input and filter
  error display.
- `components/PacketList.tsx` and `components/PacketDetailInspector.tsx` provide
  virtualized packet browsing and protocol-layer inspection.

### Visualizations

- `ProtocolChart.tsx` shows protocol distribution.
- `PacketFlowTimeline.tsx` shows packet volume over time and can generate
  time-range filters.
- `BandwidthChart.tsx` shows recent byte rates.
- `OSILayerDiagram.tsx` maps selected packets to the OSI model.
- `IPFlowMap.tsx` builds a source/destination graph and can generate endpoint
  filters.
- `ProtocolAnimations.tsx` provides guided protocol animations.
- `VisualizationPane.tsx` coordinates the visualization surface.

### Learning, Settings, And Shell

- `ChallengesPage.tsx`, `ChallengePanel.tsx`, and `ChallengeSelector.tsx` own the
  guided exercises and completion flow.
- `LearnPage.tsx` owns educational protocol content.
- `SettingsPage.tsx` exposes buffer, theme, motion, log, and default capture
  interface controls.
- `AppShell.tsx`, `MainLayout.tsx`, `Toolbar.tsx`, `SidebarNav.tsx`, and
  `StatusBar.tsx` provide the application shell.
- `ErrorBoundary.tsx` keeps renderer failures visible and recoverable.

## Shared Data

- `data/challenges.ts` defines the guided challenge catalog.
- `data/field-explanations.json` provides protocol field explanations.
- `data/help-text.json` provides help text for UI controls.
- `data/learn-topics.ts` defines the Learn page content.
- `constants/protocol-colors.ts` centralizes protocol color tokens.
- `constants/animations.ts` centralizes animation timing values.
- `lib/packet-analysis.ts`, `lib/bandwidth-utils.ts`, `lib/ip-flow-utils.ts`,
  and `lib/packet-flow-utils.ts` provide renderer-side derived data helpers.

## Tests

### Main Process Coverage

- Capture lifecycle: command semantics, file-mode status flow, import batching,
  interface enumeration, worker restart, and simulated replay timing.
- Packet correctness: parser layer ordering, payload boundaries, parse/print
  round trips, anonymization invariants, buffer overflow semantics, and filter
  engine behavior.
- Platform boundaries: IPC input validation, logger behavior, settings
  persistence, and buffer stats throttling.

### Renderer Coverage

- Store behavior, capture controls, interface selector behavior, packet list
  virtualization, packet detail rendering, filter flows, and status messages.
- Visualization correctness for protocol distribution, timelines, bandwidth,
  OSI layers, IP flow graphs, protocol colors, and animation highlighting.
- Education and onboarding behavior for challenge rendering, persistence,
  challenge page flow, help text, field explanations, theme initialization, and
  accessibility regressions.

## Data Flow

```text
Live capture:
  CapSource (main thread)
  -> Parser
  -> PacketBuffer
  -> Anonymizer
  -> IpcBatcher
  -> packet:batch
  -> Renderer store

PCAP import:
  PcapFileSource (worker)
  -> Parser (worker)
  -> main process PacketBuffer
  -> Anonymizer
  -> IpcBatcher
  -> packet:batch
  -> Renderer store

Simulated replay:
  SimulatedReplaySource (worker)
  -> Parser (worker)
  -> main process PacketBuffer
  -> Anonymizer
  -> IpcBatcher
  -> packet:batch
  -> Renderer store

Filtering:
  FilterBar
  -> filter:apply IPC
  -> FilterEngine.parse()
  -> FilterEngine.evaluate(PacketBuffer.getAll())
  -> filtered packet result
  -> Renderer store
```
