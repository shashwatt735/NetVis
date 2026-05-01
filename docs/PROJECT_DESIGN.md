# NetVis Project Design

**Last updated:** 2026-05-02

This document summarizes the product and system design for collaborators. It is intentionally shorter than the canonical design in `.kiro/specs/netvis-core/design.md`.

## Product Shape

NetVis helps beginner networking students understand packets by combining:

- Live capture for real traffic.
- PCAP import and simulated replay for repeatable examples.
- Protocol parsing and plain-language field explanations.
- Visualizations that connect packet rows to protocol behavior.
- Guided challenges that turn passive inspection into practice.

NetVis is not intended to replace professional forensic tools such as Wireshark. It prioritizes learning clarity, privacy, and safe defaults.

## User Experience Principles

- Recommend a working capture interface, but let the user override it.
- Use semantic labels for interfaces and packet roles without hiding the real adapter names users need to recognize.
- Hide local addresses and raw identifiers in normal UI.
- Keep live capture, file import, and simulated replay as explicit modes.
- Keep educational views close to the packet data they explain.
- Prefer dense, readable operational UI over marketing-style layout.

## Capture Modes

| Mode             | Source                              | Thread       | Notes                                                        |
| ---------------- | ----------------------------------- | ------------ | ------------------------------------------------------------ |
| Live capture     | `cap` / libpcap / Npcap             | Main process | Required for Windows native callback stability.              |
| PCAP import      | `pcap-parser`                       | Worker       | Streams files without loading the whole capture into memory. |
| Simulated replay | `pcap-parser` plus timing scheduler | Worker       | Replays packet timing with 0.5x, 1x, 2x, or 5x speed.        |

All modes converge into the same parser, buffer, anonymization, IPC, and visualization model.

## Interface Selection Design

The app should auto-detect the best currently active capture interface on the local device, but not silently lock the user into that choice.

The model is:

```text
Capture device list
  + local OS adapter metadata when available
  + semantic classification
  + scoring
  + user preference
  -> selected capture interface
```

Classification labels:

- Ethernet
- Wi-Fi
- VPN
- Virtual
- Loopback
- Bluetooth
- Interface

Recommended defaults:

- Prefer active physical Ethernet or Wi-Fi.
- Consider OS default-route status.
- Penalize VPN, TAP/TUN, virtual/container, loopback, and Bluetooth adapters.
- Show VPN adapters as available but specialized.
- Persist manual user selection through `preferredInterfaceName` and `autoSelectInterface`.

Interface cards and dropdown rows should show:

- Semantic label.
- Adapter display name.
- Badges such as `Recommended`, `Primary route`, `Specialized`, `Local only`, `No address`, and `Local address hidden`.

## Privacy Model

NetVis can use local interface metadata internally for scoring, but normal UI should avoid exposing raw local network details.

| Data                 | Internal use          | Normal display | Persistence                          |
| -------------------- | --------------------- | -------------- | ------------------------------------ |
| Adapter display name | Yes                   | Yes            | Optional via selected interface name |
| Adapter kind         | Yes                   | Yes            | No issue                             |
| Up/down status       | Yes                   | Yes            | No issue                             |
| Default-route flag   | Yes                   | Badge only     | No issue                             |
| Local IP address     | Yes for scoring       | No             | No                                   |
| MAC address          | Avoid unless required | No             | No                                   |
| Gateway IP           | Optional              | No             | No                                   |
| Raw device GUID      | Yes for matching      | No             | Only capture name if selected        |

## State Model

Renderer state separates interface concerns:

- `activeInterface`: the currently selected capture target.
- `preferredInterfaceName`: the persisted user default.
- `autoSelectInterface`: whether the app should keep choosing the recommended interface.
- `captureStatus.iface`: the interface used by an active live capture.

This avoids the unstable behavior caused by using one field for selected, active, and preferred interface meanings.

## Core Components

### Main Process

- `CaptureEngine`: capture orchestration and live capture lifecycle.
- `CapSource`: live capture on the main thread.
- `Packet_Buffer`: privileged `ParsedPacket` storage.
- `Anonymizer`: converts `ParsedPacket` to `AnonPacket` at IPC send time.
- `Filter_Engine`: parses and evaluates filter expressions.
- `Settings_Store`: persists user settings and challenge completion.
- `Logger`: structured diagnostics.
- `ipc-handlers.ts`: validated renderer-to-main API.

### Worker Thread

- `CaptureController`: file/simulated source lifecycle.
- `PcapFileSource`: streaming PCAP import.
- `SimulatedReplaySource`: timed replay.
- `Parser`: file/simulated packet parsing.

### Renderer

- Zustand store for UI state.
- `InterfaceSelector` for enumeration, recommendation display, and manual selection.
- `SettingsPage` for persistent default interface and app preferences.
- Packet list, detail inspector, filter bar, status bar, and visualizations.

## Visualization Suite

| Component               | Purpose                                        |
| ----------------------- | ---------------------------------------------- |
| `PacketList`            | High-density packet table with virtualization. |
| `PacketDetailInspector` | Layered packet fields and explanations.        |
| `ProtocolChart`         | Protocol distribution.                         |
| `PacketFlowTimeline`    | Time-bucketed packet activity.                 |
| `BandwidthChart`        | Protocol-stacked byte volume.                  |
| `IPFlowMap`             | Endpoint graph and filter generation.          |
| `OSILayerDiagram`       | Protocol-to-layer teaching view.               |
| `ProtocolAnimations`    | Step-through TCP, DNS, and ICMP flows.         |

## Settings

Settings are persisted by the main process:

```typescript
type Settings = {
  bufferCapacity: number
  theme: 'light' | 'dark' | 'warm-dark' | 'system'
  welcomeSeen: boolean
  completedChallenges: string[]
  reducedMotion: boolean
  preferredInterfaceName: string | null
  autoSelectInterface: boolean
}
```

Settings UI must update local Zustand state and persist through `settings:set`.

## Security Boundaries

- Renderer has no Node.js access.
- IPC payloads are schema-validated.
- Packet buffer stores privileged `ParsedPacket`.
- Renderer receives anonymized `AnonPacket`.
- File paths are validated before PCAP operations.
- Capture modes do not silently fall back to each other.

## Testing Strategy

Behavioral changes should include focused tests in the matching area:

- Main process: capture enumeration, settings store, IPC schemas, parser, packet buffer, anonymizer.
- Renderer: Zustand state, selector behavior, settings UI, visualization derivation.
- Property tests: protocol invariants, filter behavior, graph/timeline construction, and sanitization.

Run at least:

```bash
npm run typecheck
npx vitest --run <focused-test-files>
```

## Document Authority

- Requirements and canonical design live under `.kiro/specs/netvis-core/`.
- This file is the collaborator overview.
- `docs/ARCHITECTURE.md` is the operational architecture reference.
- `docs/PROJECT_STATUS.md` is the current implementation status.
- `tasks.md` is a historical task breakdown and should not be edited for routine documentation reconciliation.
