# NetVis - Educational Network Packet Visualizer

A cross-platform desktop application for educational network packet visualization, built with Electron, React, and TypeScript. NetVis enables beginner networking students to capture live network packets, load saved PCAP files, and explore protocol behavior through real-time visualizations and guided challenges.

# NetVis - Educational Network Packet Visualizer

A cross-platform desktop application for educational network packet visualization, built with Electron, React, and TypeScript. NetVis enables beginner networking students to capture live network packets, load saved PCAP files, and explore protocol behavior through real-time visualizations and guided challenges.

## 🎯 Project Status

**Current Phase:** All phases complete (Phase 1 + Phase 2)
**Status:** Fully implemented and stabilized
**Test Coverage:** 332 tests passing (28 test files)
**Code Quality:** TypeScript strict mode; typecheck, tests, and build passing; lint cleanup complete

See [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) for detailed progress.

## 🏗️ Architecture

NetVis follows a strict security-first architecture with process isolation:

- **Main Process:** Capture Engine, Parser, Anonymizer, Packet Buffer
- **Renderer Process:** React UI with Zustand state management
- **IPC Bridge:** Explicit contract via contextBridge with zod validation

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

## ✨ Features

### Implemented (All Phases Complete)

- ✅ Live packet capture (libpcap/Npcap)
- ✅ PCAP file import/export
- ✅ Simulated replay with speed control (0.5×, 1×, 2×, 5×)
- ✅ Protocol parsing (Ethernet, IPv4/IPv6, TCP/UDP/ICMP/DNS/ARP)
- ✅ Payload anonymization (HMAC-based pseudonymization)
- ✅ Ring buffer with configurable capacity (1K-100K packets)
- ✅ Structured logging with rotation
- ✅ Persistent settings store
- ✅ Full IPC bridge with input validation
- ✅ Zustand store and renderer bootstrap
- ✅ Tailwind CSS and Visual Design System
- ✅ Packet list with virtualization
- ✅ Protocol chart and timeline visualizations
- ✅ Packet detail inspector
- ✅ Filter engine with BNF grammar
- ✅ Educational layer with field explanations
- ✅ AppShell layout, Toolbar, StatusBar
- ✅ Onboarding — WelcomeScreen
- ✅ Advanced Settings Panel
- ✅ Guided challenges
- ✅ Privilege minimization setup
- ✅ OSI layer diagram
- ✅ IP flow map (D3-based)
- ✅ Bandwidth chart
- ✅ Protocol animations
- ✅ Error boundary and crash handling
- ✅ Fast Refresh compatibility
- ✅ Comprehensive bugfixes and hardening

### Future Enhancements

- 📋 Additional protocol support
- 📋 Advanced filtering options
- 📋 Export formats expansion
- 📋 Performance optimizations

## 🚀 Quick Start

### Prerequisites

- **Node.js:** 22.x or higher (tested on 24.x)
- **npm:** 9.x or higher

#### Platform-Specific Requirements for Live Capture

NetVis requires elevated privileges to capture network packets. Each platform has different requirements:

##### Windows

1. **Install Npcap:**
   - Download and install [Npcap](https://npcap.com/) (WinPcap successor)
   - During installation, select "Install Npcap in WinPcap API-compatible Mode"

2. **User Group Membership:**
   - NetVis requires membership in the "Npcap Users" group
   - To add your user to this group:
     1. Open Computer Management (Win+X → Computer Management)
     2. Navigate to Local Users and Groups → Groups
     3. Double-click "Npcap Users"
     4. Click "Add" and add your username
     5. Log out and log back in for changes to take effect

3. **Alternative: Run as Administrator:**
   - Right-click NetVis and select "Run as Administrator"
   - This is less secure than using the Npcap Users group

**If you see a permission error:** Verify Npcap is installed and you're in the Npcap Users group, or run as Administrator.

##### Linux

1. **Install libpcap:**

   ```bash
   # Debian/Ubuntu
   sudo apt-get install libpcap-dev

   # Fedora/RHEL
   sudo dnf install libpcap-devel

   # Arch
   sudo pacman -S libpcap
   ```

2. **Grant Capabilities (Recommended):**
   Instead of running as root, grant specific capabilities to the NetVis binary:

   ```bash
   sudo setcap cap_net_raw,cap_net_admin=eip /path/to/netvis
   ```

   Replace `/path/to/netvis` with the actual path to your NetVis executable.

   **Example for AppImage:**

   ```bash
   sudo setcap cap_net_raw,cap_net_admin=eip ./NetVis-*.AppImage
   ```

3. **Alternative: Run with sudo:**
   ```bash
   sudo ./netvis
   ```
   This is less secure than using capabilities.

**If you see a permission error:** Run the `setcap` command above or use `sudo`.

##### macOS

1. **libpcap (Built-in):**
   - macOS includes libpcap by default, no installation needed

2. **Grant Permissions:**

   **Option 1: Run with sudo (Quick but less secure):**

   ```bash
   sudo /Applications/NetVis.app/Contents/MacOS/NetVis
   ```

   **Option 2: Grant Full Disk Access (Recommended):**
   1. Open System Preferences → Security & Privacy → Privacy
   2. Select "Full Disk Access" from the left sidebar
   3. Click the lock icon and authenticate
   4. Click "+" and add NetVis or your terminal application
   5. Restart NetVis

   **Option 3: BPF Device Permissions:**

   ```bash
   sudo chmod o+r /dev/bpf*
   ```

   Note: This must be repeated after each reboot.

**If you see a permission error:** Use one of the options above. Full Disk Access is the most user-friendly for regular use.

**Note:** A privileged helper using SMJobBless is planned for a future release to provide a more seamless macOS experience.

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

- **28 test files, 332 tests passing**
- **Property-based tests:** Parser round-trip, anonymizer determinism, buffer invariants, filter engine, simulated replay, protocol distribution, timeline buckets, and more (100+ iterations each)
- **Unit tests:** Boundary conditions, persistence, validation, IPC handlers, bugfix verification, store actions

## 📚 Documentation

- [Project Status](docs/PROJECT_STATUS.md) - Current progress and completed tasks
- [Architecture](docs/ARCHITECTURE.md) - Detailed architecture documentation
- [Requirements](.kiro/specs/netvis-core/requirements.md) - Functional requirements
- [Design](.kiro/specs/netvis-core/design.md) - Technical design document
- [Tasks](.kiro/specs/netvis-core/tasks.md) - Implementation task list

## 🛠️ Technology Stack

### Core

- **Electron:** 40.x - Cross-platform desktop framework
- **React:** 19.x - UI framework
- **TypeScript:** 5.x - Type-safe development (strict mode)
- **Vite:** 7.x - Build tool and dev server

### Main Process

- **cap:** Live packet capture (libpcap/Npcap wrapper)
- **pcap-parser:** PCAP file streaming
- **pino:** Structured JSON logging
- **pino-roll:** Log rotation
- **zod:** Schema validation

### Testing

- **Vitest:** Test runner
- **fast-check:** Property-based testing
- **jsdom:** DOM environment for renderer tests
- **@testing-library/react:** React component testing utilities

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
