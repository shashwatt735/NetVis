# NetVis

NetVis is a cross-platform desktop application for learning packet-level networking. It captures live traffic, imports PCAP files, and turns protocol behavior into privacy-safe visualizations, guided challenges, and packet inspection views.

The app is built with Electron, React, TypeScript, Vite, and libpcap/Npcap through the `cap` native module.

## Current Status

NetVis is in a v1.0-ready state with the core capture pipeline, PCAP import/export, parser, anonymization boundary, filter engine, settings persistence, guided challenges, and Phase 2 visualizations implemented.

Current verification snapshot:

- 50 test files: 23 main-process test files and 27 renderer test files, plus renderer support utilities.
- TypeScript strict mode is enabled.
- Main, renderer, and test typechecks pass.
- Focused regression tests cover interface enumeration, settings persistence, IPC validation, renderer selection state, and selector UI behavior.

See [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) for the implementation status and [docs/BUGFIX_REFERENCE.md](docs/BUGFIX_REFERENCE.md) for consolidated fix history.

## Key Features

- Live packet capture through libpcap/Npcap.
- PCAP import, PCAP export, and simulated replay with speed control.
- Protocol parsing for Ethernet, IPv4, IPv6, TCP, UDP, ICMP, DNS, and ARP.
- Main-process anonymization before packet data crosses IPC.
- Configurable ring buffer from 1,000 to 100,000 packets.
- Filter grammar for protocol, endpoint, port, length, and timestamp queries.
- Virtualized packet list, packet detail inspector, timeline, protocol chart, bandwidth chart, IP flow map, OSI layer diagram, and protocol animations.
- Guided challenges and persisted completion state.
- Local interface detection with semantic labels, VPN/virtual classification, and a persisted default-interface preference.
- Privacy-safe interface display: local addresses are used for scoring when available but hidden in normal UI.

## Documentation Map

| Document                                             | Purpose                                                                                 |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)         | Process model, data flow, IPC, security boundaries, threading, and interface detection. |
| [docs/PROJECT_DESIGN.md](docs/PROJECT_DESIGN.md)     | Product and system design overview for collaborators.                                   |
| [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)     | Current implementation status, verification, and document authority.                    |
| [docs/BUGFIX_REFERENCE.md](docs/BUGFIX_REFERENCE.md) | Consolidated bugfix and hardening history.                                              |
| [docs/UI_REFERENCE.md](docs/UI_REFERENCE.md)         | Consolidated UI, visualization, and responsive-layout reference.                        |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)   | Live capture, interface, import, and visualization troubleshooting.                     |
| [docs/CODE_INDEX.md](docs/CODE_INDEX.md)             | Module inventory and test index.                                                        |

## Installation for Users

Packaged NetVis users do not need Node.js, npm, Python, Visual Studio Build Tools, or Windows SDK.

Npcap is required only for live packet capture on Windows. PCAP import, replay, learning pages, and visualizations work without Npcap.

## Core Development Setup

Core development includes the renderer UI, parser, PCAP import, replay, learning pages, visualizations, and tests that do not require native live capture.

Required:

- Node.js version from `.nvmrc` (22.x recommended)
- npm 10 or 11

```bash
nvm use
npm install
npm run dev
```

Run core verification:

```bash
npm run verify:core
```

## Live Capture Development

Live capture uses the optional `cap` native module. Core development works without it — the app gracefully disables live capture when `cap` is unavailable.

### Windows live-capture requirements

- Python 3.11 or 3.12
- Visual Studio Build Tools 2019 or 2022 with:
  - Desktop development with C++
  - MSVC v142 or v143 x64/x86 build tools
  - Windows 10 or Windows 11 SDK
- [Npcap](https://npcap.com/) with WinPcap API-compatible mode enabled

### Linux live-capture requirements

- `libpcap-dev` (`sudo apt-get install libpcap-dev`)
- Capture capabilities: `sudo setcap cap_net_raw,cap_net_admin=eip /path/to/netvis`

### macOS live-capture requirements

- macOS includes libpcap. Depending on the environment, live capture may require starting the app from a privileged terminal or granting additional privacy permissions.

### Setting up live capture

After installing the platform prerequisites above:

```bash
npm run setup:native
```

Check your environment:

```bash
npm run doctor
npm run verify:native
```

## Development Commands

```bash
npm run dev              # Run in development mode
npm run verify:core      # Typecheck + tests
npm run verify:build     # Typecheck + production build
npm run lint             # Lint
npm run doctor           # Environment health check
npm run setup:native     # Full live capture setup (install + rebuild + verify)
npm run rebuild:native   # Rebuild native addons for Electron
npm run verify:native    # Verify native addons are ready for packaging
```

## Build

```bash
npm run build            # Production build
npm run build:win        # Package for Windows
npm run build:win:native # Verify native + package for Windows
npm run build:mac        # Package for macOS
npm run build:linux      # Package for Linux
```

## Architecture Summary

NetVis keeps privileged packet work outside the renderer:

```text
Live capture or file source
  -> Parser
  -> Packet_Buffer stores ParsedPacket
  -> Anonymizer at IPC boundary
  -> packet:batch sends AnonPacket[]
  -> Renderer visualizes anonymized data
```

Thread ownership:

- Main process: live capture, packet buffer, anonymization, settings store, logger, IPC handlers, and renderer delivery.
- Worker thread: PCAP file import, simulated replay, and file/simulated parsing.
- Renderer: React UI, Zustand state, visualizations, and educational interaction.

Live capture runs on the main process thread because the `cap`/Npcap callback path is not safe inside Electron worker threads on Windows.

## Interface Selection

NetVis detects interfaces locally and recommends a beginner-friendly capture adapter. The app scores available capture devices using adapter kind, status, addresses, and Windows default-route metadata when available.

The default behavior is:

- Prefer physical Ethernet or Wi-Fi for normal beginner captures.
- Detect VPN/TAP/TUN, virtual, loopback, container, and Bluetooth adapters as specialized.
- Show semantic labels such as `Ethernet`, `Wi-Fi`, `VPN`, `Virtual`, and `Loopback`.
- Hide local addresses in normal UI.
- Let users override the recommendation and persist a default capture interface.

This detection is local to the machine. NetVis does not transmit interface identifiers, IP addresses, MAC addresses, or gateway details.

## Security and Privacy

- The renderer has no direct Node.js access.
- All renderer-to-main IPC payloads are validated with Zod.
- Packet payloads and endpoint identifiers are anonymized before crossing IPC.
- The packet buffer stores privileged `ParsedPacket` objects; the renderer receives only `AnonPacket` objects.
- Raw local interface addresses are not displayed by default.
- Logs avoid packet payload content.

## Troubleshooting

If live capture is not working:

```bash
npm run doctor
```

This reports the state of your Node.js, npm, Python, Visual Studio Build Tools, Windows SDK, Npcap, and whether the `cap` module loaded successfully.

For detailed troubleshooting steps, see [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## Contributing

Before changing behavior, read:

1. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
2. [docs/PROJECT_DESIGN.md](docs/PROJECT_DESIGN.md)
3. [docs/CODE_INDEX.md](docs/CODE_INDEX.md)

Keep changes aligned with the architecture invariants, add or update focused tests for behavioral changes, and run typecheck plus the relevant test slice before handing off.

## License

To be determined.
