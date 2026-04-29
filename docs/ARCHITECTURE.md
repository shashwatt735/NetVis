# NetVis Architecture Documentation

**Version:** 1.5  
**Last Modified:** 2026-04-27

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Principles](#architecture-principles)
3. [Process Architecture](#process-architecture)
4. [Component Details](#component-details)
5. [Data Flow](#data-flow)
6. [Security Model](#security-model)
7. [Threading Model](#threading-model)
8. [IPC Contract](#ipc-contract)
9. [Error Handling](#error-handling)
10. [Performance Considerations](#performance-considerations)

---

## Overview

NetVis is a cross-platform Electron application that provides educational network packet visualization. The architecture is designed around strict security boundaries, unidirectional data flow, and educational clarity.

### Key Design Goals

1. **Security by Default:** No remote code execution, strict process isolation
2. **Educational Clarity:** Every protocol field has plain-English explanations
3. **Performance:** Handle 1,000 pps without UI degradation
4. **Reliability:** Graceful error handling, no crashes on malformed packets
5. **Testability:** Property-based tests validate correctness properties

---

## Architecture Principles

### ARCH-01: Explicit IPC Contract

The IPC Bridge exposes only explicitly declared functions to the renderer via Electron's `contextBridge` API. No direct Node.js access from renderer code.

### ARCH-02: Process Isolation

All BrowserWindows have `nodeIntegration: false` and `contextIsolation: true`. The renderer process cannot access Node.js APIs directly.

### ARCH-03: No Remote Content

The application never loads remote URLs in any BrowserWindow. All content is local.

### ARCH-04: Main-Process Anonymization

The Anonymizer executes entirely within the main process. Only anonymized data crosses the IPC Bridge to the renderer.

### ARCH-05: Unidirectional Data Flow

Data flows in one direction only:

```
Capture_Engine → Parser → Packet_Buffer → [IPC boundary: Anonymizer] → IPC_Bridge → Renderer
```

### ARCH-06: TypeScript Strict Mode

All source files use TypeScript strict mode for maximum type safety.

### ARCH-07: One Owner Per Request Lifecycle

The application enforces one owner per request lifecycle: timeout registration, listener registration, cleanup, and completion belong to the same subsystem. No shared ownership. No silent handoffs.

**Example:** When `CaptureController.startLive()` initiates a capture request, it owns:
- The timeout for startup completion
- The listener for worker ack messages
- Cleanup on error or completion
- Success/failure notification to callers

**Rationale:** Prevents resource leaks, double-cleanup bugs, and ambiguous responsibility for error handling.

### ARCH-08: One Owner Per Push Channel

Each renderer-visible push channel has exactly one authoritative emitter in the privileged domain. Push channels such as `packet:batch`, `capture:status`, `buffer:overflow`, and `buffer:stats` must not be emitted from multiple subsystems or duplicated in handler-level optimistic flows.

**Example:** Only `IpcBatcher` emits `packet:batch`. IPC handlers may return invoke results, but they do not own renderer-visible push-channel truth.

**Rationale:** Prevents duplicate events, race conditions, and inconsistent state in the renderer.

### ARCH-09: PacketBuffer Storage Invariant

The Packet_Buffer stores `ParsedPacket` structures in the privileged domain; only `AnonPacket` crosses the IPC_Bridge to the renderer.

**Data Flow:**
```
Worker: RawPacket → Parser → ParsedPacket
Main: Packet_Buffer.push(ParsedPacket)
IPC Boundary: Anonymizer.anonymize(ParsedPacket) → AnonPacket
Renderer: receives AnonPacket only
```

**Rationale:** Maintains the security boundary. The privileged domain retains the canonical packet form (`ParsedPacket`). Anonymization happens at the IPC send boundary, not at storage time.

### ARCH-10: Authoritative Packet Push Channel

Renderer-visible packet delivery uses `packet:batch` as the sole authoritative push channel. No other subsystem emits packets to the renderer.

### ARCH-11: Separate Capture Modes

Live capture, file import, and simulated replay are separate user-initiated modes with no silent fallback between them.

### ARCH-12: File Path Validation

All file paths and targets are validated before any PCAP operation (FILE-SEC-01).

### ARCH-13: Platform-Specific Privilege Minimization

- **Linux:** `setcap cap_net_raw,cap_net_admin=eip` on the binary
- **Windows:** Npcap Users group membership (or run as Administrator)
- **macOS:** `sudo` or Full Disk Access via System Preferences

### ARCH-14: Thread Ownership

Worker thread owns file/simulated replay acquisition and parsing. Main thread owns live capture (`CapSource`), privileged operations, and IPC delivery. Renderer owns UI only.

---

## Process Architecture

### Main Process

The main process owns all privileged operations, including live packet capture:

```
┌───────────────────────────────────────────────────────────┐
│                      Main Process                         │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Capture Engine                         │  │
│  │  ┌────────────┐                                     │  │
│  │  │ CapSource  │  ← Live capture runs HERE (main     │  │
│  │  │ (live)     │    thread) — not in worker thread   │  │
│  │  └────────────┘                                     │  │
│  └─────────────────────────────────────────────────────┘  │
│                          ↓                                │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                    Parser                           │  │
│  │  Ethernet → IPv4/IPv6 → TCP/UDP/ICMP/DNS/ARP        │  │
│  └─────────────────────────────────────────────────────┘  │
│                          ↓                                │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                Packet_Buffer                        │  │
│  │  Stores ParsedPacket (1K-100K packets, default 10K) │  │
│  └─────────────────────────────────────────────────────┘  │
│                          ↓                                │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                  Anonymizer                         │  │
│  │  IPC-boundary transformation: ParsedPacket →        │  │
│  │  AnonPacket for renderer delivery                   │  │
│  └─────────────────────────────────────────────────────┘  │
│                          ↓                                │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                 IPC Handlers / IpcBatcher           │  │
│  │  Zod validation, batching, renderer delivery        │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐                       │
│  │   Logger     │  │  Settings    │                       │
│  │   (pino)     │  │  Store       │                       │
│  └──────────────┘  └──────────────┘                       │
└───────────────────────────────────────────────────────────┘
                            ↓
                    ┌───────────────┐
                    │   Preload     │
                    │ contextBridge │
                    └───────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│                    Renderer Process                      │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Zustand Store                         │  │
│  │  packets, selectedPacket, filterExpression, etc.   │  │
│  └────────────────────────────────────────────────────┘  │
│                          ↓                               │
│  ┌────────────────────────────────────────────────────┐  │
│  │                React Components                    │  │
│  │  ┌────────────┐  ┌──────────────┐  ┌────────────┐  │  │
│  │  │ Packet     │  │ Protocol     │  │ Packet     │  │  │
│  │  │ List       │  │ Chart        │  │ Detail     │  │  │
│  │  └────────────┘  └──────────────┘  └────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Preload Script

The preload script is the security boundary. It:

- Runs in an isolated context with access to both Node.js and renderer globals
- Exposes a single `window.electronAPI` object via `contextBridge`
- Validates all IPC messages before forwarding

### Renderer Process

The renderer process is a standard React application with:

- No Node.js access (enforced by `nodeIntegration: false`)
- Access only to explicitly exposed IPC functions
- Zustand for state management
- Radix UI for components

---

## Component Details

### Capture Engine

**Purpose:** Interface with libpcap/Npcap to capture live packets or stream PCAP files.

**Components:**

- **CapSource:** Live capture via `cap` library — **runs on the main thread** (not the worker). The `cap` library's `pcap_dispatch` spawns a native OS background thread whose callbacks fire into the Node.js environment. In a `worker_threads` Worker on Windows with Npcap + Electron 40.x, that environment pointer becomes invalid, causing an `(env) != nullptr` assertion crash. Running `CapSource` on the stable, long-lived main-process environment eliminates this crash entirely.
- **PcapFileSource:** Streaming PCAP file reader via `pcap-parser` — runs in worker thread
- **SimulatedReplaySource:** Replay with configurable speed (0.5×, 1×, 2×, 5×) — runs in worker thread
- **CaptureController:** State machine managing file/simulated capture lifecycle — runs in worker thread
- **WorkerSupervisor:** Restarts worker on unexpected exit (500ms delay)
- **IpcBatcher:** Batches packets for efficient IPC (50ms or 100 packets)

**Link-type normalization:** `cap.open()` returns a string (e.g. `'ETHERNET'`), not a number. `CapSource` normalizes this via an explicit `LINK_TYPE_MAP` to the numeric libpcap constants the parser expects. Unknown link types are logged once and mapped to `-1`, causing the parser to produce a single `OTHER` layer.

**State Machine:**

```
idle → live → idle
idle → file → idle
idle → simulated → idle
```

**Error Handling:**

- Platform-specific error messages (Windows/Linux/macOS)
- Graceful degradation (file import works even if live capture unavailable)
- All errors logged and surfaced to UI

### Parser

**Purpose:** Decode raw Ethernet frames into structured protocol layers.

**Supported Protocols:**

- Ethernet (destination MAC, source MAC, EtherType)
- IPv4 (version, IHL, DSCP, TTL, protocol, src/dst IP)
- IPv6 (version, traffic class, flow label, hop limit, src/dst IP)
- TCP (src/dst port, seq/ack numbers, flags, window size)
- UDP (src/dst port, length, checksum)
- ICMP (type, code, checksum)
- DNS (transaction ID, flags, question/answer counts, query name/type)
- ARP (hardware/protocol type, operation, sender/target MAC/IP)

**Design Rules:**

- No external parsing libraries (only Node.js built-ins)
- All byte reads are bounds-checked
- Malformed layers are annotated, never thrown
- Unknown protocols → `protocol: 'OTHER'`, preserve byte length
- `rawByteLength` on transport layers (TCP/UDP/ICMP) is **header length only** — the anonymizer uses `rawByteOffset + rawByteLength` as `payloadStart`, so this invariant must be maintained

**Round-Trip Property:**

```
parse(bytes) → packet
print(packet) → bytes'
parse(bytes') → packet'
packet === packet' (field values identical)
```

### Anonymizer

**Purpose:** Replace sensitive payload data with deterministic pseudonyms.

**Algorithm:**

```
SESSION_KEY = randomBytes(32)  // generated once at startup
pseudonym(data) = HMAC-SHA256(SESSION_KEY, namespace || data).slice(0, 8)
```

**Rules:**

- Session key never exported, logged, or written to disk
- Transport-layer payload -> pseudonym
- Renderer-visible IP/MAC addresses -> deterministic session pseudonyms
- Exported PCAP bytes replace IP/MAC fields and payload bytes with same-length HMAC-derived bytes
- DNS: query name and type preserved in the renderer; answer address fields are anonymized
- Non-address protocol headers preserved unchanged

**Security:**

- ANON-SEC-01: Key is module-level constant, never serialized
- Only anonymized data crosses IPC to renderer

### Packet_Buffer

**Purpose:** In-memory ring buffer for captured packets.

**Canonical packet rule:** `Packet_Buffer` stores `ParsedPacket`, not `AnonPacket`. Renderer-facing `AnonPacket` objects are created only at the IPC send boundary.

**Implementation:**

- Fixed-size circular array with head/tail pointers
- Capacity: 1,000–100,000 packets (default 10,000)
- Ring buffer semantics: oldest packet dropped on overflow

**Events:**

- `'change'`: Emitted on every push or clear
- `'overflow'`: Emitted when oldest packet is dropped

**Methods:**

- `push(packet)`: Add packet (drops oldest if at capacity)
- `getAll()`: Return all packets in order
- `getRange(start, end)`: Return slice of packets
- `clear()`: Remove all packets

### Logger

**Purpose:** Structured JSON logging for diagnostics and error reporting.

**Implementation:**

- Pino-based structured logging
- Log file: `app.getPath('userData')/netvis.log`
- Rotation: 10MB, retain 2 files
- Levels: DEBUG, INFO, WARN, ERROR, FATAL
- Production builds suppress DEBUG

**Security:**

- LOG-SEC-01: No payload content in any log entry
- Only metadata logged (timestamps, counts, error codes)

**Uncaught Exception Handler:**

```javascript
process.on('uncaughtException', (err) => {
  Logger.fatal('UncaughtException', err.message, {
    errorType: err.name,
    stack: err.stack
  })
  setTimeout(() => process.exit(1), 500)
})
```

### Settings_Store

**Purpose:** Persistent user settings.

**Storage:** `app.getPath('userData')/settings.json`

**Settings:**

```typescript
{
  bufferCapacity: number      // 1000-100000, default 10000
  theme: 'light' | 'dark' | 'warm-dark' | 'system'  // default 'system'
  welcomeSeen: boolean        // default false
  completedChallenges: string[]  // default []
  reducedMotion: boolean      // default false
}
```

**Behavior:**

- Loaded at startup
- Written on every mutation
- Emits `'change'` event for IPC synchronization
- Handles missing/corrupt files gracefully (resets to defaults)

### Filter_Engine

**Purpose:** Parse and evaluate filter expressions against the packet buffer.

**Components:**

- **lexer.ts:** Single-pass tokenizer
- **parser.ts:** Recursive-descent parser producing a `FilterAST`
- **evaluator.ts:** Read-only evaluation of `FilterAST` against `AnonPacket[]`
- **index.ts:** Public `parse()` and `evaluate()` exports

**Supported fields:** `proto`, `src`, `dst`, `port`, `len`, `ts`  
**Comparators:** `==`, `!=`, `>`, `<`, `>=`, `<=`  
**Operators:** `AND`, `OR`, `NOT`

**Evaluation is read-only** — the evaluator never mutates packets or buffer state.

### BufferStatsThrottler

**Purpose:** Throttle `buffer:stats` push-channel emissions to ≤500ms intervals.

- Prevents excessive IPC traffic during high packet rates
- Cleaned up on `before-quit` to avoid dangling timers

---

## Data Flow

### Packet Capture Flow

```
1. User clicks "Start Capture"
   ↓
2. Renderer → IPC → Main: capture:start { iface }
   ↓
3. Main: CaptureEngine.startCapture(iface)
   ↓
4. Main: CapSource.start() → libpcap/Npcap  ← runs on main thread
   ↓
5. Packet arrives → CapSource callback (main thread)
   ↓
6. Main: RawPacket → Parser.parse()  ← parser called on main thread for live capture
   ↓
7. Main: Packet_Buffer.push(ParsedPacket)
   ↓
8. On send: Anonymizer.anonymize(ParsedPacket) → AnonPacket
   ↓
9. IpcBatcher accumulates AnonPacket[] (50ms or 100 packets)
   ↓
10. Main → IPC → Renderer: packet:batch [AnonPacket[]]
   ↓
11. Renderer: Zustand store.addPackets()
   ↓
12. React re-renders Packet_List, Protocol_Chart, etc.
```

### PCAP File Import Flow

```
1. User clicks "Import PCAP"
   ↓
2. Renderer → IPC → Main: pcap:import
   ↓
3. Main: dialog.showOpenDialog()
   ↓
4. User selects file
   ↓
5. Worker: PcapFileSource.start(filePath)
   ↓
6. Worker: stream RawPacket → Parser → ParsedPacket
   ↓
7. Main: Packet_Buffer.push(ParsedPacket)
   ↓
8. On send: Anonymizer → AnonPacket → IpcBatcher
   ↓
9. Renderer updates UI via packet:batch
```

### Settings Update Flow

```
1. User changes setting in UI
   ↓
2. Renderer → IPC → Main: settings:set { patch }
   ↓
3. Main: validateOrThrow(SettingsPatchSchema, patch)
   ↓
4. Main: SettingsStore.set(patch)
   ↓
5. Main: Write to settings.json
   ↓
6. Main: Emit 'change' event
   ↓
7. Main → IPC → Renderer: Updated settings
   ↓
8. Renderer: Zustand store updates
   ↓
9. React re-renders affected components
```

---

## Security Model

### Threat Model

**Assumptions:**

- User runs NetVis on a trusted machine
- User may capture traffic on untrusted networks
- Malicious packets may be present in captures
- User may load PCAP files from untrusted sources

**Threats:**

- Remote code execution via malformed packets
- Information disclosure via payload content
- Path traversal via file operations
- Injection attacks via IPC payloads

### Mitigations

#### Remote Code Execution

- **ARCH-02:** `nodeIntegration: false`, `contextIsolation: true`
- **ARCH-03:** No remote URLs loaded
- Parser never executes packet content
- All byte reads are bounds-checked

#### Information Disclosure

- **ARCH-04:** Anonymizer runs in main process
- **ANON-SEC-01:** Session key never exported
- **LOG-SEC-01:** No payload content in logs
- Only anonymized data crosses IPC

#### Path Traversal

- **FILE-SEC-01:** All file paths validated with `path.resolve()`
- Home directory check before file operations
- `fs.access()` check before reading

#### Injection Attacks

- **IPC-SEC-01:** All IPC payloads validated with zod
- Invalid payloads rejected with structured error
- Never passed to native APIs without validation

#### Capture Privilege Escalation

- **CAP-SEC-01:** Platform-specific privilege instructions
- Linux: `setcap cap_net_raw,cap_net_admin=eip`
- Windows: Npcap Users group membership
- macOS: `sudo` or System Preferences

---

### Threading Model

### Main Thread

- Electron main process event loop
- IPC handlers
- Settings_Store
- Logger
- Packet_Buffer
- Anonymizer
- IpcBatcher
- BufferStatsThrottler
- **CapSource (live capture)** — moved here from worker thread for Npcap/Windows native thread safety
- **Parser (live capture path)** — called on main thread when CapSource delivers a RawPacket

### Worker Thread

- PcapFileSource (file import)
- SimulatedReplaySource (simulated replay)
- CaptureController (file/simulated state machine)
- Parser (file/simulated path — called inside the worker for file and simulated sources)

**Rationale for CapSource on main thread:**

The `cap` library uses `pcap_dispatch` which spawns a native OS background thread. That thread fires callbacks back into Node.js via `node::InternalMakeCallback`. When `cap` runs inside a `worker_threads` Worker, the callback uses the worker's `Environment*` pointer. On Windows with Npcap + Electron 40.x, that pointer becomes invalid after a few seconds, triggering the `(env) != nullptr` assertion crash. The main process has a stable, long-lived Node.js environment that persists for the entire app lifetime, eliminating the crash.

File and simulated replay sources remain in the worker thread since they use Node.js streams (`fs.ReadStream`, `pcap-parser`) which are safe in workers.

**Communication:**

```
Main Thread                Worker Thread
     │                           │
     │  (live capture: CapSource runs directly on main thread)
     │                           │
     ├─ start-file {requestId} ─>│
     │                           ├─ CaptureController.startFile()
     │<── command-ok {requestId}─┤  (startup confirmed)
     │<── packet-batch ──────────┤  (streaming packets)
     │<── command-complete ──────┤  (streaming ended — used by pcap:import)
     │                           │
     ├─ start-simulated ────────>│
     │                           ├─ CaptureController.startSimulated()
     │<── command-ok {requestId}─┤
     │<── packet-batch ──────────┤
     │<── command-complete ──────┤
     │                           │
     ├─ stop {requestId} ───────>│  (file/simulated only)
     │<── command-ok {requestId}─┤
     │<── stopped ───────────────┤
```

**Command/Ack Protocol (BUGFIX-01):**

Every worker command carries a `requestId` (UUID). The worker replies with `command-ok`, `command-error`, or `command-complete`. `CaptureEngine` stores pending promises in a `Map<requestId, {resolve, reject}>` and settles them only on the matching ack — no fire-and-forget.

### Renderer Thread

- React rendering
- Zustand state management
- User interaction handling

---

## IPC Contract

### Invoke Channels (Renderer → Main)

| Channel                  | Payload                                    | Returns                | Description                         |
| ------------------------ | ------------------------------------------ | ---------------------- | ----------------------------------- |
| `capture:getInterfaces`  | —                                          | `InterfaceResult`      | Enumerate interfaces (`{ ok, interfaces }` or `{ ok: false, error }`) |
| `capture:start`          | `{ iface: string }`                        | `void`                 | Start live capture (resolves after worker ack) |
| `capture:stop`           | —                                          | `void`                 | Stop capture (resolves after worker ack) |
| `capture:startSimulated` | `{ path: string, speed: SpeedMultiplier }` | `void`                 | Start simulated replay (FILE-SEC-01 + worker ack) |
| `pcap:import`            | —                                          | `ImportResult`         | Import PCAP file (resolves on `command-complete`) |
| `pcap:selectFile`        | —                                          | `{ ok, path? }`        | Open file dialog to select PCAP file |
| `pcap:startFile`         | `{ path: string }`                         | `void`                 | Stream PCAP file through pipeline   |
| `pcap:export`            | —                                          | `ExportResult`         | Export buffer to PCAP file          |
| `buffer:clear`           | —                                          | `void`                 | Clear packet buffer                 |
| `buffer:setCapacity`     | `{ capacity: number }`                     | `void`                 | Resize buffer (1000–100000)         |
| `buffer:getAll`          | —                                          | `AnonPacket[]`         | Get all packets (initial load)      |
| `filter:apply`           | `{ expression: string }`                   | `{ packets, error }`   | Filter packets by expression        |
| `settings:get`           | —                                          | `Settings`             | Get current settings                |
| `settings:set`           | `Partial<Settings>`                        | `Settings`             | Update settings                     |
| `log:openFolder`         | —                                          | `void`                 | Open log directory in file explorer |

### Push Channels (Main → Renderer)

| Channel           | Payload               | Description                                |
| ----------------- | --------------------- | ------------------------------------------ |
| `packet:batch`    | `AnonPacket[]`        | Batch of new packets (50ms or 100 packets) |
| `capture:status`  | `CaptureStatus`       | Capture state change                       |
| `buffer:overflow` | `{ dropped: number }` | Buffer overflow notification               |
| `buffer:stats`    | `BufferStats`         | Buffer occupancy update (≤500ms interval)  |

### Validation

All invoke payloads are validated with zod schemas:

```typescript
// Example: capture:start
const CaptureStartSchema = z.object({
  iface: z.string().min(1)
})

ipcMain.handle('capture:start', async (_event, iface: string) => {
  validateOrThrow(CaptureStartSchema, { iface })
  // ... implementation
})
```

Invalid payloads throw structured errors:

```typescript
throw new Error(`IPC validation failed: ${result.error.message}`)
```

---

## Error Handling

### Error Normalization

All errors are normalized to `CaptureError`:

```typescript
interface CaptureError {
  code: CaptureErrorCode
  message: string // plain-English, shown in UI
  platformHint?: string // OS-specific fix instructions
  cause?: Error // original error (logged, not shown)
}
```

### Error Codes

| Code                  | Meaning                               | Platform Hints                                                                                         |
| --------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `PERMISSION_DENIED`   | No admin/root privileges              | Windows: Run as Administrator<br>Linux: `setcap cap_net_raw,cap_net_admin=eip`<br>macOS: Run with sudo |
| `INTERFACE_NOT_FOUND` | Named interface does not exist        | Check interface name with `ifconfig` or `ipconfig`                                                     |
| `INTERFACE_LOST`      | Interface disappeared during capture  | Interface may have been disabled or removed                                                            |
| `FILE_NOT_FOUND`      | File path does not exist              | Check file path and permissions                                                                        |
| `FILE_INVALID_FORMAT` | Not a valid PCAP or PCAPNG file       | File may be corrupted or wrong format                                                                  |
| `LIBRARY_UNAVAILABLE` | `cap` or `pcap-parser` failed to load | Windows: Install Npcap<br>Linux/macOS: Install libpcap                                                 |
| `DRAIN_TIMEOUT`       | Stop drain exceeded 500ms             | Capture may be stuck, force quit                                                                       |
| `UNKNOWN`             | Unclassified error                    | Check logs for details                                                                                 |

### Error Flow

```
1. Error occurs in component
   ↓
2. mapError(err, code, context) → CaptureError
   ↓
3. Logger.error(component, message, { code, context })
   ↓
4. Error surfaced to UI via IPC or event
   ↓
5. UI displays message + platformHint
```

---

## Performance Considerations

### Requirements

- **PERF-01:** 1,000 pps sustained without UI degradation
- **PERF-02:** Packet visible in UI within 200ms of capture
- **PERF-03:** 30 fps renderer frame rate at 1,000 pps
- **PERF-04:** ≤500 MB memory at 100,000 packet buffer

### Optimizations

#### IPC Batching

- Batch packets every 50ms or 100 packets (whichever first)
- Reduces IPC overhead from 1,000 calls/sec to ≤20 calls/sec
- Latency: ≤100ms (meets PERF-02)

### Renderer Load Control

NetVis prevents high packet rates from turning into renderer lag by decoupling packet ingestion from packet presentation. Packets are captured and parsed off the UI thread, stored in the main process as `ParsedPacket`, converted to `AnonPacket` only at the IPC boundary, and then delivered to the renderer in batches rather than one-by-one. On the renderer side, packet rows are virtualized and visualization components operate on derived or aggregated data instead of rendering every stored packet directly. This means that a high packet arrival rate does not translate into an equally high React render rate, which is how the application preserves responsiveness while still enforcing the anonymization boundary.

#### Worker Thread

- Offload capture and parsing to worker
- Main thread owns Packet_Buffer, anonymization, and IPC delivery
- Prevents main thread blocking while preserving the privileged anonymization boundary

#### Ring Buffer

- Fixed-size circular array (no dynamic allocation)
- O(1) push and getAll operations
- Predictable memory usage

#### Virtualized List

- Only render visible rows + overscan
- Use `@tanstack/virtual` for efficient scrolling
- Handles 100,000+ packets without performance degradation

#### Debounced Updates

- Buffer stats: ≤500ms interval
- Challenge evaluation: 500ms debounce
- Chart updates: 200-400ms animation duration

---

## Future Considerations

### Phase 2 Components (Implemented)

All Phase 2 visualization components are complete:

- **OSI_Layer_Diagram:** 7-layer OSI stack with active-layer highlighting and keyboard navigation
- **IP_Flow_Map:** D3 force-simulation node-link diagram; node/edge click generates filter expression
- **Bandwidth_Chart:** Recharts stacked area chart, 60-second window, protocol-colored stacks
- **Protocol_Animations:** TCP handshake, DNS query/response, ICMP echo; play/pause/step controls

### Scalability

- Consider streaming to disk for captures >100,000 packets
- Implement packet filtering in worker thread (before IPC)
- Add packet sampling for high-rate captures (>10,000 pps)

### Extensibility

- Plugin system for custom protocol decoders
- Export to other formats (JSON, CSV, Wireshark dissector)
- Integration with external tools (Wireshark, tcpdump)

---

## References

- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [libpcap Documentation](https://www.tcpdump.org/manpages/pcap.3pcap.html)
- [Npcap User's Guide](https://npcap.com/guide/)
- [PCAP File Format](https://wiki.wireshark.org/Development/LibpcapFileFormat)
- [Property-Based Testing with fast-check](https://github.com/dubzzz/fast-check)

---

**Document Version:** 1.5  
**Last Updated:** 2026-04-27  
**Maintained By:** NetVis Development Team
