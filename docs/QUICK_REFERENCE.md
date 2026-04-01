# NetVis Quick Reference

**Quick lookup for developers and students**

---

## The Pipeline (One Line)

```
Network → Capture → Parse → Anonymize → IPC → UI
```

---

## Data Transformations

### 1. RawPacket (from Capture)
```typescript
{
  timestamp: 1234567890,
  sourceId: "WiFi",
  captureMode: "live",
  data: Uint8Array[154],  // Raw bytes
  length: 154,
  linkType: 1             // Ethernet
}
```

### 2. ParsedPacket (from Parser)
```typescript
{
  id: "uuid-1234",
  timestamp: 1234567890,
  layers: [
    { protocol: "Ethernet", fields: [...] },
    { protocol: "IPv4", fields: [...] },
    { protocol: "TCP", fields: [...] }
  ],
  rawData: Uint8Array[154]  // Still has raw bytes
}
```

### 3. AnonPacket (from Anonymizer)
```typescript
{
  id: "uuid-1234",
  timestamp: 1234567890,
  layers: [
    { protocol: "Ethernet", fields: [...] },
    { protocol: "IPv4", fields: [...] },
    { protocol: "TCP", fields: [
      ...
      { name: "payload", value: "a3f5c8d9" }  // Pseudonym!
    ]}
  ],
  srcAddress: "192.168.1.100",
  dstAddress: "192.168.1.101",
  protocol: "TCP",
  length: 154
  // NO rawData!
}
```

---

## Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| CapSource | `src/main/capture/cap-source.ts` | Live capture via libpcap/Npcap |
| Parser | `src/main/parser/index.ts` | Decode bytes into protocols |
| Anonymizer | `src/main/anonymizer/index.ts` | Replace payload with pseudonym |
| IpcBatcher | `src/main/capture/ipc-batcher.ts` | Group packets for efficient IPC |
| Preload | `src/preload/index.ts` | IPC security bridge |

---

## Anonymization Formula

```
SESSION_KEY = randomBytes(32)  // Generated once at startup

pseudonym(payload) = SHA-256(SESSION_KEY || payload).slice(0, 8)
```

**Example:**
```
Payload: "Hello, secret data!"
Session Key: [32 random bytes]
Pseudonym: "a3f5c8d9"
```

---

## What's Kept vs. Removed

### ✅ Kept (Safe Metadata)
- IP addresses
- Port numbers
- Protocol types
- Timestamps
- Packet lengths
- Header fields (flags, sequence numbers, etc.)

### ❌ Removed (Sensitive Data)
- Payload content (replaced with pseudonym)
- Raw bytes (never sent to UI)
- Application-layer data

---

## Security Boundaries

```
┌──────────────────────────────────────┐
│   Main Process (Privileged)          │
│   - Network access                   │
│   - File system access               │
│   - Capture, Parse, Anonymize        │
└──────────────────────────────────────┘
              ↓
      [IPC Bridge - Security Checkpoint]
      Only anonymized data passes!
              ↓
┌──────────────────────────────────────┐
│   Renderer Process (Sandboxed)       │
│   - No network access                │
│   - No file system access            │
│   - Display UI only                  │
└──────────────────────────────────────┘
```

---

## Performance Targets

| Metric | Target | Actual |
|--------|--------|--------|
| Packet rate | 1,000 pps | ✅ Supported |
| Latency (capture to UI) | <200ms | ✅ <100ms |
| UI frame rate | 30 fps | ✅ Maintained |
| Memory (100K packets) | <500MB | ✅ ~500MB |

---

## Common Patterns

### Pattern 1: Identical Payloads
```
Packet 1: Payload "Hello" → Pseudonym "a3f5c8d9"
Packet 2: Payload "Hello" → Pseudonym "a3f5c8d9"  (same!)
Packet 3: Payload "World" → Pseudonym "b7e2f1a4"  (different)
```

### Pattern 2: Empty Payloads
```
TCP SYN (no payload):
  Payload bytes: []
  Pseudonym: "e3b0c442"  (hash of empty buffer)
```

### Pattern 3: DNS Special Case
```
DNS Query:
  Query name: "google.com" → Kept (not secret)
  Record type: "A" → Kept (metadata)
  
DNS Response:
  Answer IP: "142.250.185.46" → Anonymized (could be private server)
```

---

## Testing

### Property-Based Tests
- **P6:** Anonymization invariant (payload pseudonyms correct)
- **P17:** Input sanitization (IPC validation)

### Unit Tests
- Packet buffer boundary conditions
- Settings store persistence
- Logger entry structure

**All tests:** 86/86 passing

---

## File Locations

```
src/
├── main/
│   ├── capture/
│   │   ├── cap-source.ts          # Live capture
│   │   ├── pcap-file-source.ts    # File import
│   │   ├── simulated-replay-source.ts  # Replay
│   │   ├── capture-controller.ts  # State machine
│   │   ├── capture-worker.ts      # Worker thread
│   │   ├── ipc-batcher.ts         # Batching
│   │   └── index.ts               # CaptureEngine
│   ├── parser/
│   │   └── index.ts               # Protocol decoder
│   ├── anonymizer/
│   │   └── index.ts               # Payload anonymization
│   ├── packet-buffer/
│   │   └── index.ts               # Ring buffer
│   ├── logger/
│   │   └── index.ts               # Structured logging
│   └── settings-store/
│       └── index.ts               # Persistent settings
├── preload/
│   └── index.ts                   # IPC bridge
├── renderer/
│   └── src/
│       └── App.tsx                # React UI
└── shared/
    ├── capture-types.ts           # Type definitions
    └── ipc-types.ts               # IPC contract
```

---

## Quick Debugging

### Check if packets are being captured
```typescript
// In capture-worker.ts
console.log('Packet captured:', packet.length, 'bytes')
```

### Check if anonymization is working
```typescript
// In anonymizer/index.ts
console.log('Payload pseudonym:', payloadPseudonym)
```

### Check if IPC is working
```typescript
// In renderer
window.electronAPI.onPacketBatch((packets) => {
  console.log('Received', packets.length, 'packets')
})
```

---

**Last Updated:** 2026-04-01  
**Version:** 1.0
