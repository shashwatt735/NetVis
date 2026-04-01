# NetVis Architecture Documentation

**Version:** 1.0  
**Last Updated:** 2026-04-01

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
Capture_Engine → Parser → Anonymizer → Packet_Buffer → IPC_Bridge → Renderer
```

### ARCH-06: TypeScript Strict Mode

All source files use TypeScript strict mode for maximum type safety.

---

## Process Architecture

### Main Process

The main process owns all privileged operations:

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Process                            │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Capture Engine                          │  │
│  │  ┌────────────┐  ┌──────────────┐  ┌─────────────┐ │  │
│  │  │ CapSource  │  │ PcapFile     │  │ Simulated   │ │  │
│  │  │ (live)     │  │ Source       │  │ Replay      │ │  │
│  │  └────────────┘  └──────────────┘  └─────────────┘ │  │
│  │         ↓                ↓                 ↓         │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │      CaptureController (state machine)       │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    Parser                            │  │
│  │  Ethernet → IPv4/IPv6 → TCP/UDP/ICMP/DNS/ARP        │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  Anonymizer                          │  │
│  │  HMAC session key, payload pseudonymization         │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                Packet_Buffer                         │  │
│  │  Ring buffer (1K-100K packets, default 10K)         │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                 IPC Handlers                         │  │
│  │  Zod validation, error normalization                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Logger     │  │  Settings    │  │  IpcBatcher  │     │
│  │   (pino)     │  │  Store       │  │  (50ms/100p) │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    ┌───────────────┐
                    │   Preload     │
                    │ contextBridge │
                    └───────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Zustand Store                           │  │
│  │  packets, selectedPacket, filterExpression, etc.    │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                React Components                      │  │
│  │  ┌────────────┐  ┌──────────────┐  ┌────────────┐  │  │
│  │  │ Packet     │  │ Protocol     │  │ Packet     │  │  │
│  │  │ List       │  │ Chart        │  │ Detail     │  │  │
│  │  └────────────┘  └──────────────┘  └────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
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
- MUI for UI components

---

## Component Details

### Capture Engine

**Purpose:** Interface with libpcap/Npcap to capture live packets or stream PCAP files.

**Components:**

- **CapSource:** Live capture via `cap` library
- **PcapFileSource:** Streaming PCAP file reader via `pcap-parser`
- **SimulatedReplaySource:** Replay with configurable speed (0.5×, 1×, 2×, 5×)
- **CaptureController:** State machine managing capture lifecycle
- **WorkerSupervisor:** Restarts worker on unexpected exit (500ms delay)
- **IpcBatcher:** Batches packets for efficient IPC (50ms or 100 packets)

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
pseudonym(data) = sha256(SESSION_KEY || data).slice(0, 8)
```

**Rules:**

- Session key never exported, logged, or written to disk
- Transport-layer payload → pseudonym
- DNS answer IPs → pseudonym (query name and type preserved)
- All protocol headers preserved unchanged (metadata, not payload)

**Security:**

- ANON-SEC-01: Key is module-level constant, never serialized
- Only anonymized data crosses IPC to renderer

### Packet_Buffer

**Purpose:** In-memory ring buffer for captured packets.

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
  theme: 'light' | 'dark' | 'system'  // default 'system'
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

---

## Data Flow

### Packet Capture Flow

```
1. User clicks "Start Capture"
   ↓
2. Renderer → IPC → Main: capture:start { iface }
   ↓
3. Main: CaptureController.startLive(iface)
   ↓
4. Main: CapSource.start() → libpcap/Npcap
   ↓
5. Packet arrives → CapSource callback
   ↓
6. RawPacket → Parser.parse()
   ↓
7. ParsedPacket → Anonymizer.anonymize()
   ↓
8. AnonPacket → Packet_Buffer.push()
   ↓
9. Packet_Buffer emits 'change'
   ↓
10. IpcBatcher accumulates packets (50ms or 100 packets)
   ↓
11. Main → IPC → Renderer: packet:batch [AnonPacket[]]
   ↓
12. Renderer: Zustand store.addPackets()
   ↓
13. React re-renders Packet_List, Protocol_Chart, etc.
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
5. Main: PcapFileSource.start(filePath)
   ↓
6. Stream packets through Parser → Anonymizer → Buffer
   ↓
7. Batch send to renderer via packet:batch
   ↓
8. Renderer updates UI
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

## Threading Model

### Main Thread

- Electron main process event loop
- IPC handlers
- Settings_Store
- Logger
- Packet_Buffer

### Worker Thread

- Capture_Engine (CapSource, PcapFileSource, SimulatedReplaySource)
- Parser
- Anonymizer
- WorkerSupervisor manages lifecycle

**Rationale:**

- Capture callbacks can fire at 1,000+ Hz
- Parsing and anonymization are CPU-intensive
- Offloading to worker prevents main thread blocking

**Communication:**

```
Main Thread                Worker Thread
     │                          │
     ├─ start-live ────────────>│
     │                          ├─ CapSource.start()
     │<──── packet-batch ───────┤
     │<──── stopped ────────────┤
     │<──── error ──────────────┤
     ├─ stop ──────────────────>│
     │                          ├─ CapSource.stop()
     │<──── stopped ────────────┤
```

### Renderer Thread

- React rendering
- Zustand state management
- User interaction handling

---

## IPC Contract

### Invoke Channels (Renderer → Main)

| Channel                  | Payload                                    | Returns              | Description                         |
| ------------------------ | ------------------------------------------ | -------------------- | ----------------------------------- |
| `capture:getInterfaces`  | —                                          | `NetworkInterface[]` | Enumerate network interfaces        |
| `capture:start`          | `{ iface: string }`                        | `void`               | Start live capture                  |
| `capture:stop`           | —                                          | `void`               | Stop capture                        |
| `capture:startSimulated` | `{ path: string, speed: SpeedMultiplier }` | `void`               | Start simulated replay              |
| `pcap:import`            | —                                          | `ImportResult`       | Import PCAP file (instant load)     |
| `pcap:startFile`         | `{ path: string }`                         | `void`               | Stream PCAP file through pipeline   |
| `pcap:export`            | —                                          | `ExportResult`       | Export buffer to PCAP file          |
| `buffer:clear`           | —                                          | `void`               | Clear packet buffer                 |
| `buffer:setCapacity`     | `{ capacity: number }`                     | `void`               | Resize buffer (1000-100000)         |
| `buffer:getAll`          | —                                          | `AnonPacket[]`       | Get all packets (initial load)      |
| `settings:get`           | —                                          | `Settings`           | Get current settings                |
| `settings:set`           | `Partial<Settings>`                        | `Settings`           | Update settings                     |
| `log:openFolder`         | —                                          | `void`               | Open log directory in file explorer |

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

#### Worker Thread

- Offload capture, parsing, anonymization to worker
- Main thread only handles IPC and buffer management
- Prevents main thread blocking

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

### Phase 2 Components

- **OSI_Layer_Diagram:** Maps packet layers to OSI model
- **IP_Flow_Map:** D3-based node-link diagram of IP communication
- **Bandwidth_Chart:** Stacked area chart of traffic volume over time
- **Protocol_Animations:** Step-by-step animated protocol exchanges

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

**Document Version:** 1.0  
**Last Updated:** 2026-04-01  
**Maintained By:** NetVis Development Team
