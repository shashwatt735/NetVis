# Requirements Document

## Introduction

NetVis is a cross-platform desktop application (Windows, Linux, macOS) built with Electron, React, and TypeScript. It enables beginner networking students to capture live network packets, load saved PCAP files, and explore protocol behavior through real-time visualizations and an educational layer. The application parses Ethernet, IP, TCP, UDP, ICMP, and DNS protocols, provides text-based filtering, anonymizes sensitive payload data by default, and guides learners through contextual explanations and structured challenges.

---

## Glossary

- **Application**: The NetVis Electron desktop process as a whole.
- **Capture_Engine**: The main-process component responsible for interfacing with libpcap/Npcap to capture live packets.
- **Packet_Buffer**: The in-memory ring buffer that holds captured or loaded packets up to a configurable maximum size.
- **Parser**: The component that decodes raw packet bytes into structured protocol fields.
- **Pretty_Printer**: The component that serializes a structured Packet back into a human-readable or PCAP-compatible representation.
- **Filter_Engine**: The component that evaluates a filter expression against each packet to determine visibility.
- **Filter_Grammar**: The formal BNF grammar defining valid filter expressions (see Requirement 8).
- **Packet_List**: The scrollable UI table that displays captured or loaded packets in real time.
- **Protocol_Chart**: The UI chart that shows the distribution of protocols across packets currently in the Packet_Buffer.
- **Educational_Layer**: The subsystem providing tooltips, field explanations, and guided challenges.
- **Anonymizer**: The component that replaces sensitive payload data with deterministic pseudonyms before any data reaches the renderer process.
- **IPC_Bridge**: The Electron contextBridge/preload layer that mediates all communication between the renderer and main processes.
- **Logger**: The main-process component that writes structured diagnostic and error entries to a persistent log file.
- **Packet**: A structured object containing decoded protocol fields, metadata (timestamp, interface, length), and an anonymized payload reference.
- **pps**: Packets per second.
- **PCAP**: Packet capture file format (.pcap / .pcapng).
- **Welcome_Screen**: The first-launch onboarding overlay that introduces NetVis to new users.
- **Packet_Flow_Timeline**: The time-series chart that displays packet arrival counts aggregated into 1-second buckets over the most recent 60 seconds.
- **Packet_Detail_Inspector**: The layered protocol tree panel that displays decoded fields for a selected packet, replacing the plain detail panel.
- **Visualization_Suite**: The collective set of primary visualization components — Protocol_Chart, Packet_Flow_Timeline, and Packet_Detail_Inspector — treated as a first-class system component.
- **Visual_Design_System**: The application-wide set of color palette, typography, spacing, and component style rules that ensure a consistent and approachable visual appearance.
- **OSI_Layer_Diagram**: The panel that maps a selected packet's decoded protocol headers onto the 7-layer OSI model, visually indicating which layers are present.
- **IP_Flow_Map**: The node-link diagram showing communication relationships between IP addresses observed in the Packet_Buffer.
- **Bandwidth_Chart**: The stacked area chart showing traffic volume in bytes over time, broken down by protocol.
- **Protocol_Animations**: The step-by-step animated walkthroughs of protocol exchanges (TCP handshake, DNS query/response, ICMP echo) in the Educational_Layer.
- **Simulated_Capture**: A replay mode that feeds packets from a loaded PCAP file into the Packet_Buffer at a configurable speed multiplier, simulating live capture for environments where live network access is unavailable.

---

## Architecture Invariants

These rules apply unconditionally across the entire application. Any implementation decision that would violate one of these invariants must be rejected.

| ID      | Requirement                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| ARCH-01 | THE IPC_Bridge SHALL expose only explicitly declared functions to the renderer via Electron's `contextBridge` API.                    |
| ARCH-02 | THE Application SHALL set `nodeIntegration: false` and `contextIsolation: true` in all BrowserWindow webPreferences.                  |
| ARCH-03 | THE Application SHALL NOT load remote URLs in any BrowserWindow.                                                                      |
| ARCH-04 | THE Anonymizer SHALL execute entirely within the main process; only anonymized data SHALL cross the IPC_Bridge to the renderer.       |
| ARCH-05 | THE Application SHALL enforce unidirectional data flow: Capture_Engine → Parser → Anonymizer → Packet_Buffer → IPC_Bridge → Renderer. |
| ARCH-06 | THE Application SHALL use TypeScript strict mode across all source files in main, preload, and renderer.                              |

---

## Requirements

### Requirement 1: Network Interface Enumeration

**User Story:** As a student, I want to see a list of available network interfaces before starting a capture, so that I can choose the correct interface for my exercise.

#### Acceptance Criteria

1. WHEN the Application starts, THE Capture_Engine SHALL enumerate all network interfaces available on the host operating system and expose the list to the renderer via the IPC_Bridge within 2 seconds of application ready.
2. THE Capture_Engine SHALL include, for each interface, its system name, a human-readable display name (where the OS provides one), and its current up/down status.
3. IF the Capture_Engine fails to enumerate interfaces (e.g., missing permissions), THEN THE Application SHALL display an error message describing the cause and the corrective action required (e.g., "Run as administrator" on Windows).
4. WHEN the user opens the interface selector, THE Application SHALL display the enumerated interface list sorted alphabetically by display name.

---

### Requirement 2: Live Packet Capture

**User Story:** As a student, I want to start and stop live packet capture on a selected interface, so that I can observe real network traffic.

#### Acceptance Criteria

1. WHEN the user selects an interface and initiates capture, THE Capture_Engine SHALL begin capturing packets on that interface using libpcap (Linux/macOS) or Npcap (Windows).
2. WHEN the user stops capture, THE Capture_Engine SHALL cease packet capture within 500ms and flush any pending packets to the Packet_Buffer.
3. WHILE capture is active, THE Capture_Engine SHALL process incoming packets without blocking the Electron main-process event loop, using a dedicated worker thread or native addon async callback.
4. WHILE capture is active, THE Capture_Engine SHALL process each packet within 5 ms of receipt, measured from the libpcap/Npcap callback timestamp to insertion into the Packet_Buffer.
5. WHILE capture is active and the Packet_Buffer is at maximum capacity, THE Capture_Engine SHALL discard the oldest packet in the buffer to accommodate the new packet AND THE Application SHALL display a persistent status indicator informing the user that buffer overflow is occurring and packets are being dropped.
6. WHEN capture is stopped, THE Packet_Buffer SHALL retain all packets collected during the session until the user explicitly clears the buffer or starts a new capture session.
7. IF the Capture_Engine loses access to the capture interface after capture has started (e.g., interface removed), THEN THE Application SHALL stop capture, log the error via the Logger, and display a notification to the user within 1 second of detecting the failure.
8. THE Application SHALL provide a Simulated_Capture mode that replays a loaded PCAP file into the Packet_Buffer at a user-selectable speed multiplier of 0.5×, 1×, 2×, or 5×, for use in environments where live network capture is unavailable.

---

### Requirement 3: Protocol Parsing

**User Story:** As a student, I want each captured packet decoded into labeled protocol fields, so that I can understand what each byte means.

#### Acceptance Criteria

1. WHEN a raw packet is received, THE Parser SHALL decode the following protocol layers in order: Ethernet → IP (v4 and v6) → TCP, UDP, ICMP, DNS.
2. THE Parser SHALL extract and label all standard header fields for each supported protocol (e.g., source/destination MAC, EtherType, source/destination IP, TTL, protocol number, source/destination port, flags, sequence/acknowledgment numbers, DNS query name and record type).
3. IF a packet contains a protocol layer not in the supported set, THEN THE Parser SHALL mark that layer as "Unknown" and preserve the raw byte length without exposing raw payload bytes to the renderer.
4. IF a packet is malformed (e.g., header length exceeds packet length), THEN THE Parser SHALL produce a partial Packet containing all successfully decoded fields, mark the malformed layer with an error annotation, and pass the Packet to the Packet_Buffer without crashing.
5. THE Pretty_Printer SHALL serialize any Packet back into a valid PCAP record byte sequence.
6. FOR ALL valid Packets, parsing a PCAP record then printing then parsing SHALL produce a Packet with identical field values (round-trip property).

---

### Requirement 4: Payload Anonymization

**User Story:** As a student using a shared or institutional network, I want sensitive payload content hidden by default, so that I am not inadvertently exposed to private data.

#### Acceptance Criteria

1. THE Anonymizer SHALL replace all transport-layer payload bytes with a deterministic pseudonym derived from a session-scoped key before any Packet data is passed through the IPC_Bridge to the renderer process.
2. THE Application SHALL enable anonymization by default; the user SHALL NOT be able to disable anonymization through the UI without explicitly modifying application configuration outside the UI.
3. THE Anonymizer SHALL preserve packet metadata (timestamps, protocol headers, field labels, byte lengths) unchanged so that educational analysis remains meaningful.
4. IF a packet contains a DNS response, THEN THE Anonymizer SHALL anonymize the resolved IP addresses in the answer section while preserving the query name and record type.
5. THE Application SHALL NOT expose raw payload bytes in any renderer-accessible IPC channel, log file, or exported PCAP file.

---

### Requirement 5: Real-Time Packet List

**User Story:** As a student, I want to see incoming packets displayed in a scrollable list as they arrive, so that I can follow traffic in real time.

#### Acceptance Criteria

1. WHILE capture is active, THE Packet_List SHALL update to display newly received packets within 200ms of the packet being added to the Packet_Buffer, measured from the timestamp the packet enters the buffer to the timestamp the corresponding row becomes visible in the DOM.
2. THE Packet_List SHALL display, for each packet: arrival timestamp (millisecond precision), source address, destination address, protocol name, and packet length in bytes.
3. WHILE capture is active and the incoming rate is at or below 1000 pps, THE Application SHALL maintain a frame rate of at least 30 frames per second in the renderer process as measured by the browser's `requestAnimationFrame` callback interval.
4. WHEN the Packet_List contains no packets, THE Application SHALL display a non-empty placeholder message indicating that no packets have been captured yet.
5. THE Packet_List SHALL support keyboard navigation (arrow keys to move between rows, Enter to expand a row) meeting WCAG 2.1 Level AA focus management criteria.

---

### Requirement 6: Protocol Distribution Visualization

**User Story:** As a student, I want a chart showing the breakdown of protocols in the current capture, so that I can quickly understand traffic composition.

#### Acceptance Criteria

1. WHILE capture is active or a PCAP file is loaded, THE Protocol_Chart SHALL reflect the current protocol distribution of all packets in the Packet_Buffer.
2. WHEN the Packet_Buffer contents change (packet added or buffer cleared), THE Protocol_Chart SHALL update within 500ms of the change.
3. THE Protocol_Chart SHALL display each protocol as a labeled segment with its packet count and percentage of total packets.
4. THE Protocol_Chart SHALL provide a text-based alternative representation (e.g., a data table) accessible to screen readers, meeting WCAG 2.1 Level AA for non-text content.

---

### Requirement 7: PCAP File Import

**User Story:** As a student, I want to load a saved PCAP file for offline analysis, so that I can study pre-recorded traffic without needing a live network.

#### Acceptance Criteria

1. WHEN the user selects a PCAP file via the file picker, THE Application SHALL parse the file using the Parser and populate the Packet_Buffer with the file's packets within 5 seconds for files up to 100 MB.
2. THE Application SHALL support both `.pcap` (libpcap format) and `.pcapng` (pcapng format) file extensions.
3. IF the selected file is not a valid PCAP or PCAPNG file, THEN THE Application SHALL display an error message identifying the file name and stating that the format is unrecognized, without crashing.
4. WHEN a PCAP file is loaded, THE Application SHALL display the total packet count and file size in the status bar.

---

### Requirement 8: PCAP File Export

**User Story:** As a student, I want to save the current capture session to a PCAP file, so that I can share it with an instructor or revisit it later.

#### Acceptance Criteria

1. WHEN the user initiates export, THE Application SHALL write all packets currently in the Packet_Buffer to a `.pcap` file chosen by the user via a save dialog.
2. THE Pretty_Printer SHALL produce a PCAP file that can be opened by Wireshark 4.x without errors.
3. IF the export fails (e.g., insufficient disk space, write permission denied), THEN THE Application SHALL display an error message stating the reason for failure and SHALL NOT produce a partial or corrupt file at the target path.
4. WHILE export is in progress, THE Application SHALL display a progress indicator and SHALL NOT block the user from viewing the Packet_List.

---

### Requirement 9: Text-Based Packet Filtering

**User Story:** As a student, I want to type a filter expression to narrow the packet list, so that I can focus on traffic relevant to my exercise.

#### Acceptance Criteria

1. THE Filter_Engine SHALL accept filter expressions conforming to the following Filter_Grammar:

   ```
   expression  ::= term ( ( "AND" | "OR" ) term )*
   term        ::= [ "NOT" ] predicate
   predicate   ::= field comparator value
   field       ::= "proto" | "src" | "dst" | "port" | "len"
   comparator  ::= "==" | "!=" | ">" | "<" | ">=" | "<="
   value       ::= quoted-string | number | ip-address | protocol-name
   protocol-name ::= "TCP" | "UDP" | "ICMP" | "DNS" | "ARP" | "OTHER"
   quoted-string ::= '"' [^"]* '"'
   number      ::= [0-9]+
   ip-address  ::= ipv4-address | ipv6-address
   ```

2. WHEN the user submits a valid filter expression, THE Filter_Engine SHALL apply the filter to the Packet_Buffer and update the Packet_List to show only matching packets within 300ms for buffers containing up to 100,000 packets.
3. WHEN the user clears the filter expression, THE Packet_List SHALL revert to displaying all packets in the Packet_Buffer within 300ms.
4. IF the user submits a filter expression that does not conform to the Filter_Grammar, THEN THE Filter_Engine SHALL display an inline error message identifying the invalid token or clause without modifying the current Packet_List view.
5. THE Filter_Engine SHALL treat filter expression evaluation as a read-only operation that does not modify the Packet_Buffer contents.

---

### Requirement 10: Educational Layer — Field Explanations

**User Story:** As a beginner student, I want contextual explanations of protocol fields when I inspect a packet, so that I can learn what each field means without leaving the application.

#### Acceptance Criteria

1. WHEN the user selects a packet row in the Packet_List, THE Educational_Layer SHALL display a detail panel showing each decoded protocol field with its name, value, byte offset, and a plain-English explanation of the field's purpose.
2. THE Educational_Layer SHALL provide explanations for all fields of the following protocols: Ethernet (destination MAC, source MAC, EtherType), IPv4 (version, IHL, DSCP, total length, TTL, protocol, source IP, destination IP), TCP (source port, destination port, sequence number, acknowledgment number, flags, window size), UDP (source port, destination port, length, checksum), ICMP (type, code, checksum), DNS (ID, flags, question count, answer count, query name, record type).
3. WHERE a protocol field has a well-known enumerated value (e.g., TCP flag SYN, DNS record type A), THE Educational_Layer SHALL display the symbolic name alongside the numeric value.
4. THE Educational_Layer SHALL provide all field explanation text in a format accessible to screen readers, with each explanation associated to its field label via ARIA attributes meeting WCAG 2.1 Level AA.

---

### Requirement 11: Educational Layer — Guided Challenges

**User Story:** As a student, I want structured exercises that prompt me to find specific packets or identify protocol behaviors, so that I can test my understanding.

#### Acceptance Criteria

1. THE Educational_Layer SHALL include a challenge library containing at least 5 distinct guided challenges covering: identifying a TCP three-way handshake, identifying a DNS query/response pair, identifying an ICMP echo request/reply pair, filtering traffic by port number, and comparing packet lengths across protocols.
2. WHEN the user activates a challenge, THE Educational_Layer SHALL display a goal description, success criteria, and a hint that can be revealed on demand.
3. WHILE a challenge is active, THE Educational_Layer SHALL evaluate the success criteria at most every 500 ms using a debounced check to avoid excessive re-evaluation during rapid packet arrival.
4. WHEN the user's current Packet_List state satisfies a challenge's success criteria, THE Educational_Layer SHALL display a completion notification within 1 second of the criteria being met.
5. THE Educational_Layer SHALL track challenge completion state in persistent local storage so that completed challenges remain marked across application restarts.

---

### Requirement 12: Packet Buffer Management

**User Story:** As a student, I want the application to manage memory predictably, so that it does not consume unbounded resources during long captures.

#### Acceptance Criteria

1. THE Packet_Buffer SHALL enforce a configurable maximum packet count with a default of 10,000 packets and a user-configurable range of 1,000 to 100,000 packets.
2. WHILE the Packet_Buffer is at maximum capacity and a new packet arrives, THE Packet_Buffer SHALL remove the oldest packet before inserting the new packet (ring-buffer semantics).
3. THE Application SHALL expose the current buffer occupancy (packet count and percentage of maximum) in the status bar, updated at most every 500ms.
4. WHEN the user explicitly clears the buffer, THE Packet_Buffer SHALL remove all packets and THE Application SHALL reset the Protocol_Chart and Packet_List to their empty states within 200ms.

---

### Requirement 13: Logging and Error Reporting

**User Story:** As a student or instructor troubleshooting a problem, I want the application to record errors to a log file, so that issues can be diagnosed without requiring a debugger.

#### Acceptance Criteria

1. THE Logger SHALL write structured log entries (timestamp, severity level, component name, message) to a persistent log file located in the platform-standard application data directory.
2. WHEN an unhandled exception occurs in the main process, THE Logger SHALL record the exception type, message, and stack trace before the process exits.
3. THE Logger SHALL support severity levels: DEBUG, INFO, WARN, ERROR. In production builds, THE Logger SHALL record entries at INFO level and above only.
4. THE Application SHALL provide a menu action that opens the log file location in the platform file explorer.
5. THE Logger SHALL rotate the log file when it exceeds 10 MB, retaining the two most recent rotated files.

---

### Requirement 14: Non-Functional — Performance

**User Story:** As a student, I want the application to remain responsive during active captures, so that the UI does not freeze or lag during exercises.

#### Acceptance Criteria

1. WHILE capture is active at a sustained rate of 1,000 pps, THE Application SHALL maintain a renderer frame rate of at least 30 fps as measured by `requestAnimationFrame` callback intervals over a 10-second window.
2. WHILE capture is active at a sustained rate of 1,000 pps, THE Packet_List SHALL update with new packets within 200ms of each packet entering the Packet_Buffer, measured end-to-end from buffer insertion timestamp to DOM row render timestamp logged via `performance.mark`.
3. THE Application SHALL reach the main window ready-to-interact state within 5 seconds of process launch on a machine meeting the minimum hardware specification (dual-core 2 GHz CPU, 4 GB RAM, SSD).
4. THE Application SHALL consume no more than 500 MB of resident memory during a capture session with the Packet_Buffer at maximum capacity (100,000 packets).

---

### Requirement 15: Non-Functional — Security

**User Story:** As a student on a shared machine, I want the application to follow security best practices, so that it does not introduce vulnerabilities.

#### Acceptance Criteria

1. THE IPC_Bridge SHALL expose only explicitly declared functions to the renderer process via Electron's `contextBridge` API; direct access to Node.js APIs from renderer code SHALL be disabled (`nodeIntegration: false`, `contextIsolation: true`).
2. THE Application SHALL sanitize all user-supplied strings (filter expressions, file paths) in the main process before passing them to native APIs or the file system.
3. THE Anonymizer SHALL execute entirely within the main process; anonymized data only SHALL cross the IPC_Bridge to the renderer.
4. THE Application SHALL not load remote URLs in the BrowserWindow; `webPreferences.allowRunningInsecureContent` SHALL be `false`.

---

### Requirement 16: Non-Functional — Accessibility

**User Story:** As a student who relies on assistive technology, I want the application to be navigable without a mouse, so that I can participate in exercises.

#### Acceptance Criteria

1. THE Application SHALL support full keyboard navigation for all primary workflows: interface selection, capture start/stop, filter input, packet row selection, and challenge activation.
2. THE Application SHALL provide visible focus indicators on all interactive elements meeting a minimum contrast ratio of 3:1 against adjacent colors per WCAG 2.1 Success Criterion 1.4.11.
3. THE Application SHALL assign ARIA roles and labels to all custom interactive components (Packet_List rows, Protocol_Chart, filter input, challenge panel) so that screen readers announce their purpose and state.
4. THE Application SHALL not rely solely on color to convey information (e.g., protocol type in the Protocol_Chart SHALL also be distinguished by label or pattern).
5. WHILE the operating system 'reduce motion' accessibility preference is enabled, THE Application SHALL replace all animations (row fade-ins, chart transitions, panel slide-ins, Protocol_Animations) with instant transitions while preserving all functional behavior.

---

### Requirement 18: Visual Design System

**User Story:** As a beginner student, I want the application to look modern and approachable, so that I feel comfortable exploring it without prior networking experience.

#### Acceptance Criteria

1. THE Application SHALL apply a consistent visual design system across all screens, defining a color palette, typography scale, spacing scale, and component styles that are used uniformly throughout the UI.
2. THE Application SHALL use the following fixed per-protocol color mapping on every UI surface that references protocol identity (Packet_List rows, Protocol_Chart segments, Packet_Detail_Inspector layer nodes, Packet_Flow_Timeline buckets, OSI_Layer_Diagram active layers): TCP = `#3B82F6` (blue), UDP = `#10B981` (green), ICMP = `#F59E0B` (amber), DNS = `#8B5CF6` (purple), ARP = `#EF4444` (red), OTHER = `#6B7280` (gray). These values SHALL NOT vary between dark and light mode; only the surrounding background and text colors SHALL adapt.
3. THE Application SHALL provide a dark mode and a light mode; WHEN the Application starts for the first time, THE Application SHALL default to the operating system's preferred color scheme.
4. THE Application SHALL render all text at a minimum body font size of 14 px and all interactive control labels at a minimum of 13 px to ensure legibility without zooming.
5. THE Application SHALL maintain a minimum color contrast ratio of 4.5:1 between foreground text and its background on all primary content surfaces, meeting WCAG 2.1 Level AA Success Criterion 1.4.3.
6. THE Application SHALL provide a manual dark/light mode toggle in the application toolbar or settings panel, allowing the user to override the operating system color scheme preference at any time.

---

### Requirement 19: Onboarding and Welcome Experience

**User Story:** As a first-time user, I want a guided welcome experience when I open the application for the first time, so that I understand what the tool does and how to get started without reading external documentation.

#### Acceptance Criteria

1. WHEN the Application is launched for the first time (no prior session data present in local storage), THE Application SHALL display a Welcome_Screen before the main capture interface.
2. THE Welcome_Screen SHALL present a brief (three-step maximum) visual walkthrough covering: what NetVis does, how to start a live capture or load a PCAP file, and where to find the Educational_Layer challenges.
3. WHEN the user completes or dismisses the Welcome_Screen, THE Application SHALL record the completion in persistent local storage so that the Welcome_Screen is not shown on subsequent launches.
4. THE Application SHALL provide a "Show Welcome Guide" menu action that re-opens the Welcome_Screen at any time, allowing users to revisit the introduction.
5. THE Welcome_Screen SHALL be fully keyboard-navigable and meet WCAG 2.1 Level AA focus management criteria.

---

### Requirement 20: Contextual Help and Progressive Disclosure

**User Story:** As a beginner student, I want inline help cues and progressive disclosure of advanced options, so that the interface does not overwhelm me while still letting me access deeper functionality when I am ready.

#### Acceptance Criteria

1. THE Application SHALL display a help icon (e.g., "?") adjacent to every non-obvious UI control; WHEN the user activates a help icon, THE Application SHALL show a tooltip or popover containing a plain-English description of that control's purpose and effect.
2. THE Application SHALL group advanced settings (buffer size configuration, anonymization toggle path, log file access) behind a clearly labeled "Advanced" section or panel that is collapsed by default.
3. WHEN the Application is in an idle state (no capture active, no file loaded), THE Application SHALL display a status bar message in plain English describing the next recommended action (e.g., "Select a network interface and press Start to begin capturing packets.").
4. WHILE capture is active, THE Application SHALL display a plain-English status bar message describing the current capture state, including the active interface name, elapsed capture time, and current packet rate in pps.
5. IF the Packet_List is empty after a filter is applied, THEN THE Application SHALL display an inline message explaining that no packets match the current filter and suggesting the user clear or modify the filter expression.

---

### Requirement 21: Visual Feedback and Animations

**User Story:** As a student, I want smooth visual feedback when packets arrive and when I interact with the UI, so that the application feels responsive and helps me understand what is happening in real time.

#### Acceptance Criteria

1. WHEN a new packet row is added to the Packet_List, THE Application SHALL play a brief highlight animation (fade-in or slide-in, duration 150–300 ms) on the new row to draw attention to the arrival without disrupting existing rows.
2. WHEN the Protocol_Chart updates due to a change in the Packet_Buffer, THE Application SHALL animate the segment size transitions over a duration of 200–400 ms using an easing function, rather than jumping to the new values instantly.
3. WHEN the user selects a packet row, THE Application SHALL transition the Packet_Detail panel into view with a smooth animation (duration 150–250 ms) rather than an instant appearance.
4. WHEN capture is active, THE Application SHALL display a pulsing or animated capture-active indicator (e.g., a blinking dot or animated icon) in the toolbar so the user can confirm at a glance that capture is running.
5. THE Application SHALL respect the operating system's "reduce motion" accessibility preference; WHEN reduced motion is enabled, THE Application SHALL replace all animations with instant transitions while preserving all functional behavior.

---

### Requirement 22: Packet Flow Timeline

**User Story:** As a student, I want a timeline chart showing packet arrival rate over time, so that I can identify bursts of traffic and correlate them with network events.

#### Acceptance Criteria

1. WHILE capture is active or a PCAP file is loaded, THE Packet_Flow_Timeline SHALL display a time-series chart of packet counts aggregated into 1-second buckets, covering the most recent 60 seconds of capture time.
2. THE Packet_Flow_Timeline SHALL update in real time during live capture, appending a new data point at most every 1 second and scrolling the visible window to keep the most recent data in view.
3. THE Packet_Flow_Timeline SHALL color each bar or data point using the dominant protocol color for that time bucket (the protocol with the highest packet count in that bucket), consistent with the per-protocol color coding defined in Requirement 18.
4. WHEN the user clicks or taps a time bucket in the Packet_Flow_Timeline, THE Filter_Engine SHALL apply a time-range filter to the Packet_List showing only packets that arrived within that 1-second bucket.
5. THE Packet_Flow_Timeline SHALL provide a text-based alternative (e.g., a data table of bucket timestamps and counts) accessible to screen readers, meeting WCAG 2.1 Level AA for non-text content.
6. WHEN the Packet_Buffer is empty or no file is loaded, THE Packet_Flow_Timeline SHALL display a placeholder message indicating that no data is available.

---

### Requirement 23: Visual Packet Detail Inspector

**User Story:** As a student, I want a visually structured packet detail view that shows protocol layers as an expandable tree, so that I can understand the layered nature of network protocols without reading raw hex.

#### Acceptance Criteria

1. WHEN the user selects a packet in the Packet_List, THE Application SHALL display a Packet_Detail_Inspector panel showing the decoded packet as a layered protocol tree, with one collapsible node per protocol layer (e.g., Ethernet, IP, TCP, DNS).
2. THE Packet_Detail_Inspector SHALL render each protocol layer node using the protocol's assigned color from the per-protocol color coding system defined in Requirement 18, so that layers are visually distinguishable at a glance.
3. WHEN the user expands a protocol layer node, THE Packet_Detail_Inspector SHALL display each field as a labeled row showing the field name, decoded value, and byte offset, consistent with the Educational_Layer field explanations defined in Requirement 10.
4. THE Packet_Detail_Inspector SHALL indicate the nesting depth of each protocol layer visually (e.g., via indentation and connecting lines) to reinforce the concept of protocol encapsulation.
5. WHEN the user hovers over or focuses a field row in the Packet_Detail_Inspector, THE Application SHALL highlight the corresponding byte range in a hex/byte summary strip at the bottom of the inspector panel.
6. THE Packet_Detail_Inspector SHALL be fully keyboard-navigable (arrow keys to expand/collapse nodes, Tab to move between fields) and meet WCAG 2.1 Level AA focus management criteria.

---

### Requirement 24: Visualization as a Core System Component

**User Story:** As a student, I want visualizations to be the primary way I interact with and understand network data, so that I can learn through seeing rather than reading raw packet tables.

#### Acceptance Criteria

1. THE Application SHALL treat the Visualization_Suite — comprising the Protocol_Chart, the Packet_Flow_Timeline, and the Packet_Detail_Inspector — as first-class UI components that are visible by default in the main application layout without requiring the user to navigate to a separate view or tab.
2. THE Application's main layout SHALL allocate at least 40% of the available window area to the Visualization_Suite when the window width is 1280 px or greater.
3. WHEN the Application loads a PCAP file or begins a live capture, THE Visualization_Suite components SHALL populate and become interactive before the Packet_List finishes rendering all rows, ensuring that visual insight is available as early as possible.
4. THE Application SHALL keep all Visualization_Suite components synchronized with the Packet_Buffer at all times; WHEN the Packet_Buffer is cleared, all Visualization_Suite components SHALL reset to their empty states within 200 ms.
5. THE Application SHALL use the per-protocol color coding system defined in Requirement 18 consistently across all Visualization_Suite components so that a student who learns a protocol's color in one chart can immediately recognize it in all other charts and lists.
6. THE Application SHALL provide a "Focus Visualization" mode that expands the Visualization_Suite to occupy the full window area, hiding the Packet_List, to allow students to study traffic patterns without distraction.

---

### Requirement 25: Non-Functional — Portability

**User Story:** As a student on any major desktop OS, I want the application to install and run without manual dependency setup, so that I can start learning immediately.

#### Acceptance Criteria

1. THE Application SHALL run on Windows 10 (x64), macOS 12 (x64 and arm64), and Ubuntu 22.04 LTS (x64) without requiring the user to manually install libpcap or Npcap; the installer SHALL bundle or prompt for these dependencies automatically.
2. THE Application SHALL produce installable artifacts for all three platforms via the existing `electron-builder` build pipeline.
3. IF the required capture library (libpcap or Npcap) is absent at runtime, THEN THE Application SHALL display a platform-specific installation guide and disable live capture functionality gracefully, leaving PCAP file import available.

---

### Requirement 26: OSI Layer Stack Diagram

**User Story:** As a student, I want to see a selected packet's protocol headers mapped onto the 7-layer OSI model, so that I can understand which real protocols correspond to which conceptual layers.

#### Acceptance Criteria

1. WHEN the user selects a packet in the Packet_List, THE OSI_Layer_Diagram SHALL display a vertical stack of all seven OSI layers (Physical, Data Link, Network, Transport, Session, Presentation, Application) with each layer labeled by its OSI name and number.
2. THE OSI_Layer_Diagram SHALL highlight each layer that has a corresponding decoded protocol header in the selected packet (e.g., Ethernet → Data Link, IP → Network, TCP/UDP → Transport, DNS → Application) using a visually active state distinct from inactive layers.
3. WHILE a layer has no corresponding protocol header in the selected packet, THE OSI_Layer_Diagram SHALL render that layer in a visually dimmed state to indicate it is not present in the packet.
4. WHEN the user clicks an active layer in the OSI_Layer_Diagram, THE Packet_Detail_Inspector SHALL expand the corresponding protocol node for that layer, bringing it into view.
5. THE OSI_Layer_Diagram SHALL apply the per-protocol color coding defined in Requirement 18 to each active layer's label and highlight, so that colors are consistent with the rest of the Visualization_Suite.
6. THE OSI_Layer_Diagram SHALL be fully keyboard-navigable (Tab to move between layers, Enter to activate) and meet WCAG 2.1 Level AA focus management criteria.
7. WHEN no packet is selected, THE OSI_Layer_Diagram SHALL display all seven layers in a neutral (non-highlighted, non-dimmed) state with a placeholder message prompting the user to select a packet.

---

### Requirement 27: IP Flow / Connection Map

**User Story:** As a student, I want a node-link diagram showing which IP addresses communicated with which, so that I can understand the topology of the captured traffic at a glance.

#### Acceptance Criteria

1. WHEN a PCAP file is loaded or after live capture stops, THE IP_Flow_Map SHALL display a node-link diagram where each node represents a unique IP address observed in the Packet_Buffer and each edge represents one or more packets exchanged between two IP addresses.
2. THE IP_Flow_Map SHALL label each edge with the total packet count for that address pair and SHALL encode packet count as edge thickness, so that high-volume connections are visually prominent.
3. WHEN the user clicks a node in the IP_Flow_Map, THE Filter_Engine SHALL apply a filter to the Packet_List showing only packets where the source or destination IP matches the selected node's IP address.
4. WHEN the user clicks an edge in the IP_Flow_Map, THE Filter_Engine SHALL apply a filter to the Packet_List showing only packets exchanged between the two IP addresses connected by that edge.
5. THE IP_Flow_Map SHALL update within 1 second of the Packet_Buffer changing (file load complete or capture stop) to reflect the current set of IP address pairs.
6. IF the Packet_Buffer contains no IP packets, THEN THE IP_Flow_Map SHALL display a placeholder message stating that no IP flows are available.
7. THE IP_Flow_Map SHALL provide a text-based alternative (e.g., a table of IP pairs and packet counts) accessible to screen readers, meeting WCAG 2.1 Level AA for non-text content.

---

### Requirement 28: Bandwidth / Traffic Volume Area Chart

**User Story:** As a student, I want a chart showing traffic volume in bytes over time broken down by protocol, so that I can identify when and which protocols generated the most traffic.

#### Acceptance Criteria

1. WHILE a PCAP file is loaded or live capture is active, THE Bandwidth_Chart SHALL display a stacked area chart of traffic volume in bytes per second, with each protocol represented as a distinct stacked area using the per-protocol color coding defined in Requirement 18.
2. THE Bandwidth_Chart SHALL update at most every 1 second during live capture, appending a new data point and scrolling to keep the most recent data in view.
3. WHEN the user clicks or taps a region of the Bandwidth_Chart, THE Filter_Engine SHALL apply a time-range filter to the Packet_List showing only packets that arrived within the 1-second bucket corresponding to the clicked region.
4. THE Bandwidth_Chart SHALL display a y-axis labeled in bytes and an x-axis labeled with timestamps, with tick marks at regular intervals sufficient to orient the user.
5. THE Bandwidth_Chart SHALL provide a text-based alternative (e.g., a data table of timestamps, protocol names, and byte counts) accessible to screen readers, meeting WCAG 2.1 Level AA for non-text content.
6. WHEN the Packet_Buffer is empty or no file is loaded, THE Bandwidth_Chart SHALL display a placeholder message indicating that no data is available.

---

### Requirement 29: Protocol Step-by-Step Animations

**User Story:** As a student, I want animated walkthroughs of common protocol exchanges, so that I can see exactly how TCP handshakes, DNS queries, and ICMP pings work step by step.

#### Acceptance Criteria

1. THE Protocol_Animations SHALL include animated walkthroughs for the following exchanges: TCP three-way handshake (SYN → SYN-ACK → ACK), DNS query and response (client query → server answer), and ICMP echo request and reply.
2. WHEN the user triggers a Protocol_Animation from the Educational_Layer challenge panel, THE Application SHALL display a two-endpoint diagram with labeled packet envelopes moving between the endpoints, one step at a time, with each step labeled with the protocol message name and key field values.
3. WHEN a Protocol_Animation step plays, THE Application SHALL highlight the corresponding real packet row(s) in the Packet_List that match the animated exchange, if such packets are present in the Packet_Buffer.
4. THE Protocol_Animations SHALL provide playback controls (play, pause, step forward, step back, restart) so the user can move through the animation at their own pace.
5. THE Application SHALL respect the operating system's "reduce motion" accessibility preference; WHEN reduced motion is enabled, THE Application SHALL replace animated transitions in Protocol_Animations with instant frame changes while preserving all step labels and highlights.
6. THE Protocol_Animations SHALL be accessible to screen readers, with each animation step announced as a text description of the message being sent, meeting WCAG 2.1 Level AA criteria.

---

### Requirement 30: Visualization Build Order and Phase Priority

**User Story:** As a developer implementing NetVis, I want a formally specified build order for visualization components, so that core functionality ships first and advanced features are built on a stable foundation.

#### Acceptance Criteria

1. THE Application's implementation plan SHALL treat the following components as Phase 1 (core, required for initial release), to be built in dependency order: Packet_List → Packet_Detail_Inspector → field detail tooltips (per Requirement 10) → Protocol_Chart → Packet_Flow_Timeline.
2. THE Application's implementation plan SHALL treat the following components as Phase 2 (advanced, built after all Phase 1 components are complete and stable): OSI_Layer_Diagram → IP_Flow_Map → Bandwidth_Chart → Protocol_Animations.
3. THE Application SHALL NOT expose any Phase 2 visualization component in the production UI until all Phase 1 components satisfy their acceptance criteria as defined in Requirements 5, 6, 22, 23, and 24.
4. WHEN a Phase 2 component is under development, THE Application SHALL render a clearly labeled placeholder in its designated layout area so that the overall layout remains stable and the user understands the feature is forthcoming.
