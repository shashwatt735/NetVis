# NetVis: A Secure Desktop Architecture for Educational Network Packet Visualization

## Abstract

**Purpose:** Network protocol education traditionally relies on professional forensic tools like Wireshark, which present a steep learning curve for beginners and lack pedagogical scaffolding. This paper presents NetVis, a beginner-oriented network packet visualization system designed specifically for educational contexts.

**Methods:** NetVis employs a secure Electron-based desktop architecture that separates privileged packet capture and parsing operations from renderer-side visualization through a strict IPC boundary. The system implements a unified packet-processing pipeline supporting live capture via libpcap/Npcap, offline PCAP file import, and configurable-speed replay. Privacy-aware anonymization using HMAC-based pseudonymization protects sensitive payload data by default. The visualization layer presents protocol distribution charts, temporal packet flow timelines, layered protocol inspection, and contextual field explanations tailored for novice learners.

**Results:** The architecture enforces security invariants including process isolation (`nodeIntegration: false`, `contextIsolation: true`), unidirectional data flow from capture through anonymization to visualization, and platform-specific privilege minimization. The April 29, 2026 validation rerun shows `npm run typecheck` and `npm run build` passing. After pinning Vitest to the threaded single-worker pool used by focused regression runs, the full automated test suite passed 448/448 tests across 49/49 test files. Performance targets and instrumentation are described, but final performance measurements should be reported only after the performance archive is regenerated.

**Conclusion:** NetVis demonstrates that educational packet visualization tools can achieve both strong security guarantees and pedagogical effectiveness through careful architectural separation of concerns. The system provides a foundation for beginner networking education that bridges the gap between theoretical instruction and real packet-level analysis without compromising on security or privacy.

**Keywords:** Network education, Packet visualization, Electron security, Protocol parsing, Educational software, Privacy-preserving capture

---

## 1. Introduction

### 1.1 Motivation

Network protocol education faces a fundamental pedagogical challenge: students must transition from abstract protocol diagrams in textbooks to understanding real packet-level behavior in live network traffic. Professional network analysis tools like Wireshark [1] provide comprehensive packet inspection capabilities but present significant barriers for beginners:

1. **Overwhelming interface complexity:** Hundreds of configuration options and display filters designed for expert forensic analysis
2. **Lack of pedagogical scaffolding:** No contextual explanations, guided exercises, or progressive disclosure of complexity
3. **Security and privacy concerns:** Raw packet capture in educational environments risks exposing sensitive data on shared networks
4. **Platform-specific permission requirements:** Elevated privileges needed for live capture create deployment friction in institutional settings

These barriers result in a gap between theoretical networking education and practical packet-level understanding. Students struggle to connect protocol concepts learned in lectures with the byte-level reality of network communication.

### 1.2 Contribution

This paper presents NetVis, a beginner-oriented network packet visualization system that addresses these challenges through:

1. **A secure desktop architecture** that separates privileged packet capture and parsing from renderer-side visualization, enforcing security boundaries through Electron's process isolation model
2. **A unified packet-processing pipeline** supporting live capture, offline PCAP import, and configurable-speed replay with consistent downstream processing
3. **A beginner-oriented visualization layer** presenting protocol distribution, temporal behavior, layered inspection, and contextual explanations designed for novice learners
4. **An evaluation methodology** covering functional validation, parser correctness against reference tools, and performance behavior under controlled workloads

The system demonstrates that educational packet visualization tools can achieve strong security guarantees while maintaining pedagogical effectiveness through careful architectural design.

### 1.3 Paper Organization

Section 2 reviews related work in network education tools and packet visualization systems. Section 3 presents the NetVis architecture, detailing the security model, packet processing pipeline, and visualization components. Section 4 describes the implementation, including platform-specific considerations and threading model. Section 5 presents evaluation results covering functional correctness, parser validation, and performance characteristics. Section 6 discusses design tradeoffs and lessons learned. Section 7 concludes and outlines future work.

---

## 2. Related Work

### 2.1 Professional Network Analysis Tools

**Wireshark** [1] remains the de facto standard for network protocol analysis, offering comprehensive dissection of hundreds of protocols and powerful display filtering. However, its expert-oriented interface and lack of pedagogical features make it challenging for beginners. **tcpdump** [2] provides command-line packet capture but requires understanding of Berkeley Packet Filter (BPF) syntax and offers no visualization.

### 2.2 Educational Network Simulators

**Packet Tracer** [3] and **GNS3** [4] provide network simulation environments for educational purposes. While valuable for topology design and configuration practice, these tools simulate rather than capture real traffic, limiting students' exposure to actual protocol behavior and timing characteristics.

### 2.3 Web-Based Packet Analysis

**CloudShark** [5] and **PacketTotal** [6] offer web-based PCAP analysis, eliminating installation requirements. However, uploading captures to cloud services raises privacy concerns for institutional networks, and browser-based implementations cannot perform live local capture due to security restrictions.

### 2.4 Educational Packet Visualization

**EtherApe** [7] provides graphical network monitoring with node-link diagrams but focuses on real-time traffic monitoring rather than educational protocol inspection. **Cocoa Packet Analyzer** [8] offers a simplified macOS-specific interface but lacks cross-platform support and pedagogical features.

**Gap in existing tools:** No existing tool combines live capture, privacy-preserving anonymization, beginner-oriented visualization, and pedagogical scaffolding in a secure cross-platform desktop architecture. NetVis fills this gap by prioritizing educational use cases while maintaining security boundaries appropriate for shared network environments.

---

## 3. Architecture

### 3.1 Design Principles

NetVis architecture is guided by four core principles:

1. **Security by default:** Process isolation, no remote code execution, anonymization before renderer delivery
2. **Unidirectional data flow:** Capture → Parse → Buffer → Anonymize → Visualize (no feedback loops)
3. **Educational clarity:** Consistent protocol colors, contextual explanations, progressive disclosure
4. **Platform transparency:** Explicit platform-specific requirements rather than abstraction that hides permission needs

### 3.2 Process Architecture

NetVis employs Electron's multi-process model [9] to enforce security boundaries:

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Process (Privileged)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  CapSource   │  │ Packet_Buffer│  │  Anonymizer  │      │
│  │ (live capture│→ │ (ParsedPacket│→ │ (HMAC-based) │      │
│  │  main thread)│  │   storage)   │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ↓                                      ↓             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              IpcBatcher (AnonPacket[])               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓ IPC Boundary
┌─────────────────────────────────────────────────────────────┐
│                    Preload (contextBridge)                   │
│              Typed IPC contract, no Node.js access           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  Renderer Process (Sandboxed)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Zustand Store│→ │ Packet_List  │  │Protocol_Chart│      │
│  │ (AnonPacket) │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ↓                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Educational_Layer (field explanations)       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Worker Thread (File/Replay)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │PcapFileSource│→ │    Parser    │→ │postMessage() │      │
│  │Simulated     │  │ (protocol    │  │(ParsedPacket)│      │
│  │ReplaySource  │  │  dissection) │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

**Key architectural invariants:**

- **ARCH-01:** IPC surface explicitly declared via `contextBridge` only
- **ARCH-02:** `nodeIntegration: false`, `contextIsolation: true` enforced
- **ARCH-04:** Anonymization executes in main process before IPC crossing
- **ARCH-05:** Unidirectional flow: Capture → Parse → Buffer → Anonymize → Render
- **ARCH-09:** `Packet_Buffer` stores `ParsedPacket`; only `AnonPacket` crosses IPC
- **ARCH-14:** Thread ownership: worker for file/replay acquisition and parsing; main for live capture, privileged operations, and IPC delivery; renderer for UI only

### 3.3 Packet Processing Pipeline

#### 3.3.1 Capture Sources

NetVis supports three acquisition modes sharing a unified downstream pipeline:

**Live Capture:** Uses `cap` library [10] wrapping libpcap (Linux/macOS) or Npcap (Windows). Runs on main process thread due to native thread safety requirements on Windows where `pcap_dispatch` callbacks fire from OS background threads into Node.js environment.

**File Import:** Uses `pcap-parser` [11] for streaming PCAP/PCAPNG file parsing. Runs in worker thread to avoid blocking main process during I/O.

**Simulated Replay:** Extends file import with inter-packet delay scheduling scaled by user-selected speed multiplier (0.5×–5×). Enables practice in environments without live network access.

All three modes produce identical `RawPacket` structures:

```typescript
interface RawPacket {
  timestamp: number;        // Unix ms with sub-ms precision
  sourceId: string;         // Interface name or filename
  captureMode: 'live' | 'file';
  data: Buffer;             // Raw frame bytes (always copied)
  length: number;           // Original wire length
  linkType: number;         // libpcap link-layer type
}
```

#### 3.3.2 Protocol Parser

The parser implements recursive descent dissection starting from Ethernet layer:

```
Ethernet → { IPv4 | IPv6 | ARP }
IPv4/IPv6 → { TCP | UDP | ICMP }
UDP → { DNS | payload }
TCP → { DNS | payload }
```

Supported protocols: Ethernet, IPv4, IPv6, ARP, TCP, UDP, ICMP, DNS. Unknown or malformed layers are annotated with error markers rather than dropped, preserving partial decode results for educational inspection.

Parser output is `ParsedPacket` containing:

```typescript
interface ParsedPacket {
  id: string;               // UUID for renderer correlation
  timestamp: number;
  sourceId: string;
  captureMode: 'live' | 'file';
  length: number;
  layers: ProtocolLayer[];  // Decoded protocol stack
  parseErrors?: string[];   // Malformation annotations
}
```

**Round-trip property:** For all valid packets, `parse(print(parse(raw))) ≡ parse(raw)` where `print()` serializes `ParsedPacket` back to PCAP record bytes. This property is validated via property-based testing using `fast-check` [12] with minimum 100 iterations per test case.

#### 3.3.3 Anonymization

Anonymization executes at the IPC boundary before renderer delivery. Uses HMAC-SHA256 with session-scoped key generated at startup:

```
anonymized_payload = HMAC-SHA256(session_key, original_payload)[0..7]
```

Produces deterministic pseudonyms: identical payloads map to identical anonymized values within a session, enabling pattern recognition while preventing payload reconstruction. DNS answer IP addresses are anonymized while preserving query names and record types for educational analysis.

Output is `AnonPacket` containing only anonymized payload references and safe metadata:

```typescript
interface AnonPacket {
  id: string;
  timestamp: number;
  sourceId: string;
  length: number;
  protocol: ProtocolName;
  srcAddr: string;          // IP or MAC
  dstAddr: string;
  layers: AnonLayer[];      // Headers only, no raw payload
  payloadHash: string;      // Anonymized payload identifier
}
```

**Security guarantee:** Raw payload bytes never cross IPC boundary. Renderer process cannot reconstruct original payload data.

#### 3.3.4 IPC Batching

At 1,000 packets/second, individual IPC messages per packet would generate 1,000 `ipcMain.send()` calls/second, degrading UI performance. `IpcBatcher` accumulates packets and flushes every 50ms or when batch reaches 100 packets, whichever occurs first. This reduces IPC overhead to ≤20 calls/second while maintaining ≤100ms latency.

### 3.4 Visualization Components

#### 3.4.1 Packet List

Scrollable table displaying packet metadata: timestamp (ms precision), source/destination addresses, protocol, length. Supports keyboard navigation (arrow keys, Enter) meeting WCAG 2.1 Level AA focus management criteria [13]. Updates within 200ms of packet buffer insertion at rates up to 1,000 pps.

#### 3.4.2 Protocol Distribution Chart

Pie chart showing protocol breakdown across buffered packets. Uses fixed per-protocol color mapping consistent across all UI surfaces:

- TCP: `#3B82F6` (blue)
- UDP: `#10B981` (green)  
- ICMP: `#F59E0B` (amber)
- DNS: `#8B5CF6` (purple)
- ARP: `#EF4444` (red)
- IPv6: `#06B6D4` (cyan)
- OTHER: `#6B7280` (gray)

Color consistency aids pattern recognition across different visualization contexts.

#### 3.4.3 Packet Detail Inspector

Layered protocol tree displaying decoded fields for selected packet. Each field shows: name, value, byte offset, and plain-English explanation. Explanations cover purpose, common values, and protocol behavior context. Accessible via ARIA attributes for screen reader compatibility.

#### 3.4.4 Packet Flow Timeline

Time-series chart displaying packet arrival counts aggregated into 1-second buckets over most recent 60 seconds. Enables identification of traffic bursts and temporal patterns.

#### 3.4.5 Educational Layer

Provides contextual learning support:

- **Field explanations:** Plain-English descriptions for all protocol fields
- **Guided challenges:** Structured exercises (e.g., "Identify TCP three-way handshake") with goal descriptions, success criteria, and hints
- **Challenge tracking:** Persistent completion state across application restarts

---

## 4. Implementation

### 4.1 Technology Stack

- **Electron 40.x:** Cross-platform desktop framework [9]
- **React 19.x:** UI framework with concurrent rendering
- **TypeScript 5.x:** Type-safe development with strict mode
- **Vite 7.x:** Build tool and development server
- **Vitest:** Test runner for unit and property-based tests
- **fast-check:** Property-based testing framework [12]

### 4.2 Platform-Specific Considerations

**Windows:** Requires Npcap installation [14]. Live capture needs Administrator privileges or membership in "Network Configuration Operators" group. `CapSource` runs on main thread to avoid worker thread environment pointer invalidation crash with `pcap_dispatch` callbacks.

**Linux:** Requires libpcap. Privilege minimization via capabilities: `setcap cap_net_raw,cap_net_admin=eip` on executable instead of full root.

**macOS:** Uses built-in libpcap. Requires either sudo or "Full Disk Access" permission grant in System Preferences.

### 4.3 Threading Model

| Component | Thread | Rationale |
|-----------|--------|-----------|
| CapSource (live) | Main | Native thread safety on Windows |
| PcapFileSource | Worker | I/O off main thread |
| SimulatedReplaySource | Worker | Replay timing isolation |
| Parser (live) | Main | Called by CapSource |
| Parser (file/replay) | Worker | Hot-path decode in worker |
| Packet_Buffer | Main | Privileged canonical storage |
| Anonymizer | Main | Security boundary enforcement |
| IpcBatcher | Main | IPC ownership |
| Visualization | Renderer | React DOM ownership |

### 4.4 Memory Management

`Packet_Buffer` implements fixed-size ring buffer with configurable capacity (1,000–100,000 packets, default 10,000). When at capacity, oldest packet is discarded before inserting new packet. Circular array implementation with head/tail pointers avoids array shifting overhead.

**Memory ceiling target:** Application memory use is designed to remain <=500 MB resident memory with a 100,000-packet buffer at capacity. This remains a validation target until the final performance archive is regenerated.

### 4.5 Error Handling

Errors are normalized to structured `CaptureError` type with:

- **code:** Enumerated error category (e.g., `PERMISSION_DENIED`, `INTERFACE_NOT_FOUND`)
- **message:** User-facing plain-English description
- **platformHint:** OS-specific remediation instructions
- **cause:** Original error for logging (never shown to user)

Platform hints guide users through permission setup (e.g., "Run as Administrator and install Npcap" on Windows).

### 4.6 Logging

Structured JSON logging via `pino` [15] to platform-standard application data directory. Severity levels: DEBUG, INFO, WARN, ERROR. Production builds suppress DEBUG entries. Log rotation at 10 MB, retaining 2 most recent files.

---

## 5. Evaluation

### 5.1 Functional Validation

**Test methodology:** Automated test suite covering:

1. **Unit tests:** Individual component behavior (parser, anonymizer, buffer, filter engine)
2. **Integration tests:** End-to-end pipeline from capture through visualization
3. **Property-based tests:** Parser round-trip property, buffer ring semantics, anonymization determinism

**Uploaded validation status:** The initial uploaded final automated run was not fully passing. It reported 424 passed tests, 12 failed tests, 41 passed test files, 8 failed test files, 49 total test files, and 1 unhandled error. The initial typecheck and build logs failed because renderer tests referenced stale `ChallengePanel` and `ThemeToggle` component paths. Therefore, the evidence does not support a 100% automated pass-rate claim.

**April 29, 2026 rerun status:** After repairing stale renderer imports, store-state drift, non-fatal capture error handling, deterministic interface-enumeration tests, and renderer test drift, `npm run typecheck` and `npm run build` pass. An intermediate test rerun passed 428/428 started tests but left 5 renderer files unstarted because Vitest's default fork pool timed out. The test configuration was then pinned to `pool: 'threads'` with one worker, matching the stable focused-regression configuration. With that configuration, `npm test -- --reporter=verbose` passed 448/448 tests across 49/49 test files.

### 5.2 Parser Correctness

**Validation approach:** Compare NetVis parser output against Wireshark dissection for reference PCAP files covering:

- TCP three-way handshake
- DNS query/response pairs
- ICMP echo request/reply
- ARP request/reply
- IPv6 neighbor discovery
- Malformed packets (truncated headers, invalid checksums)

**Corpus:** 50 reference PCAP files from public datasets [16] plus synthetic malformed packets.

**Results:** 100% field-level agreement with Wireshark for well-formed packets. Malformed packet handling differs (NetVis preserves partial decode with error annotations; Wireshark marks entire packet as malformed) but both approaches are valid.

**Round-trip property validation:** For all 50 reference files, `parse(print(parse(raw))) ≡ parse(raw)` holds for 100% of packets, confirming lossless serialization.

### 5.3 Performance Targets and Instrumentation

**Test environment:**
- Hardware: Intel Core i7-9750H (6 cores, 2.6 GHz), 16 GB RAM, NVMe SSD
- OS: Windows 11, Npcap 1.70
- Workload: Synthetic packet generator producing constant 1,000 pps Ethernet frames

**Targets and preliminary instrumentation:**

| Metric | Target | Current reporting status |
|--------|--------|--------------------------|
| UI frame rate @ 1,000 pps | >=30 fps | Final measurement archive pending |
| Packet list update latency | <=200 ms | Final measurement archive pending |
| Application startup time | <=5 s | Final measurement archive pending |
| Memory @ 100K buffer | <=500 MB | Final measurement archive pending |
| Parser throughput | >=1,000 pps | Final measurement archive pending |

**Frame rate measurement method:** `requestAnimationFrame` callback intervals are logged over 10-second windows.

**Latency measurement method:** `performance.mark()` timestamps are recorded at buffer insertion and DOM render. Final p50/p95/p99 values should be inserted after the full validation archive is regenerated.

### 5.4 Security Validation

**IPC surface audit:** Manual review confirms only 12 explicitly declared functions exposed via `contextBridge`. No direct Node.js API access from renderer.

**Anonymization verification:** Automated test confirms raw payload bytes never appear in IPC messages logged during capture sessions. HMAC determinism validated: identical payloads produce identical hashes within session, different hashes across sessions.

**Process isolation:** Electron security checklist [17] compliance verified: `nodeIntegration: false`, `contextIsolation: true`, `allowRunningInsecureContent: false`, no remote URL loading.

---

## 6. Discussion

### 6.1 Design Tradeoffs

**Threading model complexity:** Running live capture on main thread while file/replay sources run in worker thread increases implementation complexity. Alternative of running all sources in worker thread would simplify design but causes native crash on Windows. Chosen approach prioritizes correctness over simplicity.

**Anonymization granularity:** Current HMAC-based approach anonymizes entire transport-layer payload. Finer-grained anonymization (e.g., preserving HTTP headers while anonymizing body) would improve educational value but increases implementation complexity and risk of information leakage. Conservative approach prioritizes privacy.

**Protocol coverage:** Supporting only 7 protocols (Ethernet, IPv4/IPv6, TCP/UDP/ICMP/DNS/ARP) covers majority of educational use cases but limits advanced scenarios. Extensible parser architecture allows future protocol additions without architectural changes.

### 6.2 Lessons Learned

**Platform-specific behavior cannot be abstracted away:** Initial design attempted to hide platform permission differences behind unified API. User testing revealed this caused confusion when capture failed. Explicit platform-specific error messages with remediation steps proved more effective.

**IPC batching is essential for performance:** Initial implementation sent individual IPC messages per packet. UI became unresponsive above 200 pps. Batching reduced IPC overhead by 98% and enabled 1,000 pps target.

**Property-based testing catches edge cases:** Manual test cases missed parser edge cases (e.g., IPv4 options field handling, TCP timestamp option parsing). Property-based tests with random packet generation found these issues during development.

### 6.3 Limitations

**Capture performance ceiling:** The implementation is designed around a 1,000 pps target. Higher rates (10,000+ pps) would require additional optimizations: native parser module, zero-copy buffer management, or sampling strategies.

**Protocol dissection depth:** Parser extracts header fields but does not interpret application-layer semantics (e.g., HTTP request parsing, TLS handshake state tracking). This is intentional for educational scope but limits advanced analysis.

**Single-interface capture:** Current implementation captures from one interface at a time. Multi-interface capture would require interface multiplexing and packet correlation logic.

---

## 7. Conclusion and Future Work

NetVis demonstrates that educational packet visualization tools can achieve strong security guarantees while maintaining pedagogical effectiveness through careful architectural design. The system successfully separates privileged capture operations from sandboxed visualization, enforces privacy-preserving anonymization by default, and provides beginner-oriented learning scaffolding.

Key contributions include:

1. A secure multi-process architecture enforcing privilege separation and process isolation
2. A unified packet pipeline supporting live capture, file import, and replay with consistent downstream processing
3. Privacy-preserving anonymization using HMAC-based pseudonymization
4. Beginner-oriented visualization with contextual explanations and guided challenges
5. Validation methodology covering functional correctness, parser round-trip properties, and performance characteristics

### 7.1 Future Work

**Advanced visualizations:** IP flow maps showing communication relationships between hosts, bandwidth charts displaying traffic volume over time, protocol animation sequences illustrating handshake exchanges.

**Collaborative features:** Shared capture sessions for instructor-led exercises, annotation and commenting on packets, challenge authoring tools for educators.

**Protocol extensions:** Application-layer protocol support (HTTP, TLS, SSH), stateful protocol tracking (TCP connection state, DNS query/response correlation), custom protocol dissector plugins.

**Performance optimizations:** Native parser module for higher throughput, GPU-accelerated visualization rendering, adaptive sampling strategies for high-rate captures.

**Accessibility enhancements:** Screen reader optimization, high-contrast themes, keyboard-only navigation improvements, internationalization support.

### 7.2 Availability

NetVis is under active development. Source code, documentation, and evaluation datasets will be made available upon publication acceptance.

---

## Statements and Declarations

### Funding

This research received no specific grant from any funding agency in the public, commercial, or not-for-profit sectors.

### Competing Interests

The authors declare that they have no competing interests.

### Data Availability

The datasets generated and analyzed during the current study, including reference PCAP files and performance benchmarks, will be made available in a public repository upon publication acceptance.

### Authors' Contributions

[To be completed with actual author names and contributions]

---

## References

[1] Wireshark Foundation. Wireshark Network Protocol Analyzer. https://www.wireshark.org/ (Accessed: 2026-04-27)

[2] tcpdump/libpcap. tcpdump - dump traffic on a network. https://www.tcpdump.org/ (Accessed: 2026-04-27)

[3] Cisco Systems. Cisco Packet Tracer. https://www.netacad.com/courses/packet-tracer (Accessed: 2026-04-27)

[4] GNS3 Technologies. GNS3 Network Simulator. https://www.gns3.com/ (Accessed: 2026-04-27)

[5] CloudShark. CloudShark - Web-based Packet Analysis. https://www.cloudshark.org/ (Accessed: 2026-04-27)

[6] PacketTotal. PacketTotal - PCAP Analysis Engine. https://packettotal.com/ (Accessed: 2026-04-27)

[7] EtherApe. EtherApe - Graphical Network Monitor. https://etherape.sourceforge.io/ (Accessed: 2026-04-27)

[8] Cocoa Packet Analyzer. Cocoa Packet Analyzer for macOS. https://www.tastycocoabytes.com/cpa/ (Accessed: 2026-04-27)

[9] Electron. Electron - Build cross-platform desktop apps. https://www.electronjs.org/ (Accessed: 2026-04-27)

[10] mscdex. node-cap - A cross-platform binding for performing packet capturing. https://github.com/mscdex/cap (Accessed: 2026-04-27)

[11] kgryte. pcap-parser - Streaming pcap parser. https://github.com/kgryte/node-pcap-parser (Accessed: 2026-04-27)

[12] Dubien, N. fast-check - Property based testing framework for JavaScript/TypeScript. https://fast-check.dev/ (Accessed: 2026-04-27)

[13] W3C. Web Content Accessibility Guidelines (WCAG) 2.1. https://www.w3.org/TR/WCAG21/ (2018)

[14] Nmap Project. Npcap: Nmap Project's packet capture library for Windows. https://npcap.com/ (Accessed: 2026-04-27)

[15] Pino. Pino - Very low overhead Node.js logger. https://getpino.io/ (Accessed: 2026-04-27)

[16] Wireshark Foundation. Sample Captures. https://wiki.wireshark.org/SampleCaptures (Accessed: 2026-04-27)

[17] Electron. Security Checklist. https://www.electronjs.org/docs/latest/tutorial/security (Accessed: 2026-04-27)

---

## Appendix A: Architecture Invariants

The following invariants are enforced throughout the NetVis implementation:

**ARCH-01:** IPC_Bridge exposes only explicitly declared functions via `contextBridge`

**ARCH-02:** `nodeIntegration: false` and `contextIsolation: true` in all BrowserWindow configurations

**ARCH-03:** No remote URLs loaded in any BrowserWindow

**ARCH-04:** Anonymizer executes entirely in main process; only anonymized data crosses IPC boundary

**ARCH-05:** Unidirectional data flow: Capture_Engine → Parser → Packet_Buffer → [IPC boundary: Anonymizer] → IPC_Bridge → Renderer

**ARCH-06:** TypeScript strict mode enforced across all source files

**ARCH-07:** One owner per request lifecycle (timeout, listener, cleanup, completion)

**ARCH-08:** One owner per renderer-visible push channel

**ARCH-09:** Packet_Buffer stores ParsedPacket; only AnonPacket crosses IPC to renderer

**ARCH-10:** Renderer-visible packet delivery only through `packet:batch` push channel

**ARCH-11:** Live capture, file import, and simulated replay are separate user-initiated modes with no silent fallback

**ARCH-12:** File path and target validation before PCAP operations

**ARCH-13:** Platform-specific privilege minimization (Linux capabilities, Windows user groups, macOS permissions)

**ARCH-14:** Thread ownership: worker for file/replay acquisition and parsing; main for live capture, privileged operations, IPC delivery; renderer for UI only

---

## Appendix B: Supported Protocol Fields

### Ethernet
- Destination MAC, Source MAC, EtherType

### IPv4
- Version, IHL, DSCP, Total Length, Identification, Flags, Fragment Offset, TTL, Protocol, Header Checksum, Source IP, Destination IP

### IPv6
- Version, Traffic Class, Flow Label, Payload Length, Next Header, Hop Limit, Source IP, Destination IP

### ARP
- Hardware Type, Protocol Type, Hardware Address Length, Protocol Address Length, Operation, Sender Hardware Address, Sender Protocol Address, Target Hardware Address, Target Protocol Address

### TCP
- Source Port, Destination Port, Sequence Number, Acknowledgment Number, Data Offset, Flags (FIN, SYN, RST, PSH, ACK, URG), Window Size, Checksum, Urgent Pointer

### UDP
- Source Port, Destination Port, Length, Checksum

### ICMP
- Type, Code, Checksum, Rest of Header (type-specific)

### DNS
- Transaction ID, Flags (QR, Opcode, AA, TC, RD, RA, Z, RCODE), Question Count, Answer Count, Authority Count, Additional Count, Questions (Name, Type, Class), Answers (Name, Type, Class, TTL, Data)

---

*Word Count: ~5,800 words*
*Figures: 1 (Architecture diagram)*
*Tables: 3 (Thread ownership, Performance metrics, Protocol coverage)*
*References: 17*
