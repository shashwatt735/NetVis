# NetVis Architecture

**Last updated:** 2026-05-02

This document describes the collaborator-facing architecture for NetVis. The canonical requirements remain in `.kiro/specs/netvis-core/requirements.md`; the canonical technical design remains in `.kiro/specs/netvis-core/design.md`.

## Goals

NetVis is an educational packet visualizer. The architecture prioritizes:

- Security boundaries over convenience.
- Stable live capture on Windows, Linux, and macOS.
- Privacy-safe packet and interface display.
- Testable data flow with explicit ownership.
- Responsive rendering at sustained packet rates.

## Architecture Invariants

| ID      | Invariant                                                                            |
| ------- | ------------------------------------------------------------------------------------ |
| ARCH-01 | The renderer can call only the explicit `contextBridge` API.                         |
| ARCH-02 | Browser windows run with `nodeIntegration: false` and `contextIsolation: true`.      |
| ARCH-03 | The app loads local content only.                                                    |
| ARCH-04 | Anonymization runs in the privileged domain before renderer delivery.                |
| ARCH-05 | Packet data flow is unidirectional.                                                  |
| ARCH-06 | TypeScript strict mode is required.                                                  |
| ARCH-07 | Each request lifecycle has one owner for timeout, listener, cleanup, and completion. |
| ARCH-08 | Each renderer-visible push channel has one authoritative emitter.                    |
| ARCH-09 | `Packet_Buffer` stores `ParsedPacket`; only `AnonPacket` crosses IPC.                |
| ARCH-10 | `packet:batch` is the sole renderer-visible packet push channel.                     |
| ARCH-11 | Live capture, file import, and simulated replay are separate user-initiated modes.   |
| ARCH-12 | File paths and operation targets are validated before PCAP operations.               |
| ARCH-13 | Capture privilege guidance is platform specific and minimized where possible.        |
| ARCH-14 | Main owns live capture; worker owns file/simulated sources; renderer owns UI.        |

## Process Model

```text
Main process
  CaptureEngine
    CapSource for live capture
    WorkerSupervisor for file/simulated worker
    IpcBatcher for packet delivery
  Parser for live packets
  Packet_Buffer
  Anonymizer
  Filter_Engine
  Settings_Store
  Logger
  IPC handlers

Worker thread
  CaptureController for file/simulated modes
  PcapFileSource
  SimulatedReplaySource
  Parser for file/simulated packets

Preload
  contextBridge-only IPC surface

Renderer
  React components
  Zustand store
  Visualizations
  Educational UX
```

## Packet Flow

Live capture:

```text
User selects interface
  -> Renderer invokes capture:start
  -> Main validates IPC payload
  -> CaptureEngine.startCapture(iface)
  -> CapSource opens libpcap/Npcap on the main thread
  -> Parser.parse(raw packet)
  -> Packet_Buffer.push(ParsedPacket)
  -> IpcBatcher anonymizes at send boundary
  -> Main emits packet:batch with AnonPacket[]
  -> Renderer updates Zustand and React views
```

PCAP import and simulated replay:

```text
User selects file or replay mode
  -> Main validates file path
  -> Worker streams packets through PcapFileSource or SimulatedReplaySource
  -> Worker parses RawPacket to ParsedPacket
  -> Main receives ParsedPacket batches
  -> Packet_Buffer stores ParsedPacket
  -> IpcBatcher anonymizes at send boundary
  -> Renderer receives AnonPacket batches
```

## Threading Model

Live capture runs on the main process thread. This is intentional: the `cap` library uses libpcap/Npcap callbacks that are unsafe in Electron worker threads on Windows. Running `CapSource` on the long-lived main process avoids native callback environment crashes.

File import and simulated replay remain in the worker because they use Node streams and controlled replay scheduling. This keeps file I/O and replay timing off the UI path while preserving the same downstream packet pipeline.

## Interface Detection and Selection

Interface enumeration starts with `Cap.deviceList()` because only capture-capable devices can be used for live capture. On Windows, the main process enriches that list with local OS metadata from:

- `Get-NetAdapter`
- `Get-NetIPInterface`
- `Get-NetRoute`
- `Get-NetIPAddress`

The app merges capture devices with Windows adapters by GUID or description when available. It then classifies and scores each interface.

### Interface Metadata

`NetworkInterface` includes the capture name plus optional enrichment:

```typescript
interface NetworkInterface {
  name: string
  displayName: string
  isUp: boolean
  kind?: 'ethernet' | 'wifi' | 'vpn' | 'virtual' | 'loopback' | 'bluetooth' | 'interface'
  semanticLabel?: string
  isDefaultRoute?: boolean
  hasAddress?: boolean
  isCaptureCapable?: boolean
  isRecommended?: boolean
  recommendationScore?: number
  recommendationReason?: string
}
```

### Recommendation Policy

The recommendation is local and privacy-safe:

- Prefer active physical Ethernet or Wi-Fi for beginner captures.
- Treat VPN, TAP/TUN, WireGuard/Wintun, Docker, Hyper-V, VMware, VirtualBox, WSL, loopback, Bluetooth, and similar adapters as specialized.
- Use default-route status as a signal, not an unconditional decision.
- Keep VPN interfaces visible but label them clearly.
- Hide local IP and MAC values in the normal UI.
- Respect the user's persisted default interface when auto-select is disabled.

The scoring helper lives in `src/shared/interface-classification.ts` so main and renderer logic use the same kind labels and recommendation semantics.

## Settings Model

Settings are persisted in `userData/settings.json` by the main-process `Settings_Store`.

```typescript
interface Settings {
  bufferCapacity: number
  theme: 'light' | 'dark' | 'warm-dark' | 'system'
  welcomeSeen: boolean
  completedChallenges: string[]
  reducedMotion: boolean
  preferredInterfaceName: string | null
  autoSelectInterface: boolean
}
```

Interface selection state is intentionally separated:

- `activeInterface`: current renderer selection and capture start target.
- `preferredInterfaceName`: persisted default selected by the user.
- `autoSelectInterface`: whether to use the scored recommendation.
- `captureStatus.iface`: interface used by an active live capture.

Stopping capture does not clear `activeInterface`. This keeps the user's selection stable between capture sessions.

## IPC Contract

Renderer-to-main invoke channels:

| Channel                  | Payload                                    | Returns                                            |
| ------------------------ | ------------------------------------------ | -------------------------------------------------- |
| `capture:getInterfaces`  | none                                       | `InterfaceResult`                                  |
| `capture:start`          | `iface: string`                            | `void`                                             |
| `capture:stop`           | none                                       | `void`                                             |
| `capture:startSimulated` | `{ path: string, speed: SpeedMultiplier }` | `void`                                             |
| `pcap:selectFile`        | none                                       | `{ ok: true; path: string } \| { ok: false }`      |
| `pcap:import`            | none                                       | `ImportResult`                                     |
| `pcap:importFromPath`    | `{ path: string }`                         | `ImportResult`                                     |
| `pcap:startFile`         | `{ path: string }`                         | `void`                                             |
| `pcap:export`            | none                                       | `ExportResult`                                     |
| `buffer:clear`           | none                                       | `void`                                             |
| `buffer:setCapacity`     | `{ capacity: number }`                     | `void`                                             |
| `buffer:getAll`          | none                                       | `AnonPacket[]`                                     |
| `filter:apply`           | `{ expression: string }`                   | `{ packets: AnonPacket[]; error: string \| null }` |
| `settings:get`           | none                                       | `Settings`                                         |
| `settings:set`           | `Partial<Settings>`                        | `Settings`                                         |
| `log:openFolder`         | none                                       | `void`                                             |

Main-to-renderer push channels:

| Channel           | Payload               | Owner                      |
| ----------------- | --------------------- | -------------------------- |
| `packet:batch`    | `AnonPacket[]`        | `IpcBatcher`               |
| `capture:status`  | `CaptureStatus`       | main IPC orchestration     |
| `buffer:overflow` | `{ dropped: number }` | packet buffer event bridge |
| `buffer:stats`    | `BufferStats`         | `BufferStatsThrottler`     |

All invoke payloads are validated in `src/main/ipc-schemas.ts`.

## Security and Privacy

Packet privacy:

- Payload bytes never cross IPC.
- IP and MAC identifiers are pseudonymized for renderer display.
- PCAP export anonymizes sensitive fields before writing.
- Logs contain metadata and errors, not packet payload content.

Interface privacy:

- Local interface data is collected only to choose and label capture devices.
- Raw local IP addresses, MAC addresses, and gateways are not displayed in normal UI.
- Interface details are not transmitted outside the machine.
- The persisted preference is the selected capture device name plus auto-select mode.

## Error Handling

Capture errors are normalized to `CaptureError`:

```typescript
interface CaptureError {
  code: CaptureErrorCode
  message: string
  platformHint?: string
  cause?: Error
}
```

Common codes are `PERMISSION_DENIED`, `INTERFACE_NOT_FOUND`, `INTERFACE_LOST`, `FILE_NOT_FOUND`, `FILE_INVALID_FORMAT`, `LIBRARY_UNAVAILABLE`, `DRAIN_TIMEOUT`, and `UNKNOWN`.

Renderer UI shows plain-language messages and platform hints. Original errors are logged in the privileged domain.

## Performance Model

Targets:

- 1,000 packets per second without UI degradation.
- New packets visible within 200 ms.
- 30 fps renderer responsiveness at target load.
- Memory under 500 MB with a 100,000-packet buffer.

Mechanisms:

- `IpcBatcher` flushes every 50 ms or 100 packets.
- `Packet_Buffer` is a fixed-size ring buffer.
- Packet rows are virtualized.
- Buffer stats are throttled to at most every 500 ms.
- Filter input is debounced and evaluated in the privileged domain.

## Collaborator Checklist

Before changing capture, IPC, interface detection, anonymization, or settings:

1. Confirm the change preserves the architecture invariants above.
2. Update shared types and Zod schemas together.
3. Keep privileged data out of the renderer.
4. Add focused regression tests.
5. Update this document, `docs/PROJECT_STATUS.md`, and the canonical design if the contract changes.
