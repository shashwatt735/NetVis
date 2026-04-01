# Technology Stack

## Core Framework

- **Electron 34.x** - Cross-platform desktop framework
- **React 18.x** - UI framework
- **TypeScript 5.x** - Type-safe development with strict mode enabled
- **Vite 6.x** - Build tool and dev server

## Main Process Libraries

- **cap** - Live packet capture (libpcap/Npcap wrapper)
- **pcap-parser** - PCAP file streaming
- **pino** - Structured JSON logging
- **pino-roll** - Log rotation (10MB, retain 2 files)
- **zod** - Schema validation for IPC payloads

## Testing

- **Vitest** - Test runner (86 tests, 100% passing)
- **fast-check** - Property-based testing (100+ iterations per property)

## Code Quality

- **ESLint** - Linting with TypeScript support
- **Prettier** - Code formatting
- **TypeScript strict mode** - Enforced across all source files

## Build System

- **electron-vite** - Electron-specific Vite configuration
- **electron-builder** - Application packaging for Windows/macOS/Linux

## Common Commands

```bash
# Development
npm run dev              # Start development server
npm test                 # Run all tests once
npm run test:watch       # Run tests in watch mode
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
npm run typecheck        # Type-check all TypeScript files

# Building
npm run build            # Development build
npm run build:staging    # Staging build
npm run build:prod       # Production build
npm run build:win        # Package for Windows
npm run build:mac        # Package for macOS
npm run build:linux      # Package for Linux
```

## Environment Variables

- **VITE_PHASE** - Feature phase flag (default: 1)
- ****DEV_OVERLAY**** - Development overlay flag (auto-set based on mode)

## Platform Requirements

- **Windows:** Npcap installation required for live capture
- **Linux:** libpcap + capabilities (`setcap cap_net_raw,cap_net_admin=eip`)
- **macOS:** libpcap (built-in) + sudo or System Preferences permissions
