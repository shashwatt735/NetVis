# Project Structure

## Directory Organization

```
netvis/
├── .kiro/                    # Kiro configuration and specs
│   ├── specs/                # Feature specifications
│   │   └── netvis-core/      # Core feature spec (requirements, design, tasks)
│   └── steering/             # Steering documents (this file)
├── docs/                     # Project documentation
│   ├── ARCHITECTURE.md       # Detailed architecture documentation
│   ├── PROJECT_STATUS.md     # Current progress and status
│   └── CHECKPOINT_*.md       # Phase checkpoint documents
├── src/
│   ├── main/                 # Electron main process
│   │   ├── capture/          # Capture engine (CapSource, PcapFileSource, SimulatedReplay)
│   │   ├── parser/           # Protocol parser (Ethernet → IPv4/IPv6 → TCP/UDP/ICMP/DNS/ARP)
│   │   ├── anonymizer/       # Payload anonymization (HMAC-based)
│   │   ├── packet-buffer/    # Ring buffer (1K-100K packets)
│   │   ├── logger/           # Structured logging (pino)
│   │   ├── settings-store/   # Persistent settings
│   │   ├── index.ts          # Main process entry point
│   │   ├── ipc-handlers.ts   # IPC handler implementations
│   │   └── ipc-schemas.ts    # Zod schemas for IPC validation
│   ├── preload/              # Preload script (contextBridge)
│   │   ├── index.ts          # IPC bridge to renderer
│   │   └── index.d.ts        # Type definitions for window.electronAPI
│   ├── renderer/             # Electron renderer process
│   │   ├── index.html        # HTML entry point
│   │   └── src/
│   │       ├── App.tsx       # React root component
│   │       ├── main.tsx      # React entry point
│   │       ├── assets/       # CSS and static assets
│   │       └── components/   # React components (to be implemented)
│   ├── shared/               # Shared types between main and renderer
│   │   ├── capture-types.ts  # Capture-related types
│   │   └── ipc-types.ts      # IPC contract types
│   └── __tests__/            # Test files
│       └── main/             # Main process tests (property-based and unit)
├── build/                    # Build output (gitignored)
├── out/                      # Compiled output (gitignored)
└── resources/                # Application resources (icons, etc.)
```

## Architecture Patterns

### Process Isolation

- **Main Process:** Privileged operations (capture, parsing, anonymization, buffer)
- **Preload Script:** Security boundary via contextBridge
- **Renderer Process:** React UI with no Node.js access

### Data Flow (Unidirectional)

```
Capture → Parser → Anonymizer → Buffer → IPC → Renderer
```

### Security Invariants

- **ARCH-01:** Explicit IPC contract via contextBridge
- **ARCH-02:** `nodeIntegration: false`, `contextIsolation: true`
- **ARCH-03:** No remote URLs loaded
- **ARCH-04:** Anonymization in main process only
- **ARCH-05:** Unidirectional data flow
- **ARCH-06:** TypeScript strict mode

## File Naming Conventions

- **Components:** PascalCase (e.g., `PacketList.tsx`)
- **Utilities:** kebab-case (e.g., `ipc-handlers.ts`)
- **Types:** kebab-case with suffix (e.g., `capture-types.ts`)
- **Tests:** `*.test.ts` or `*.spec.ts` with descriptors (e.g., `parser-round-trip.property.test.ts`)

## Import Patterns

- Use relative imports within same module
- Use `@renderer` alias for renderer code (configured in Vite)
- Shared types imported from `src/shared/`

## Testing Organization

- Property-based tests: `*.property.test.ts` (use fast-check, 100+ iterations)
- Unit tests: `*.unit.test.ts`
- All tests in `src/__tests__/` mirroring source structure
