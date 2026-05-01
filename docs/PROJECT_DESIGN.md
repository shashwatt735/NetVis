# Project Design

**Last Modified:** 2026-04-27

→ **Full Architecture:** See `ARCHITECTURE.md`  
→ **Requirements:** See `.kiro/specs/netvis-core/requirements.md`

---

## System Overview

NetVis is a cross-platform Electron desktop app for educational network packet visualization. It captures live packets, loads PCAP files, and provides real-time protocol visualizations with educational explanations.

---

## Architecture Principles

### ARCH-01: Explicit IPC Contract

IPC Bridge exposes only explicitly declared functions via `contextBridge`. No direct Node.js access from renderer.

### ARCH-02: Process Isolation

`nodeIntegration: false`, `contextIsolation: true` enforced. Renderer cannot access Node.js APIs.

### ARCH-03: No Remote Content

Application never loads remote URLs. All content is local.

### ARCH-04: Main-Process Anonymization

Anonymizer executes entirely in main process. Only anonymized data crosses IPC to renderer.

### ARCH-05: Unidirectional Data Flow

```
Capture → Parser → Buffer → [IPC boundary: Anonymizer] → IPC → Renderer
```

### ARCH-06: TypeScript Strict Mode

All source files use TypeScript strict mode for maximum type safety.

### ARCH-07: One Owner Per Request Lifecycle

One owner per request lifecycle: timeout registration, listener registration, cleanup, and completion belong to the same subsystem.

### ARCH-08: One Owner Per Push Channel

Each renderer-visible push channel has exactly one authoritative emitter. Only `IpcBatcher` emits `packet:batch`.

### ARCH-09: PacketBuffer Storage Invariant

`Packet_Buffer` stores `ParsedPacket` in the privileged domain; only `AnonPacket` crosses IPC to the renderer.

### ARCH-10: Authoritative Packet Push Channel

Renderer-visible packet delivery uses `packet:batch` as the sole authoritative push channel.

### ARCH-11: Separate Capture Modes

Live capture, file import, and simulated replay are separate user-initiated modes with no silent fallback.

### ARCH-12: File Path Validation

All file paths validated before PCAP operations (FILE-SEC-01).

### ARCH-13: Platform-Specific Privilege Minimization

Linux: `setcap`; Windows: Npcap Users group; macOS: `sudo` or Full Disk Access.

### ARCH-14: Thread Ownership

Worker owns file/simulated acquisition and parsing. Main owns live capture (`CapSource`), privileged operations, and IPC delivery. Renderer owns UI only.

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Process                           │
│  ┌──────────────┐  ┌────────┐  ┌─────────┐  ┌────────────┐  │
│  │ Capture      │→ │ Parser │→ │ Packet  │→ │ Anonymizer │  │
│  │ Engine       │  │        │  │ Buffer  │  │ (IPC edge) │  │
│  └──────────────┘  └────────┘  └─────────┘  └────────────┘  │
│         ↓              ↓             ↓              ↓       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              IPC Bridge (contextBridge)              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│                    Renderer Process                      │
│  ┌──────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │ Zustand  │→ │ Packet     │  │ Visualization        │  │
│  │ Store    │  │ List       │  │ Suite                │  │
│  └──────────┘  └────────────┘  └──────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## Core Components

### Capture Engine

- **CapSource:** Live capture via libpcap/Npcap — **runs on main thread** (not worker) for Npcap/Windows native thread safety
- **PcapFileSource:** Streaming PCAP file reader (worker thread)
- **SimulatedReplaySource:** Replay with speed control (0.5×-5×) (worker thread)
- **CaptureController:** State machine (idle → live/file/simulated → idle) (worker thread)
- **WorkerSupervisor:** 500ms restart on unexpected exit
- **IpcBatcher:** 50ms / 100-packet flush policy
- **Link-type normalization:** `cap.open()` returns a string (e.g. `'ETHERNET'`); `CapSource` maps it to numeric libpcap constants via `LINK_TYPE_MAP`; unknown types logged once and mapped to `-1`

### Parser

Decodes raw Ethernet frames into structured protocol layers:

- Ethernet → IPv4/IPv6 → TCP/UDP/ICMP/DNS/ARP
- Unknown protocols → `protocol: 'OTHER'`
- Malformed packets → partial decode with error annotation
- Round-trip property: parse → print → parse preserves fields
- `rawByteLength` on transport layers (TCP/UDP/ICMP) is header length only; anonymizer uses `rawByteOffset + rawByteLength` as `payloadStart`
- Called on main thread for live capture; called in worker thread for file/simulated

### Anonymizer

HMAC-SHA256-based pseudonymization:

```
SESSION_KEY = randomBytes(32)  // generated once at startup
pseudonym(data) = HMAC-SHA256(SESSION_KEY, namespace || data).slice(0, 8)
```

- Session key never exported, logged, or written to disk
- Transport payload -> pseudonym
- Renderer-visible IP/MAC addresses -> deterministic session pseudonyms
- Exported PCAP bytes replace IP/MAC fields and payload bytes with same-length HMAC-derived bytes
- DNS: query name/type preserved in the renderer; answer address fields are anonymized
- Non-address protocol headers preserved unchanged

### Packet Buffer

Ring buffer for captured packets:

- Fixed-size circular array (1K-100K capacity, default 10K)
- Stores `ParsedPacket` (privileged domain canonical form)
- O(1) push and getAll operations
- Events: `'change'`, `'overflow'`
- Methods: `push()`, `getAll()`, `getRange()`, `clear()`, `setCapacity()`

### Logger

Structured JSON logging:

- Pino-based with rotation (10MB, retain 2 files)
- Log file: `userData/netvis.log`
- Levels: DEBUG, INFO, WARN, ERROR, FATAL
- Production builds suppress DEBUG
- **LOG-SEC-01:** No payload content in logs

### Settings Store

Persistent user settings:

- Storage: `userData/settings.json`
- Settings: `bufferCapacity`, `theme` (`light` / `dark` / `warm-dark` / `system`), `welcomeSeen`, `completedChallenges`, `reducedMotion`
- Handles missing/corrupt files gracefully (resets to defaults)
- Emits `'change'` event for IPC synchronization

### Filter Engine

Parses and evaluates filter expressions against the packet buffer:

- **lexer.ts:** Single-pass tokenizer
- **parser.ts:** Recursive-descent parser → `FilterAST`
- **evaluator.ts:** Read-only evaluation against `AnonPacket[]`
- Supported fields: `proto`, `src`, `dst`, `port`, `len`, `ts`
- Comparators: `==`, `!=`, `>`, `<`, `>=`, `<=`; operators: `AND`, `OR`, `NOT`
- Renderer debounces filter input 300ms before sending `filter:apply` IPC call

### BufferStatsThrottler

Throttles `buffer:stats` push-channel emissions to ≤500ms intervals. Cleaned up on `before-quit`.
- Emits `'change'` event for IPC synchronization

---

## Data Flow

### Packet Capture Flow

```
User clicks "Start Capture"
  ↓
Renderer → IPC → Main: capture:start { iface }
  ↓
CaptureController.startLive(iface)
  ↓
CapSource.start() → libpcap/Npcap
  ↓
Packet arrives → Parser.parse()
  ↓
ParsedPacket → Packet_Buffer.push()
  ↓
On send: Anonymizer.anonymize(ParsedPacket) → AnonPacket
  ↓
IpcBatcher accumulates (50ms or 100 packets)
  ↓
Main → IPC → Renderer: packet:batch [AnonPacket[]]
  ↓
Zustand store.addPackets()
  ↓
React re-renders UI
```

---

## Security Model

### Threat Mitigations

**Remote Code Execution:**

- `nodeIntegration: false`, `contextIsolation: true`
- No remote URLs loaded
- Parser never executes packet content
- All byte reads bounds-checked

**Information Disclosure:**

- Anonymizer runs in main process
- Session key never exported
- No payload content in logs
- Only anonymized data crosses IPC

**Path Traversal:**

- All file paths validated with `path.resolve()`
- Home directory check before file operations
- `fs.access()` check before reading

**Injection Attacks:**

- All IPC payloads validated with zod
- Invalid payloads rejected with structured error
- Never passed to native APIs without validation

---

## Threading Model

### Main Thread

- Electron main process event loop
- IPC handlers
- Settings_Store, Logger, Packet_Buffer, Anonymizer, IpcBatcher, BufferStatsThrottler
- **CapSource (live capture)** — runs on main thread for Npcap/Windows native thread safety
- **Parser (live capture path)** — called on main thread when CapSource delivers a RawPacket

### Worker Thread

- PcapFileSource (file import)
- SimulatedReplaySource (simulated replay)
- CaptureController (file/simulated state machine)
- Parser (file/simulated path)

**Rationale:** `CapSource` was moved from the worker thread to the main thread to resolve a native crash on Windows. The `cap` library's `pcap_dispatch` runs a background OS thread whose callbacks fire into the Node.js environment. In a `worker_threads` Worker, that environment pointer becomes invalid under Electron 40.x on Windows, causing an `(env) != nullptr` assertion crash. Running `CapSource` on the stable, long-lived main-process environment eliminates this crash. File and simulated replay sources remain in the worker thread since they use Node.js streams which are safe in workers.

### Renderer Thread

- React rendering
- Zustand state management
- User interaction handling

---

## IPC Contract

### Invoke Channels (Renderer → Main)

| Channel                  | Payload                                    | Returns              |
| ------------------------ | ------------------------------------------ | -------------------- |
| `capture:getInterfaces`  | —                                          | `InterfaceResult`    |
| `capture:start`          | `{ iface: string }`                        | `void`               |
| `capture:stop`           | —                                          | `void`               |
| `capture:startSimulated` | `{ path: string, speed: SpeedMultiplier }` | `void`                                  |
| `pcap:import`            | —                                          | `ImportResult`                          |
| `pcap:selectFile`        | —                                          | `{ ok: true; path: string } | { ok: false }` |
| `pcap:startFile`         | `{ path: string }`                         | `void`                                  |
| `pcap:export`            | —                                          | `ExportResult`                          |
| `buffer:clear`           | —                                          | `void`                                  |
| `buffer:setCapacity`     | `{ capacity: number }`                     | `void`                                  |
| `buffer:getAll`          | —                                          | `AnonPacket[]`                          |
| `filter:apply`           | `{ expression: string }`                   | `{ packets, error }`                    |
| `settings:get`           | —                                          | `Settings`                              |
| `settings:set`           | `Partial<Settings>`                        | `Settings`                              |

### Push Channels (Main → Renderer)

| Channel           | Payload               | Description                                |
| ----------------- | --------------------- | ------------------------------------------ |
| `packet:batch`    | `AnonPacket[]`        | Batch of new packets (50ms or 100 packets) |
| `capture:status`  | `CaptureStatus`       | Capture state change                       |
| `buffer:overflow` | `{ dropped: number }` | Buffer overflow notification               |
| `buffer:stats`    | `BufferStats`         | Buffer occupancy update (≤500ms interval)  |

All invoke payloads validated with zod schemas.

---

## Error Handling

All errors normalized to `CaptureError`:

```typescript
interface CaptureError {
  code: CaptureErrorCode
  message: string // plain-English, shown in UI
  platformHint?: string // OS-specific fix instructions
  cause?: Error // original error (logged, not shown)
}
```

**Error Codes:** `PERMISSION_DENIED`, `INTERFACE_NOT_FOUND`, `INTERFACE_LOST`, `FILE_NOT_FOUND`, `FILE_INVALID_FORMAT`, `LIBRARY_UNAVAILABLE`, `DRAIN_TIMEOUT`, `UNKNOWN`

---

## Performance Targets

- **PERF-01:** 1,000 pps sustained without UI degradation
- **PERF-02:** Packet visible in UI within 200ms of capture
- **PERF-03:** 30 fps renderer frame rate at 1,000 pps
- **PERF-04:** ≤500 MB memory at 100,000 packet buffer

### Optimizations

- **IPC Batching:** Reduces IPC overhead from 1,000 calls/sec to ≤20 calls/sec
- **Worker Thread:** Offloads capture and parsing while the main thread owns Packet_Buffer, anonymization, and IPC delivery
- **Ring Buffer:** O(1) operations, predictable memory
- **Virtualized List:** Only render visible rows + overscan

---

## Technology Stack

**Core:** Electron 40.x, React 19.x, TypeScript 5.x, Vite 7.x  
**Main Process:** cap, pcap-parser, pino, pino-roll, zod  
**Testing:** Vitest, fast-check, jsdom, @testing-library/react  
**Code Quality:** ESLint, Prettier

→ **Full tech stack:** See `.kiro/steering/tech.md`

---

## Questions?

- **Detailed architecture?** → `ARCHITECTURE.md`
- **Current status?** → `PROJECT_STATUS.md`
- **Requirements?** → `.kiro/specs/netvis-core/requirements.md`
- **Full design?** → `.kiro/specs/netvis-core/design.md`
