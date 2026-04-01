# NetVis Project Status

**Last Updated:** 2026-04-01  
**Current Phase:** Phase 1 - Core Pipeline Integration  
**Status:** ✅ Tasks 1-11 Complete, Checkpoint Passed

---

## Overview

NetVis is a cross-platform desktop application for educational network packet visualization, built with Electron, React, and TypeScript. It enables beginner networking students to capture live network packets, load saved PCAP files, and explore protocol behavior through real-time visualizations.

---

## Architecture Summary

### Process Boundary Model

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Process                            │
│  ┌──────────────┐  ┌────────┐  ┌────────────┐  ┌─────────┐ │
│  │ Capture      │→ │ Parser │→ │ Anonymizer │→ │ Packet  │ │
│  │ Engine       │  │        │  │            │  │ Buffer  │ │
│  └──────────────┘  └────────┘  └────────────┘  └─────────┘ │
│         ↓              ↓             ↓              ↓        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              IPC Bridge (contextBridge)              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process                          │
│  ┌──────────┐  ┌────────────┐  ┌──────────────────────┐    │
│  │ Zustand  │→ │ Packet     │  │ Visualization        │    │
│  │ Store    │  │ List       │  │ Suite                │    │
│  └──────────┘  └────────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Security Architecture

- **ARCH-01:** IPC Bridge exposes only explicitly declared functions via `contextBridge`
- **ARCH-02:** `nodeIntegration: false`, `contextIsolation: true` enforced
- **ARCH-03:** No remote URLs loaded in BrowserWindow
- **ARCH-04:** Anonymizer runs entirely in main process
- **ARCH-05:** Unidirectional data flow enforced
- **ARCH-06:** TypeScript strict mode across all source files

---

## Completed Tasks (Phase 1)

### ✅ Task 1: Project Scaffold and Tooling

- TypeScript strict mode configured
- ESLint and Prettier integrated
- Build profiles: dev, staging, production
- VITE_PHASE environment variable support

### ✅ Task 2: Security Foundations

- BrowserWindow security configured
- CSP header via `session.webRequest.onHeadersReceived`
- Preload script skeleton with `contextBridge`
- Zod schemas for IPC validation

### ✅ Task 3: Capture Engine - Core Types

- `RawPacket`, `CaptureError`, `CaptureErrorCode` types
- Error normalization with platform-specific hints
- Windows/Linux/macOS error mapping

### ✅ Task 4: Capture Engine - PacketSource Implementations

- **CapSource:** Live capture via libpcap/Npcap
  - Buffer copy to prevent reuse issues
  - Truncation drop handling
  - Idempotent stop
- **PcapFileSource:** Streaming PCAP file reader
  - Correct microsecond timestamp handling
  - MAX_FRAME_SIZE guard (65535 bytes)
- **SimulatedReplaySource:** Replay with speed control
  - Streaming mode (no full file preload)
  - Pause/resume support
  - Delay clamped to 2000ms

### ✅ Task 5: Capture Engine - Controller and Batching

- **CaptureController:** State machine (idle → live/file/simulated → idle)
- **WorkerSupervisor:** 500ms restart on unexpected exit
- **IpcBatcher:** 50ms / 100-packet flush policy
- Worker thread message protocol
- Property tests: P2 (ring-buffer capacity), P3 (simulated order)

### ✅ Task 6: Parser and Pretty_Printer

- Protocol decoding: Ethernet → IPv4/IPv6 → TCP/UDP/ICMP/DNS/ARP
- Unknown protocol handling (protocol: 'OTHER')
- Malformed packet handling (partial decode with error annotation)
- Round-trip property: parse → print → parse preserves fields
- Property tests: P4 (layer ordering), P5 (parse-print round trip)

### ✅ Task 7: Anonymizer

- HMAC session key generation (32 bytes, never exported)
- Transport payload replacement: `sha256(key || payload)[0..7]`
- DNS answer IP anonymization (preserves query name and type)
- Key never written to disk, log, IPC, or PCAP
- Property test: P6 (anonymization invariant)

### ✅ Task 8: Packet_Buffer

- Ring buffer with fixed-size circular array
- Configurable capacity: 1,000–100,000 (default 10,000)
- `push()`, `getAll()`, `getRange()`, `clear()` methods
- `'change'` and `'overflow'` events
- Unit tests for boundary conditions

### ✅ Task 9: Logger

- Pino-based structured JSON logging
- Log file: `userData/netvis.log`
- Rotation: 10MB, retain 2 files
- DEBUG suppressed in production
- LOG-SEC-01: No payload content in logs
- Uncaught exception handler
- Property test: P16 (logger entry structure)

### ✅ Task 10: Settings_Store

- Persistent settings in `userData/settings.json`
- Default values: bufferCapacity (10000), theme (system), welcomeSeen (false)
- Handles missing/corrupt files gracefully
- `'change'` event emission
- Unit tests for defaults, patch merge, persistence

### ✅ Task 11: IPC Bridge - Full Implementation

- All channels implemented with zod validation
- Capture control: `getInterfaces`, `start`, `stop`, `startSimulated`
- PCAP: `import`, `startFile`, `export`
- Buffer: `clear`, `setCapacity`, `getAll`
- Settings: `get`, `set`
- Push channels: `packet:batch`, `capture:status`, `buffer:overflow`, `buffer:stats`
- Property test: P17 (input sanitization)

---

## Test Coverage

### Test Files (9 total, 86 tests)

1. **anonymizer.property.test.ts** - P6: Anonymization invariant
2. **ipc-input-sanitization.property.test.ts** - P17: Input sanitization (13 properties)
3. **logger.unit.test.ts** - Logger functionality and rotation
4. **packet-buffer.property.test.ts** - P2: Ring-buffer capacity invariant
5. **packet-buffer.unit.test.ts** - Boundary conditions
6. **parser-layer-ordering.property.test.ts** - P4: Parser layer ordering
7. **parser-round-trip.property.test.ts** - P5: Parse-print round trip
8. **settings-store.unit.test.ts** - Settings persistence and validation
9. **simulated-replay.property.test.ts** - P3: Simulated capture order

### Property-Based Tests

All property tests use `fast-check` with minimum 100 iterations:

- P2: Ring-buffer capacity invariant
- P3: Simulated capture preserves packet order
- P4: Parser layer ordering
- P5: Parse-print round trip
- P6: Anonymization invariant
- P16: Logger entry structure
- P17: Input sanitization (13 sub-properties)

---

## Code Quality Metrics

### ✅ All Checks Passing

- **Tests:** 86/86 passing (10.25s runtime)
- **ESLint:** 0 errors, 0 warnings
- **Prettier:** All files formatted
- **TypeScript:** Strict mode, 0 diagnostics
- **Security:** All ARCH invariants enforced

### 🐛 Bug Fixes (2026-04-01)

Three bugs identified and fixed during post-checkpoint review:
1. **Bug #1 (Moderate):** Anonymizer hashing entire frame instead of payload only - FIXED
2. **Bug #2 (High/Security):** Capture worker bypassing Anonymizer entirely - FIXED
3. **Bug #3 (Minor):** CaptureEngine calling packetHandler redundantly - FIXED

See [docs/BUGFIX_REPORT_2026-04-01.md](BUGFIX_REPORT_2026-04-01.md) for details.

---

## Technology Stack

### Core

- **Electron:** 34.x (cross-platform desktop)
- **React:** 18.x (UI framework)
- **TypeScript:** 5.x (strict mode)
- **Vite:** 6.x (build tool)

### Main Process

- **cap:** Live packet capture (libpcap/Npcap)
- **pcap-parser:** PCAP file streaming
- **pino:** Structured logging
- **pino-roll:** Log rotation
- **zod:** IPC schema validation

### Testing

- **Vitest:** Test runner
- **fast-check:** Property-based testing

### Code Quality

- **ESLint:** Linting
- **Prettier:** Code formatting

---

## Next Steps

### Task 12: ✅ Checkpoint - Core Pipeline Integration

**Status:** Complete - All tests pass, code quality verified

### Task 13: Zustand Store and Renderer Bootstrap

**Status:** Not Started

- Install Zustand
- Create `NetVisStore` with full shape
- Wire IPC listeners in `App.tsx`
- Load initial settings and packets on mount

### Upcoming (Phase 1)

- Task 14: MUI theme and Visual Design System
- Task 15: AppShell layout and Toolbar
- Task 16: Packet_List with virtualization
- Task 17: Packet_Detail_Inspector
- Task 18: Field explanation data and HelpIcon
- Task 19: Protocol_Chart
- Task 20: Packet_Flow_Timeline
- Task 21: Filter_Engine
- Task 22: PCAP import and export
- Task 23: Onboarding - WelcomeScreen
- Task 24: AdvancedSettingsPanel
- Task 25: Guided challenges
- Task 26: Privilege minimization setup
- Task 27: Checkpoint - Phase 1 complete
- Task 28: Property-based test suite completion

---

## Known Limitations

### Current Implementation

- Capture Engine IPC handlers are stubs (TODO in Task 22)
- No renderer UI yet (starts Task 13)
- PCAP import/export not wired to buffer (Task 22)

### Platform-Specific

- **Windows:** Requires Npcap installation
- **Linux:** Requires `cap_net_raw` and `cap_net_admin` capabilities
- **macOS:** Requires sudo or System Preferences permissions

---

## Development Commands

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run linter
npm run lint

# Format code
npm run format

# Build for development
npm run dev

# Build for production
npm run build
```

---

## File Structure

```
netvis/
├── .kiro/
│   └── specs/
│       └── netvis-core/
│           ├── requirements.md
│           ├── design.md
│           └── tasks.md
├── docs/
│   ├── PROJECT_STATUS.md (this file)
│   └── ARCHITECTURE.md (to be created)
├── src/
│   ├── main/
│   │   ├── capture/
│   │   ├── parser/
│   │   ├── anonymizer/
│   │   ├── packet-buffer/
│   │   ├── logger/
│   │   ├── settings-store/
│   │   ├── index.ts
│   │   ├── ipc-handlers.ts
│   │   └── ipc-schemas.ts
│   ├── preload/
│   │   └── index.ts
│   ├── renderer/
│   │   └── src/
│   ├── shared/
│   │   ├── capture-types.ts
│   │   └── ipc-types.ts
│   └── __tests__/
│       └── main/
└── package.json
```

---

## Contributing

This project follows the spec-driven development methodology:

1. Requirements define what to build
2. Design defines how to build it
3. Tasks break down implementation
4. Property-based tests validate correctness

All changes must:

- Pass all existing tests
- Add tests for new functionality
- Pass ESLint and Prettier checks
- Maintain TypeScript strict mode compliance
- Follow security architecture invariants

---

## License

[To be determined]
