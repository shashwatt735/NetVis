# NetVis UI/Visualization Component Inventory

**Generated:** 2026-04-27  
**Purpose:** Accurate inventory of implemented UI surfaces for research paper

---

## Core Visualization Components

### 1. Packet List
**Status:** ✅ Implemented  
**Purpose:** Primary scrollable table displaying captured/loaded packets in real-time  
**Input data:** `packets[]` from Zustand store (AnonPacket[])  
**User interaction:**  
- Click row to select packet → triggers PacketDetailInspector update
- Keyboard navigation (arrow keys, Enter)
- Virtual scrolling for performance (via @tanstack/react-virtual)
- Auto-scroll to bottom during active capture
- Filter dimming (non-matching packets shown at 38% opacity)

**Educational explanation:**  
- Displays: timestamp (relative seconds), protocol badge, role badge, source address, destination address, length
- Empty state: "No packets yet" with instructions
- Filter empty state: "No packets match [expression]"
- WCAG 2.1 AA keyboard navigation and focus management

**File:** `src/renderer/src/components/PacketList.tsx`

---

### 2. Protocol Distribution Chart
**Status:** ✅ Implemented  
**Purpose:** Horizontal bar chart showing protocol breakdown across buffered packets  
**Input data:** `packets[]` aggregated by protocol  
**User interaction:**  
- Click protocol bar → applies filter `proto == [PROTOCOL]`
- Active filter highlighted with protocol color border and dim background
- Hover shows percentage

**Educational explanation:**  
- Shows: protocol name, horizontal progress bar, percentage
- Protocols: TCP, UDP, DNS, ICMP, ARP, OTHER (IPv6 mapped to OTHER in chart)
- Fixed protocol colors (PROTOCOL_COLORS constant)
- Empty state: "no data yet"

**File:** `src/renderer/src/components/ProtocolChart.tsx`

---

### 3. Packet Detail Inspector
**Status:** ✅ Implemented  
**Purpose:** Layered protocol tree panel displaying decoded fields for selected packet  
**Input data:** Selected packet from `packets[]` via `selectedPacketId`  
**User interaction:**  
- Collapsible layer sections (click to expand/collapse)
- Arrow keys to expand/collapse
- Field hover → highlights corresponding byte positions in hex strip
- Back button to deselect packet

**Educational explanation:**  
- Shows packet summary with role classification
- Displays all decoded protocol layers with fields
- Each field shows: label, value, byte offset, byte length
- Priority fields highlighted (based on packet role)
- Hex byte strip at bottom showing anonymized byte positions
- Context-aware states:
  - Welcome state (no packets)
  - Running state (capture active, no selection)
  - Selected packet state (full inspection)
  - Challenge state (active challenge UI)
  - Challenge complete state (completion feedback)
  - Replay complete state (import summary)

**File:** `src/renderer/src/components/PacketDetailInspector.tsx`

---

### 4. Packet Flow Timeline
**Status:** ✅ Implemented  
**Purpose:** Time-series chart displaying packet arrival counts in 1-second buckets over last 36 seconds  
**Input data:** `packets[]` aggregated into time buckets  
**User interaction:**  
- Click bucket → applies time-range filter `ts >= [start] AND ts < [end]`
- Active filter highlighted with border
- Hover shows timestamp and packet count

**Educational explanation:**  
- 36 vertical bars, each representing 1 second
- Bar height = packet count (scaled to max)
- Bar color = dominant protocol in that bucket
- X-axis shows start and end timestamps (HH:MM:SS)
- Empty state: "no data yet"

**File:** `src/renderer/src/components/PacketFlowTimeline.tsx`

---

### 5. OSI Layer Diagram
**Status:** ✅ Implemented (Phase 2)  
**Purpose:** Maps selected packet's decoded protocol headers onto 7-layer OSI model  
**Input data:** Selected packet's `layers[]`  
**User interaction:**  
- Click active layer → re-selects packet (triggers PDI scroll to top)
- Keyboard navigation (Tab between layers, Enter to activate)
- Active layers clickable, inactive layers at 35% opacity

**Educational explanation:**  
- 7 vertical layer boxes (Application → Physical)
- Active layers show protocol badge and color tint
- Inactive layers grayed out
- Shows layer number, name, and active protocol
- Empty state: "Select a packet to see its OSI layers"
- Phase-gated: renders PhasePlaceholder when VITE_PHASE < 2

**File:** `src/renderer/src/components/OSILayerDiagram.tsx`

---

### 6. IP Flow Map
**Status:** ✅ Implemented (Phase 2)  
**Purpose:** Node-link diagram showing communication relationships between IP addresses  
**Input data:** `filteredPackets[]` aggregated into nodes (IPs) and edges (flows)  
**User interaction:**  
- Click node → applies filter `src == [IP] OR dst == [IP]`
- Click edge → applies filter `(src == [IP1] AND dst == [IP2]) OR (src == [IP2] AND dst == [IP1])`
- D3 force simulation animates node positions
- Keyboard navigation on nodes (Tab, Enter/Space)

**Educational explanation:**  
- Nodes = IP addresses (size scaled by packet count)
- Edges = communication flows (width scaled by packet count)
- Node color = dominant protocol
- Shows last octet/segment as label for brevity
- Max 50 nodes displayed for performance
- Accessible table alternative (collapsible details)
- Empty state: "No IP flows yet"
- Phase-gated: renders PhasePlaceholder when VITE_PHASE < 2

**File:** `src/renderer/src/components/IPFlowMap.tsx`

---

### 7. Bandwidth Chart
**Status:** ✅ Implemented (Phase 2)  
**Purpose:** Stacked area chart showing traffic volume in bytes over time by protocol  
**Input data:** `filteredPackets[]` aggregated into 1-second buckets (last 60 seconds)  
**User interaction:**  
- Click chart region → applies time-range filter
- Hover shows tooltip with byte counts per protocol
- Accessible table alternative (collapsible details)

**Educational explanation:**  
- Recharts AreaChart with stacked areas
- Each protocol = colored area (PROTOCOL_COLORS)
- Y-axis: bytes (formatted as B/KB/MB)
- X-axis: timestamps (HH:MM:SS)
- Header shows total bytes
- Empty state: "No bandwidth data yet"
- Phase-gated: renders PhasePlaceholder when VITE_PHASE < 2

**File:** `src/renderer/src/components/BandwidthChart.tsx`

---

### 8. Protocol Animations
**Status:** ✅ Implemented (Phase 2)  
**Purpose:** Step-by-step animated walkthroughs of protocol exchanges  
**Input data:** Predefined animation definitions + optional live packet matching  
**User interaction:**  
- Play/Pause controls
- Previous/Next step buttons
- Restart button
- Step progress indicator (e.g., "2/3")
- Mode toggle: Example vs. My Capture
- "See This In Capture" button → navigates to capture page with filter

**Educational explanation:**  
- 4 animations: OSI Encapsulation, TCP Handshake, DNS Flow, ICMP Ping
- Each step shows: visual canvas, step label, explanation text
- Canvas displays: left entity, right entity, packet in motion
- Direction: left-to-right, right-to-left, or stack (for encapsulation)
- Auto-advances every 1.2 seconds when playing
- Live mode: uses matching packets from current capture when available
- Phase-gated: animations available when VITE_PHASE >= 2

**File:** `src/renderer/src/components/ProtocolAnimations.tsx`

---

## Supporting UI Components

### 9. Filter Bar
**Status:** ✅ Implemented  
**Purpose:** Text input for filter expressions  
**Input data:** User-typed filter expression  
**User interaction:**  
- Type filter expression (e.g., `proto == TCP`)
- Clear button (X icon) when expression present
- Help icon for filter syntax reference
- Error display below input when invalid

**Educational explanation:**  
- Supports Filter_Grammar (BNF defined in requirements)
- Fields: proto, src, dst, port, len, ts
- Operators: ==, !=, >, <, >=, <=
- Logical: AND, OR, NOT
- Inline error messages for invalid syntax
- ARIA invalid state when error present

**File:** `src/renderer/src/components/FilterBar.tsx`

---

### 10. Status Bar
**Status:** ✅ Implemented  
**Purpose:** Bottom bar showing capture status, packet count, data rate, buffer occupancy  
**Input data:** `captureStatus`, `packets[]`, `bufferStats`, `bufferOverflowCount`  
**User interaction:** Read-only display (no interaction)

**Educational explanation:**  
- Left: status dot (color-coded), mode label, source name
- Center: packet count, data rate (KB/s)
- Right: buffer percentage, overflow warning (when active)
- Status colors: green (live), amber (file/replay), red (error), gray (idle)
- Overflow warning shows for 5 seconds after overflow event

**File:** `src/renderer/src/components/StatusBar.tsx`

---

### 11. Capture Controls
**Status:** ✅ Implemented  
**Purpose:** Start/Stop/Replay/Import/Export buttons  
**Input data:** `captureStatus`, `activeInterface`, `interfaces[]`, `packets[]`  
**User interaction:**  
- Start Live: begins live capture on selected interface
- Stop: stops active capture/replay
- Replay: opens file picker, starts simulated replay at selected speed
- Import: opens file picker, loads PCAP into buffer
- Export: opens save dialog, writes buffer to PCAP file
- Speed selector: 0.5×, 1×, 2×, 5× (for replay)

**Educational explanation:**  
- Buttons color-coded by protocol colors
- Disabled states when unavailable (e.g., Start disabled if no interface)
- Pending states show "Starting..." / "Stopping..." / etc.
- Toast notifications for success/error feedback
- Timeout guards prevent permanent spinners (35s for commands, 120s for file pickers)

**File:** `src/renderer/src/components/CaptureControls.tsx`

---

### 12. Welcome Screen
**Status:** ✅ Implemented  
**Purpose:** First-launch onboarding overlay (4-step walkthrough)  
**Input data:** None (static content)  
**User interaction:**  
- Next/Back buttons to navigate steps
- Dismiss button (X) or Escape key to close
- Step progress dots
- Keyboard navigation (Tab trap, focus management)

**Educational explanation:**  
- Step 1: Welcome to NetVis
- Step 2: Start or Import Traffic
- Step 3: Learn as You Inspect
- Step 4: Try Guided Challenges
- Persists completion via `settings:set { welcomeSeen: true }`
- Returns focus to trigger element on close
- WCAG 2.1 AA focus management

**File:** `src/renderer/src/components/WelcomeScreen.tsx`

---

### 13. Challenges Page
**Status:** ✅ Implemented  
**Purpose:** Grid of guided challenge cards  
**Input data:** Challenge definitions from `src/renderer/src/data/challenges.ts`  
**User interaction:**  
- Click "Start Challenge" → activates challenge, applies initial filter, navigates to capture page
- Shows completion status (checkmark badge)
- Shows active challenge (highlighted border)
- Back button to return to previous page

**Educational explanation:**  
- Challenges grouped by difficulty: Beginner, Intermediate
- Each card shows: difficulty badge, protocol badge, title, goal, estimated time, completion status
- 5+ challenges covering: TCP handshake, DNS query/response, ICMP echo, port filtering, packet length comparison
- Challenge state tracked in Zustand store + persisted via Settings_Store

**File:** `src/renderer/src/components/ChallengesPage.tsx`

---

## Layout Components

### 14. App Shell
**Status:** ✅ Implemented  
**Purpose:** Top-level layout container with sidebar navigation  
**File:** `src/renderer/src/components/AppShell.tsx`

### 15. Sidebar Navigation
**Status:** ✅ Implemented  
**Purpose:** Left sidebar with page navigation (Capture, Learn, Challenges, Settings)  
**File:** `src/renderer/src/components/SidebarNav.tsx`

### 16. Toolbar
**Status:** ✅ Implemented  
**Purpose:** Top toolbar with interface selector, capture controls, filter bar, theme toggle  
**File:** `src/renderer/src/components/Toolbar.tsx`

### 17. Capture Page
**Status:** ✅ Implemented  
**Purpose:** Main capture view with packet list, charts, and inspector  
**File:** `src/renderer/src/components/CapturePage.tsx`

### 18. Learn Page
**Status:** ✅ Implemented  
**Purpose:** Educational content page with protocol animations and reference material  
**File:** `src/renderer/src/components/LearnPage.tsx`

### 19. Settings Page
**Status:** ✅ Implemented  
**Purpose:** Application settings (buffer size, theme, etc.)  
**File:** `src/renderer/src/components/SettingsPage.tsx`

---

## Removed/Deprecated Components

None. All planned visualization components are implemented.

---

## Phase Gating

Components marked "Phase 2" render a `PhasePlaceholder` when `VITE_PHASE < 2`:
- OSI Layer Diagram
- IP Flow Map
- Bandwidth Chart
- Protocol Animations (available in Learn page)

Phase is controlled via `VITE_PHASE` environment variable (default: 2).

---

## Accessibility Features

All components implement WCAG 2.1 Level AA compliance:
- Keyboard navigation (Tab, Arrow keys, Enter, Escape)
- Focus indicators (3:1 contrast ratio minimum)
- ARIA roles and labels
- Screen reader support
- Color contrast (4.5:1 for text, 3:1 for UI components)
- Accessible alternatives (data tables for charts)
- Reduce motion support (animations replaced with instant transitions when OS preference enabled)

---

## Protocol Color Consistency

All UI surfaces use the same fixed protocol color mapping (defined in `src/renderer/src/constants/protocol-colors.ts`):

- **TCP:** `#3B82F6` (blue)
- **UDP:** `#10B981` (green)
- **ICMP:** `#F59E0B` (amber)
- **DNS:** `#8B5CF6` (purple)
- **ARP:** `#EF4444` (red)
- **IPv6:** `#06B6D4` (cyan)
- **OTHER:** `#6B7280` (gray)

Colors remain constant across dark/light themes (only backgrounds adapt).

---

## Data Flow Summary

```
Main Process (Privileged)
  ├─ CapSource (live) / PcapFileSource / SimulatedReplaySource
  ├─ Parser → ParsedPacket
  ├─ Packet_Buffer (stores ParsedPacket)
  ├─ Anonymizer → AnonPacket
  └─ IpcBatcher → packet:batch IPC

Renderer Process (Sandboxed)
  ├─ Zustand Store (receives AnonPacket[])
  ├─ Packet List (displays packets)
  ├─ Protocol Chart (aggregates by protocol)
  ├─ Packet Flow Timeline (aggregates by time)
  ├─ Packet Detail Inspector (shows selected packet layers)
  ├─ OSI Layer Diagram (maps layers to OSI model)
  ├─ IP Flow Map (aggregates by IP flows)
  ├─ Bandwidth Chart (aggregates bytes by time + protocol)
  └─ Protocol Animations (educational walkthroughs)
```

---

## Testing Coverage

All visualization components have:
- Unit tests for data transformation logic
- Integration tests for user interactions
- Property-based tests for aggregation correctness (via fast-check)
- Accessibility tests (keyboard navigation, ARIA attributes)

Test files located in `src/__tests__/renderer/`

---

**End of Inventory**
