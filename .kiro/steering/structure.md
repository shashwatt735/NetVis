# Project Structure

**Last Modified:** 2026-04-22

## Directory Organization

```text
netvis/
├── .kiro/
│   ├── specs/
│   │   └── netvis-core/
│   │       ├── requirements.md
│   │       ├── design.md
│   │       └── tasks.md
│   └── steering/
│       ├── tech.md
│       ├── structure.md
│       └── product.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PROJECT_DESIGN.md
│   ├── PROJECT_STATUS.md
│   └── CHECKPOINT_*.md
├── src/
│   ├── main/                       # Electron main process (privileged orchestration)
│   │   ├── capture/                # CaptureEngine orchestration, WorkerSupervisor, and worker-thread code
│   │   │   ├── index.ts            # CaptureEngine public interface (live capture runs here on main thread)
│   │   │   ├── capture-worker.ts   # Worker thread entry point (file/simulated only)
│   │   │   ├── worker-supervisor.ts
│   │   │   ├── ipc-batcher.ts
│   │   │   ├── cap-source.ts       # Live capture — runs on MAIN thread (not worker) for Npcap safety
│   │   │   ├── pcap-file-source.ts # Executed in worker thread
│   │   │   ├── simulated-replay-source.ts # Executed in worker thread
│   │   │   ├── capture-controller.ts # Executed in worker thread (file/simulated only)
│   │   │   ├── npcap-path.ts       # Windows Npcap DLL path normalization
│   │   │   └── errors.ts
│   │   ├── parser/                 # Parser: called on main thread for live capture, worker thread for file/simulated
│   │   │   └── index.ts
│   │   ├── packet-buffer/          # Packet_Buffer (stores ParsedPacket)
│   │   ├── anonymizer/             # ParsedPacket -> AnonPacket at IPC boundary
│   │   ├── logger/                 # Structured logging
│   │   ├── settings-store/         # Persistent settings and challenge completion source of truth
│   │   ├── filter-engine/          # Main-process filter parsing/evaluation
│   │   ├── ipc-handlers.ts         # Typed IPC handlers
│   │   ├── ipc-schemas.ts          # Zod schemas for IPC validation
│   │   └── index.ts                # Main-process entry
│   ├── preload/
│   │   ├── index.ts                # contextBridge surface only
│   │   └── index.d.ts
│   ├── renderer/
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── main.tsx
│   │       ├── assets/
│   │       ├── components/
│   │       │   └── ui/
│   │       ├── constants/
│   │       ├── data/
│   │       └── store/
│   ├── shared/
│   │   ├── capture-types.ts
│   │   └── ipc-types.ts
│   └── __tests__/
│       ├── main/
│       └── renderer/
├── build/
├── out/
└── resources/
```

## Architecture Patterns

### Process Isolation

- **Worker Thread:** File and simulated replay sources, `CaptureController`, and `Parser` execute in the worker thread context (located in `src/main/capture/` and `src/main/parser/`): `PcapFileSource`, `SimulatedReplaySource`, `CaptureController`, `Parser`
- **Main Process:** `CapSource` (live capture — on main thread for Npcap/Windows native thread safety), privileged orchestration, worker supervision, buffering, anonymization, logging, settings persistence, and IPC handling
- **Preload Script:** Security boundary via contextBridge
- **Renderer Process:** React UI and educational visualization with no Node.js access

### Data Flow (Unidirectional)

```
Capture → Parser → Buffer → [IPC boundary: Anonymizer] → IPC → Renderer
```

### Security Invariants

- **ARCH-01:** Explicit IPC contract via contextBridge
- **ARCH-02:** `nodeIntegration: false`, `contextIsolation: true`
- **ARCH-03:** No remote URLs loaded
- **ARCH-04:** Anonymization in main process only
- **ARCH-05:** Unidirectional data flow
- **ARCH-06:** TypeScript strict mode
- **ARCH-07:** One owner per request lifecycle
- **ARCH-08:** One owner per renderer-visible push channel
- **ARCH-09:** Packet_Buffer stores ParsedPacket in the privileged domain; only AnonPacket crosses IPC to the renderer
- **ARCH-10:** Renderer-visible packet delivery only through `packet:batch` push channel
- **ARCH-11:** Live capture, file import, and simulated replay are separate user-initiated modes with no silent fallback
- **ARCH-12:** File path and target validation before PCAP operations
- **ARCH-13:** Platform-specific privilege minimization
- **ARCH-14:** Thread ownership: worker for file/simulated replay acquisition and parsing; main for live capture (`CapSource`), privileged operations, and IPC delivery; renderer for UI only

## File Naming Conventions

- **Components:** PascalCase (e.g., `PacketList.tsx`)
- **Utilities:** kebab-case (e.g., `ipc-handlers.ts`)
- **Types:** kebab-case with suffix (e.g., `capture-types.ts`)
- **Tests:** `*.test.ts` or `*.spec.ts` with descriptors (e.g., `parser-round-trip.property.test.ts`)

## Import Patterns

- Use relative imports within same module
- Use `@renderer` alias for renderer code (configured in Vite)
- Shared types imported from `src/shared/`

## Testing Organization

* Property-based tests live under `src/__tests__/main/` and `src/__tests__/renderer/`
* Unit tests live alongside the same main/renderer split
* Test files mirror the source architecture they validate
* Property-based tests use `fast-check` with a minimum of 100 iterations per property case

## Workflow and Authority Rules

### Document Hierarchy

- **Requirements are the normative source**
- **Architecture/design docs must refine requirements, not silently redefine them**
- **Tasks derive from the requirements/design chain**
- **Synopsis is historical intent only, not technical authority**

### Modification Protocol

- **Do not regenerate requirements/design/tasks from scratch** unless explicitly asked
- **Prefer in-place correction** of existing docs over replacement
- **Before code changes, verify steering, requirements, design, and tasks agree**
