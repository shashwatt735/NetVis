# NetVis Project Status

**Last updated:** 2026-05-02

## Summary

NetVis is v1.0-ready from an implementation standpoint. Core capture, file import/export, simulated replay, parsing, anonymization, filtering, visualization, onboarding, settings, and guided challenge flows are implemented.

The latest documentation reconciliation also incorporated the interface-selection hardening work:

- Capture interfaces are classified as Ethernet, Wi-Fi, VPN, virtual, loopback, Bluetooth, or generic interface.
- Windows interface metadata is used locally when available to identify status, address presence, and the default route.
- VPN/TAP/TUN and virtual adapters are labeled as specialized and are not treated as beginner-friendly defaults by simple alphabetical ordering.
- Users can persist a default capture interface or keep auto-detection enabled.
- Stopping capture no longer clears the selected interface.

## Current Verification Snapshot

- `npm run typecheck:node`: passing.
- `npm run typecheck:web`: passing.
- `npm run typecheck:tests`: passing.
- Focused main regression tests: passing.
- Focused renderer interface/store regression tests: passing.
- Test inventory: 50 `*.test.*` files, with 23 main-process test files and 27 renderer test files, plus renderer support utilities.

## Completed Areas

### Capture and Packet Pipeline

- Live capture through `cap` on the main process thread.
- PCAP import and simulated replay in the worker thread.
- Parser support for Ethernet, IPv4, IPv6, TCP, UDP, ICMP, DNS, and ARP.
- Link-type normalization for `cap.open()` return values.
- Packet buffer ring storage from 1,000 to 100,000 packets.
- IPC batching at 50 ms or 100 packets.
- Export path using anonymized packet bytes.

### Security and Privacy

- Renderer isolation through `contextBridge`.
- Zod validation for renderer-to-main IPC payloads.
- Main-process anonymization before renderer delivery.
- No packet payload content in logs.
- Local interface metadata used for scoring without normal UI exposure of raw local addresses.

### Interface Selection

- `capture:getInterfaces` returns enriched `NetworkInterface` metadata when available.
- Shared classification and scoring live in `src/shared/interface-classification.ts`.
- `InterfaceSelector` shows semantic labels and recommendation badges.
- `SettingsPage` includes a real default capture interface control.
- Settings include `preferredInterfaceName` and `autoSelectInterface`.

### Renderer Experience

- Zustand store and renderer bootstrap.
- Capture controls, toolbar, status bar, filter bar, and settings page.
- Virtualized packet list and detail inspector.
- Protocol chart, packet timeline, bandwidth chart, IP flow map, OSI layer diagram, and protocol animations.
- Welcome screen and guided challenges.
- Theme support for light, dark, warm-dark, and system.

### Hardening and Fixes

The detailed fix history is consolidated in [BUGFIX_REFERENCE.md](BUGFIX_REFERENCE.md). Major categories include:

- Windows live-capture crash prevention.
- Worker command/ack lifecycle fixes.
- Parser bounds validation.
- PCAP import batching and timeout handling.
- Renderer stale-state and filtering fixes.
- Protocol color and theme consistency.
- Interface recommendation and persistence fixes.

## Current Known Considerations

- Live capture still depends on platform privileges and Npcap/libpcap availability.
- VPN adapters may legitimately carry routed traffic, but NetVis treats them as specialized educational capture targets unless the user chooses them.
- The app does not transmit interface metadata; all detection is local.
- Very large captures are bounded by the configured in-memory ring buffer.

## Development Commands

```bash
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

Focused verification examples:

```bash
npx vitest --run src/__tests__/main/capture-interface-enumeration.test.ts
npx vitest --run src/__tests__/main/settings-store.unit.test.ts
npx vitest --run --pool=threads --maxWorkers=1 src/__tests__/renderer/interface-selector-enumeration.test.tsx
```

## Document Authority

| Document                                  | Role                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| `.kiro/specs/netvis-core/requirements.md` | Canonical requirements.                                                                     |
| `.kiro/specs/netvis-core/design.md`       | Canonical technical design.                                                                 |
| `.kiro/specs/netvis-core/tasks.md`        | Historical task breakdown; not updated during this reconciliation.                          |
| `docs/ARCHITECTURE.md`                    | Collaborator architecture reference.                                                        |
| `docs/PROJECT_DESIGN.md`                  | Product and system design overview.                                                         |
| `docs/PROJECT_STATUS.md`                  | Current implementation status.                                                              |
| `docs/BUGFIX_REFERENCE.md`                | Consolidated bugfix and hardening record.                                                   |
| `docs/UI_REFERENCE.md`                    | Consolidated UI and visualization reference.                                                |
| `docs/TROUBLESHOOTING.md`                 | Operational troubleshooting for live capture, interfaces, import, and visualization issues. |
| `docs/CODE_INDEX.md`                      | Module and test index.                                                                      |
