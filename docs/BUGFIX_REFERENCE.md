# NetVis Bugfix Reference

**Last updated:** 2026-05-02

This file consolidates the historical one-off bugfix notes that previously lived as separate root-level documents. Keep future fix summaries here unless a change requires a canonical architecture or requirements update.

## Current Fix Policy

- Prefer source-code comments and tests for low-level detail.
- Record durable bugfix decisions here.
- Update `docs/ARCHITECTURE.md` when a fix changes an architectural invariant.
- Update `.kiro/specs/netvis-core/design.md` when a fix changes canonical contracts.
- Do not use dated root-level `*_FIX*.md` files for new fixes.

## Consolidated Fixes

### Live Capture Runs on Main Thread

**Problem:** Running `cap`/Npcap live capture in a worker could crash Electron on Windows because `pcap_dispatch` native callbacks used an invalid worker Node environment pointer.

**Fix:** Move live `CapSource` capture to the main process thread. File import and simulated replay remain in the worker.

**Files:** `src/main/capture/index.ts`, `src/main/capture/cap-source.ts`, `src/main/capture/capture-worker.ts`.

**Regression coverage:** Capture command semantics, live/file mode status flow, and capture interface tests.

### Worker Command/Ack Lifecycle

**Problem:** Capture commands could be fire-and-forget or settle from the wrong lifecycle event, creating races during start, stop, import, or worker restart.

**Fix:** Worker commands carry request IDs. The main process resolves or rejects pending promises only from matching `command-ok`, `command-error`, or `command-complete` events.

**Files:** `src/main/capture/index.ts`, `src/main/capture/capture-worker.ts`, `src/main/capture/worker-supervisor.ts`.

### Stop and Status Flow

**Problem:** UI could remain in a stale starting/stopping state or clear the selected interface after capture stopped.

**Fix:** Capture status is pushed authoritatively, stopped state transitions to idle after a short delay, and renderer-selected interface state is preserved after idle/stopped/error. Current capture interface and selected interface are treated separately.

**Files:** `src/main/ipc-handlers.ts`, `src/renderer/src/store/index.ts`, `src/renderer/src/components/CaptureControls.tsx`, `src/renderer/src/components/CaptureToolbarActions.tsx`.

### Interface Recommendation and Persistence

**Problem:** The app could recommend VPN/TAP adapters such as Express TAP over a physical Ethernet adapter because all capture devices were marked `isUp: true` and then sorted by weak string heuristics.

**Fix:** Enrich capture interfaces with local Windows adapter metadata when available, classify adapter kind, score recommendations, label specialized adapters, add persisted default-interface settings, and keep local addresses hidden in normal UI.

**Files:** `src/main/capture/index.ts`, `src/shared/interface-classification.ts`, `src/shared/capture-types.ts`, `src/main/settings-store/index.ts`, `src/main/ipc-schemas.ts`, `src/renderer/src/components/InterfaceSelector.tsx`, `src/renderer/src/components/SettingsPage.tsx`, `src/renderer/src/store/index.ts`.

**Regression coverage:** `capture-interface-enumeration.test.ts`, `settings-store.unit.test.ts`, `ipc-input-sanitization.property.test.ts`, `interface-selector-enumeration.test.tsx`, `store.unit.test.ts`.

### Interface Enumeration Safety

**Problem:** Calling `Cap.deviceList()` while live capture was active could be unsafe with native capture callbacks.

**Fix:** The renderer avoids re-enumerating interfaces while capture is active, and enumeration failures return structured `InterfaceResult` errors instead of collapsing to an empty list.

**Files:** `src/main/capture/index.ts`, `src/renderer/src/components/InterfaceSelector.tsx`, `src/shared/ipc-types.ts`.

### Link-Type Normalization

**Problem:** `cap.open()` can return string link types such as `ETHERNET` while the parser expects numeric libpcap link-layer constants.

**Fix:** Normalize known link-type strings through `LINK_TYPE_MAP`; log unknown values once and map them to `-1`.

**Files:** `src/main/capture/cap-source.ts`.

### Parser Bounds and Protocol Validation

**Problem:** Malformed TCP, UDP, and DNS packet lengths could produce incorrect parsing behavior or unsafe assumptions.

**Fix:** Harden header-size checks, TCP data offset validation, UDP minimum length handling, and DNS dispatch gates based on UDP-declared payload length.

**Files:** `src/main/parser/index.ts`.

**Regression coverage:** Parser payload boundary and round-trip tests.

### PCAP Import Completion

**Problem:** Large imports could time out or report completion before worker streaming actually finished.

**Fix:** Import waits for `command-complete`; import timeout was extended for large files; packet batches remain suppressed or emitted according to import mode ownership.

**Files:** `src/main/capture/index.ts`, `src/main/ipc-handlers.ts`.

### Simulated Replay Speed Changes

**Problem:** Changing replay speed during active replay could leave state inconsistent.

**Fix:** Speed changes stop and restart simulated replay with the new multiplier.

**Files:** `src/renderer/src/components/CaptureControls.tsx`.

### Filter Engine Timestamp Support

**Problem:** Timeline-generated filters used `ts` expressions before the filter engine recognized `ts`.

**Fix:** Add `ts` as a supported filter field and compare it against `packet.timestamp`.

**Files:** `src/main/filter-engine/lexer.ts`, `src/main/filter-engine/parser.ts`, `src/main/filter-engine/evaluator.ts`.

### Filter Staleness and Concurrency

**Problem:** Concurrent `filter:apply` calls could let stale results overwrite newer renderer state. PCAP import could also leave an obsolete filter active.

**Fix:** Renderer filter calls use a generation counter, and imports clear stale filters when appropriate.

**Files:** `src/renderer/src/store/index.ts`, `src/renderer/src/components/CaptureControls.tsx`.

### Single Anonymization in Filtering

**Problem:** Filter results could be anonymized twice, producing identifiers inconsistent with `buffer:getAll`.

**Fix:** Anonymize once before filtering and return already-anonymized matched packets.

**Files:** `src/main/ipc-handlers.ts`.

### Buffer Capacity and Overflow

**Problem:** Buffer resize and overflow behavior needed stable ring-buffer semantics and UI feedback.

**Fix:** Capacity changes retain the newest packets, overflow emits a renderer-visible notification, and buffer stats are throttled.

**Files:** `src/main/packet-buffer/index.ts`, `src/main/buffer-stats-throttler.ts`, `src/renderer/src/components/StatusBar.tsx`.

### Initial Buffer Stats

**Problem:** Renderer buffer status could be stale immediately after load.

**Fix:** Send initial `buffer:stats` on `did-finish-load` and throttle later updates.

**Files:** `src/main/index.ts`, `src/main/buffer-stats-throttler.ts`.

### Challenge Completion Persistence

**Problem:** Completed challenges could be lost after restart.

**Fix:** Persist completed challenge IDs through `Settings_Store`.

**Files:** `src/renderer/src/store/index.ts`, `src/renderer/src/components/ChallengePanel.tsx`, `src/main/settings-store/index.ts`.

### Theme Validation and Warm-Dark Support

**Problem:** `warm-dark` could be rejected or fail to apply consistently.

**Fix:** Add `warm-dark` to shared theme types, settings validation, renderer class application, and IPC schema validation.

**Files:** `src/shared/capture-types.ts`, `src/main/settings-store/index.ts`, `src/main/ipc-schemas.ts`, `src/renderer/src/store/index.ts`.

### Protocol Color Consistency

**Problem:** Protocol color constants could be missing or inconsistent, causing runtime crashes and mismatched visualizations.

**Fix:** Restore protocol color exports and lock protocol palette usage across visualizations.

**Files:** `src/renderer/src/constants/protocol-colors.ts`, visualization components.

### Bandwidth Chart Import Window

**Problem:** Imported PCAP timestamps could be far from `Date.now()`, leaving the bandwidth chart empty.

**Fix:** Anchor the chart window to the latest packet timestamp instead of wall-clock time.

**Files:** `src/renderer/src/components/BandwidthChart.tsx`, `src/renderer/src/components/bandwidth-utils.ts`.

### Packet Timeline Data Table

**Problem:** The packet-flow timeline data table had layout and expansion issues.

**Fix:** Repair table expansion and spacing so bucket counts are visible and scrollable.

**Files:** `src/renderer/src/components/PacketFlowTimeline.tsx`.

### Filter Bar and Toolbar Layout

**Problem:** The filter bar and interface selector could crowd or clip in the toolbar.

**Fix:** Improve flex behavior, width constraints, and selector row spacing.

**Files:** `src/renderer/src/components/FilterBar.tsx`, `src/renderer/src/components/Toolbar.tsx`, `src/renderer/src/components/InterfaceSelector.tsx`.

### Error Boundary and Fast Refresh

**Problem:** Renderer errors could blank the app, and component files with non-component exports could break Fast Refresh behavior.

**Fix:** Add an error boundary and move reusable utilities into separate utility modules.

**Files:** `src/renderer/src/components/ErrorBoundary.tsx`, `src/renderer/src/components/*-utils.ts`.

### Design System and Responsive Hardening

**Problem:** The UI needed stronger visual hierarchy, consistent scrolling, and better small-window behavior.

**Fix:** Add surface/elevation tokens, global scrollbar styling, responsive layout handling, and minimum-size messaging.

**Files:** `src/renderer/src/assets/theme.css`, `src/renderer/src/components/AppShell.tsx`, `src/renderer/src/components/Toolbar.tsx`, `src/renderer/src/components/StatusBar.tsx`, layout and visualization components.

## Deprecated One-Off Notes

The following root-level notes were consolidated into this reference:

- `ALL_FIXES_APPLIED.md`
- `DIAGNOSTIC_FIXES_APPLIED.md`
- `FILTERBAR_FIX.md`
- `FIXES_APPLIED.md`
- `FIXES_SUMMARY.md`
- `LIVE_CAPTURE_FIX.md`
- `QUICK_DIAGNOSTIC_GUIDE.md`
- `URGENT_FIXES.md`

Other visual or research documents remain in `docs/` when they are still useful as design history or inventories.
