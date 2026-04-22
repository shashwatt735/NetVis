# Technology Stack

**Last Modified:** 2026-04-22

## Core Framework

- **Electron 40.x** - Cross-platform desktop framework
- **React 19.x** - UI framework
- **TypeScript 5.x** - Type-safe development with strict mode enabled
- **Vite 7.x** - Build tool and dev server

## Main Process Libraries

- **cap** - Live packet capture (libpcap/Npcap wrapper)
- **pcap-parser** - PCAP file streaming
- **pino** - Structured JSON logging
- **pino-roll** - Log rotation (10MB, retain 2 files)
- **zod** - Schema validation for IPC payloads

## Testing

- **Vitest** - Unit, integration, and property test runner
- **fast-check** - Property-based testing framework with a minimum of 100 iterations per property case

Implementation counts, pass counts, and completion status are not tracked in this steering file.

## Code Quality

- **ESLint** - Linting with TypeScript support
- **Prettier** - Code formatting
- **TypeScript strict mode** - Enforced across all source files

## Build System

- **electron-vite** - Electron-specific Vite configuration
- **electron-builder** - Application packaging for Windows/macOS/Linux

## Common Commands

```bash
# Development
npm run dev              # Start development server
npm test                 # Run all tests once
npm run test:watch       # Run tests in watch mode
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
npm run typecheck        # Type-check all TypeScript files

# Building
npm run build            # Development build
npm run build:staging    # Staging build
npm run build:prod       # Production build
npm run build:win        # Package for Windows
npm run build:mac        # Package for macOS
npm run build:linux      # Package for Linux
```

## Environment Variables

- **VITE_PHASE** - Feature phase flag (default: 2)
- **__DEV_OVERLAY__** - Compile-time flag injected by Vite for development-only overlay logic

## Platform Requirements

- **Windows:** Npcap installation required for live capture
- **Linux:** libpcap + capabilities (`setcap cap_net_raw,cap_net_admin=eip`)
- **macOS:** libpcap (built-in) + sudo or System Preferences permissions

## Technical Invariants

### Data Flow and Storage

- **PacketBuffer stores ParsedPacket, not AnonPacket**
- **Only AnonPacket may cross IPC to the renderer**
- **Anonymization happens in the privileged domain at the IPC boundary before renderer delivery**
- **Renderer-visible packet delivery uses `packet:batch` as the authoritative push channel**

### Thread Ownership

- **Worker thread owns:** `PcapFileSource`, `SimulatedReplaySource`, `CaptureController`, `Parser`
- **Main process owns:** `CapSource` (live capture — runs on main thread due to Npcap/pcap_dispatch native thread safety on Windows), `CaptureEngine` orchestration, `WorkerSupervisor`, `Packet_Buffer`, `Anonymizer`, `IpcBatcher`, `Logger`, `Settings_Store`, and all IPC handlers
- **Renderer owns:** React UI, Zustand store, visualization rendering, and educational UX only

> **Design note:** `CapSource` was moved from the worker thread to the main thread to resolve a native crash on Windows. The `cap` library's `pcap_dispatch` runs a background OS thread whose callbacks fire into the Node.js environment. In a `worker_threads` Worker, that environment pointer becomes invalid under Electron 40.x on Windows, causing an `(env) != nullptr` assertion crash. Running `CapSource` on the stable, long-lived main-process environment eliminates this crash. File and simulated replay sources remain in the worker thread since they use Node.js streams which are safe in workers.

### IPC and Validation

- **IPC is typed through shared contracts**
- **All renderer-to-main IPC payloads are schema-validated in the main process**
- **IPC handlers do not synthesize success state beyond the canonical privileged-domain sources of truth**

### Ownership and Lifecycle

- **One owner per request lifecycle:** timeout registration, listener registration, cleanup, and completion belong to the same subsystem
- **One owner per renderer-visible push channel**

### Worker Management

- **Worker replacement after crash must be explicit**, and `CaptureEngine` must rebind to the replacement worker before accepting further requests
- **Worker startup viability is a hard prerequisite** before deeper runtime fixes
