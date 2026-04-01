# NetVis - Educational Network Packet Visualizer

A cross-platform desktop application for educational network packet visualization, built with Electron, React, and TypeScript. NetVis enables beginner networking students to capture live network packets, load saved PCAP files, and explore protocol behavior through real-time visualizations and guided challenges.

## 🎯 Project Status

**Current Phase:** Phase 1 - Core Pipeline Integration  
**Status:** ✅ Tasks 1-11 Complete, Checkpoint Passed  
**Test Coverage:** 86/86 tests passing  
**Code Quality:** ESLint clean, TypeScript strict mode

See [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) for detailed progress.

## 🏗️ Architecture

NetVis follows a strict security-first architecture with process isolation:

- **Main Process:** Capture Engine, Parser, Anonymizer, Packet Buffer
- **Renderer Process:** React UI with Zustand state management
- **IPC Bridge:** Explicit contract via contextBridge with zod validation

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

## ✨ Features

### Implemented (Phase 1)

- ✅ Live packet capture (libpcap/Npcap)
- ✅ PCAP file import/export
- ✅ Simulated replay with speed control (0.5×, 1×, 2×, 5×)
- ✅ Protocol parsing (Ethernet, IPv4/IPv6, TCP/UDP/ICMP/DNS/ARP)
- ✅ Payload anonymization (HMAC-based pseudonymization)
- ✅ Ring buffer with configurable capacity (1K-100K packets)
- ✅ Structured logging with rotation
- ✅ Persistent settings store
- ✅ Full IPC bridge with input validation

### Planned (Phase 1 Remaining)

- 🔄 Zustand store and renderer bootstrap
- 🔄 MUI theme and visual design system
- 🔄 Packet list with virtualization
- 🔄 Protocol chart and timeline visualizations
- 🔄 Packet detail inspector
- 🔄 Filter engine with BNF grammar
- 🔄 Educational layer with field explanations
- 🔄 Guided challenges
- 🔄 Onboarding experience

### Planned (Phase 2)

- 📋 OSI layer diagram
- 📋 IP flow map (D3-based)
- 📋 Bandwidth chart
- 📋 Protocol animations

## 🚀 Quick Start

### Prerequisites

- **Node.js:** 18.x or higher
- **npm:** 9.x or higher
- **Platform-specific:**
  - **Windows:** [Npcap](https://npcap.com/) (for live capture)
  - **Linux:** libpcap + capabilities (`setcap cap_net_raw,cap_net_admin=eip`)
  - **macOS:** libpcap (built-in) + sudo or System Preferences permissions

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd netvis

# Install dependencies
npm install
```

### Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Run linter
npm run lint

# Format code
npm run format
```

### Build

```bash
# For Windows
npm run build:win

# For macOS
npm run build:mac

# For Linux
npm run build:linux
```

## 🧪 Testing

NetVis uses property-based testing with fast-check to validate correctness properties:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Coverage

- **9 test files, 86 tests**
- **Property-based tests:** P2, P3, P4, P5, P6, P16, P17 (100+ iterations each)
- **Unit tests:** Boundary conditions, persistence, validation

## 📚 Documentation

- [Project Status](docs/PROJECT_STATUS.md) - Current progress and completed tasks
- [Architecture](docs/ARCHITECTURE.md) - Detailed architecture documentation
- [Requirements](.kiro/specs/netvis-core/requirements.md) - Functional requirements
- [Design](.kiro/specs/netvis-core/design.md) - Technical design document
- [Tasks](.kiro/specs/netvis-core/tasks.md) - Implementation task list

## 🛠️ Technology Stack

### Core

- **Electron:** 34.x - Cross-platform desktop framework
- **React:** 18.x - UI framework
- **TypeScript:** 5.x - Type-safe development (strict mode)
- **Vite:** 6.x - Build tool and dev server

### Main Process

- **cap:** Live packet capture (libpcap/Npcap wrapper)
- **pcap-parser:** PCAP file streaming
- **pino:** Structured JSON logging
- **pino-roll:** Log rotation
- **zod:** Schema validation

### Testing

- **Vitest:** Test runner
- **fast-check:** Property-based testing

### Code Quality

- **ESLint:** Linting with TypeScript support
- **Prettier:** Code formatting

## 🔒 Security

NetVis follows strict security principles:

- **ARCH-01:** Explicit IPC contract via contextBridge
- **ARCH-02:** `nodeIntegration: false`, `contextIsolation: true`
- **ARCH-03:** No remote URLs loaded
- **ARCH-04:** Anonymization in main process only
- **ARCH-05:** Unidirectional data flow
- **ARCH-06:** TypeScript strict mode

All IPC payloads are validated with zod schemas before processing.

## 🤝 Contributing

This project follows spec-driven development:

1. **Requirements** define what to build
2. **Design** defines how to build it
3. **Tasks** break down implementation
4. **Property-based tests** validate correctness

All contributions must:

- Pass all existing tests
- Add tests for new functionality
- Pass ESLint and Prettier checks
- Maintain TypeScript strict mode compliance
- Follow security architecture invariants

## 📝 License

[To be determined]

## 🙏 Acknowledgments

- [Electron](https://www.electronjs.org/) - Cross-platform desktop framework
- [libpcap](https://www.tcpdump.org/) - Packet capture library
- [Npcap](https://npcap.com/) - Windows packet capture driver
- [fast-check](https://github.com/dubzzz/fast-check) - Property-based testing

## 📧 Contact

[To be determined]

---

**Built with ❤️ for networking education**
