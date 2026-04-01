# The Journey of a Network Packet in NetVis

**A Beginner's Guide to Packet Capture and Anonymization**

---

## Table of Contents

1. [Overview](#overview)
2. [The Big Picture](#the-big-picture)
3. [Step-by-Step Journey](#step-by-step-journey)
4. [Deep Dive: Each Component](#deep-dive-each-component)
5. [Security and Privacy](#security-and-privacy)
6. [Common Questions](#common-questions)

---

## Overview

When you use NetVis to capture network traffic, a packet goes through a carefully designed pipeline that:
1. Captures raw network data
2. Decodes it into understandable protocol information
3. Removes sensitive content (anonymization)
4. Sends it safely to the user interface

This document explains every step in detail, assuming you're new to networking and programming.

---

## The Big Picture

Think of NetVis like a postal service inspector who:
1. **Intercepts** letters (packets) as they pass through
2. **Opens** them to see what's inside (parsing)
3. **Redacts** sensitive information (anonymization)
4. **Shows** you the safe version (UI display)

Here's the visual flow:

```
Network Wire → Capture → Parse → Anonymize → IPC Bridge → User Interface
   (bytes)      (raw)    (decoded)  (safe)      (secure)     (display)
```

---

## Step-by-Step Journey

Let's follow a single packet from the moment it appears on your network wire to when you see it in the NetVis interface.

### Step 1: Packet Arrives on Network Wire

**What happens:**
A packet (a chunk of data) travels through your network cable or WiFi. It's just raw bytes at this point - like a sealed envelope.

**Example:**
```
Raw bytes: 45 00 00 3c 1c 46 40 00 40 06 b1 e6 c0 a8 01 64 c0 a8 01 65...
```

**Where:** Physical network interface (your WiFi card or Ethernet port)

---

### Step 2: Capture Engine Grabs the Packet

**What happens:**
The Capture Engine uses a special library (libpcap on Mac/Linux, Npcap on Windows) to "sniff" packets as they pass through your network interface. It's like having a camera pointed at the postal service conveyor belt.

**Component:** `CapSource` (for live capture)

**Code location:** `src/main/capture/cap-source.ts`

**What it does:**
```typescript
// When a packet arrives, the 'cap' library calls this function
this.cap.on('packet', (nbytes: number, truncated: boolean) => {
  // Copy the bytes immediately (the library reuses the buffer!)
  const data = new Uint8Array(this.buffer.buffer, this.buffer.byteOffset, nbytes).slice()
  
  // Create a RawPacket object
  const packet: RawPacket = {
    timestamp: Date.now(),           // When we captured it
    sourceId: this.iface,            // Which network interface
    captureMode: 'live',             // Live capture (not from file)
    data,                            // The actual bytes
    length: nbytes,                  // How many bytes
    linkType: linkTypeNum            // What kind of network (usually Ethernet)
  }
  
  // Send it to the next step
  this.packetHandler(packet)
})
```

**Key concept:** At this point, we have a `RawPacket` - just raw bytes with some metadata (timestamp, source).

---

### Step 3: Worker Thread Receives Raw Packet

**What happens:**
The packet is sent to a separate "worker thread" - think of it as a separate worker in a factory who handles the heavy processing so the main manager (main thread) doesn't get overwhelmed.

**Component:** `CaptureController` in worker thread

**Code location:** `src/main/capture/capture-worker.ts`

**Why a separate thread?**
- Packets can arrive at 1,000+ per second
- Processing them is CPU-intensive
- We don't want to freeze the main application

**What it does:**
```typescript
const controller = new CaptureController(
  (packet: RawPacket) => {
    // This function is called for each captured packet
    // Step 4 happens here...
  }
)
```

---

### Step 4: Parser Decodes the Packet

**What happens:**
The Parser takes the raw bytes and decodes them into understandable protocol layers. It's like opening the envelope and reading the address, stamps, and contents.

**Component:** `Parser`

**Code location:** `src/main/parser/index.ts`

**The decoding process:**

```typescript
const parsed = Parser.parse(packet)
```

**What the Parser does (layer by layer):**

1. **Ethernet Layer** (the outer envelope)
   ```
   Bytes 0-5:   Destination MAC address (where it's going)
   Bytes 6-11:  Source MAC address (where it came from)
   Bytes 12-13: EtherType (what's inside - usually IP)
   ```

2. **IP Layer** (the addressing)
   ```
   Byte 0:      Version (IPv4 or IPv6)
   Bytes 12-15: Source IP address (e.g., 192.168.1.100)
   Bytes 16-19: Destination IP address (e.g., 192.168.1.101)
   Byte 9:      Protocol (TCP, UDP, ICMP, etc.)
   ```

3. **Transport Layer** (the delivery method)
   ```
   For TCP:
   Bytes 0-1:   Source port (e.g., 443 for HTTPS)
   Bytes 2-3:   Destination port
   Bytes 4-7:   Sequence number
   Bytes 8-11:  Acknowledgment number
   Byte 13:     Flags (SYN, ACK, FIN, etc.)
   ```

4. **Application Layer** (the actual data)
   ```
   Everything after the transport header is the payload
   (This is what we'll anonymize!)
   ```

**Result:** A `ParsedPacket` with structured layers:

```typescript
{
  id: "uuid-1234",
  timestamp: 1234567890,
  layers: [
    {
      protocol: "Ethernet",
      fields: [
        { name: "dst", value: "aa:bb:cc:dd:ee:ff", byteOffset: 0, byteLength: 6 },
        { name: "src", value: "11:22:33:44:55:66", byteOffset: 6, byteLength: 6 },
        { name: "etherType", value: "0x0800", byteOffset: 12, byteLength: 2 }
      ]
    },
    {
      protocol: "IPv4",
      fields: [
        { name: "src", value: "192.168.1.100", byteOffset: 26, byteLength: 4 },
        { name: "dst", value: "192.168.1.101", byteOffset: 30, byteLength: 4 }
      ]
    },
    {
      protocol: "TCP",
      fields: [
        { name: "srcPort", value: 443, byteOffset: 34, byteLength: 2 },
        { name: "dstPort", value: 54321, byteOffset: 36, byteLength: 2 }
      ]
    }
  ],
  rawData: Uint8Array[...] // Still has the original bytes
}
```

---

### Step 5: Anonymizer Removes Sensitive Data

**What happens:**
The Anonymizer takes the parsed packet and replaces sensitive payload data with a "pseudonym" - a unique code that represents the data without revealing what it actually is.

**Component:** `Anonymizer`

**Code location:** `src/main/anonymizer/index.ts`

**Why anonymize?**
- Network traffic often contains passwords, personal messages, credit card numbers
- We want to teach networking without exposing private data
- It's like showing you a redacted document - you can see the structure but not the secrets

**The anonymization process:**

```typescript
const anon = Anonymizer.anonymize(parsed)
```

**Step 5a: Find where the payload starts**

```typescript
// Find the transport layer (TCP, UDP, or ICMP)
const transportLayer = packet.layers.find(
  (l) => l.protocol === 'TCP' || l.protocol === 'UDP' || l.protocol === 'ICMP'
)

// Calculate where the payload begins
// (after all the headers)
const payloadStart = transportLayer
  ? transportLayer.rawByteOffset + transportLayer.rawByteLength
  : packet.wireLength
```

**Example:**
```
Packet structure:
[Ethernet: 14 bytes][IP: 20 bytes][TCP: 20 bytes][Payload: 100 bytes]
                                                   ^
                                                   payloadStart = 54
```

**Step 5b: Extract only the payload bytes**

```typescript
// Get just the payload bytes (not the headers!)
const payloadBytes = packet.rawData
  ? Buffer.from(packet.rawData).subarray(payloadStart)
  : Buffer.alloc(0)
```

**Example:**
```
Original packet: [14 bytes Ethernet][20 bytes IP][20 bytes TCP][100 bytes payload]
Payload bytes:   [100 bytes payload]  ← Only this part!
```

---

**Step 5c: Create a pseudonym (the magic part!)**

```typescript
// Generate a session key (done once when app starts)
const SESSION_KEY = randomBytes(32)  // 32 random bytes

// Create a pseudonym for the payload
function pseudonym(data: Buffer | Uint8Array): string {
  return createHash('sha256')
    .update(SESSION_KEY)      // Mix in the secret key
    .update(data)              // Mix in the payload
    .digest('hex')             // Convert to hex string
    .slice(0, 8)               // Take first 8 characters
}

const payloadPseudonym = pseudonym(payloadBytes)
```

**What this does:**
1. Takes the session key (secret, random, never saved)
2. Combines it with the payload bytes
3. Runs it through SHA-256 (a one-way hash function)
4. Takes the first 8 characters of the result

**Example:**
```
Payload bytes:     "Hello, this is secret data!"
Session key:       [32 random bytes]
SHA-256 hash:      "a3f5c8d9e2b1f4a7c6d8e9f0a1b2c3d4..."
Pseudonym:         "a3f5c8d9"
```

**Key properties:**
- **Deterministic:** Same payload always gives same pseudonym (in this session)
- **One-way:** You can't reverse it to get the original payload
- **Unique:** Different payloads give different pseudonyms
- **Session-scoped:** Restart the app, get different pseudonyms

**Step 5d: Attach the pseudonym to the packet**

```typescript
// Add a synthetic "payload" field to the transport layer
const finalLayers = anonLayers.map((layer) => {
  if (layer.protocol === 'TCP' || layer.protocol === 'UDP' || layer.protocol === 'ICMP') {
    return {
      ...layer,
      fields: [
        ...layer.fields,
        {
          name: 'payload',
          label: 'Payload (anonymized)',
          value: payloadPseudonym,  // "a3f5c8d9" instead of actual data
          byteOffset: layer.rawByteOffset + layer.rawByteLength,
          byteLength: 0
        }
      ]
    }
  }
  return layer
})
```

**Step 5e: Create the final AnonPacket**

```typescript
return {
  id: packet.id,
  timestamp: packet.timestamp,
  sourceId: packet.sourceId,
  captureMode: packet.captureMode,
  wireLength: packet.wireLength,
  layers: finalLayers,           // Layers with pseudonym
  srcAddress: "192.168.1.100",   // Kept (it's metadata, not payload)
  dstAddress: "192.168.1.101",   // Kept (it's metadata, not payload)
  protocol: "TCP",
  length: packet.wireLength
  // rawData is NOT included! (never crosses IPC)
}
```

**What's kept vs. removed:**

✅ **Kept (metadata - safe to show):**
- IP addresses (source and destination)
- Port numbers
- Protocol types (TCP, UDP, etc.)
- Timestamps
- Packet lengths
- Header fields (flags, sequence numbers, etc.)

❌ **Removed (sensitive data):**
- Actual payload content (replaced with pseudonym)
- Raw bytes (never sent to UI)
- Any application-layer data

---

### Step 6: Worker Sends Packet to Main Thread

**What happens:**
The worker thread sends the anonymized packet back to the main thread using a message.

**Code location:** `src/main/capture/capture-worker.ts`

```typescript
const controller = new CaptureController(
  (packet: RawPacket) => {
    const parsed = Parser.parse(packet)
    const anon = Anonymizer.anonymize(parsed)
    
    // Send to main thread
    send({ type: 'packet-batch', packets: [anon] })
  }
)
```

**Why send it back?**
- The worker thread can't directly update the UI
- The main thread manages the application state
- This is a security boundary - only safe data crosses

---

### Step 7: Main Thread Receives and Batches Packets

**What happens:**
The main thread receives the anonymized packet and adds it to a "batcher" that groups packets together for efficient sending to the UI.

**Component:** `CaptureEngine` and `IpcBatcher`

**Code location:** `src/main/capture/index.ts`

```typescript
private handleWorkerMessage(msg: WorkerOutMessageExtended): void {
  switch (msg.type) {
    case 'packet-batch':
      // Push packets to batcher
      for (const p of msg.packets) {
        this.batcher.push(p)
      }
      break
  }
}
```

**Why batch?**
- Sending 1,000 individual packets per second would overwhelm the IPC system
- Batching groups them: send 100 packets every 50ms = only 20 messages per second
- Much more efficient!

**Batching rules:**
```typescript
// Flush (send) when either condition is met:
- Every 50 milliseconds, OR
- When 100 packets accumulate
```

---

### Step 8: IPC Bridge - The Security Checkpoint

**What happens:**
The batch of anonymized packets crosses the IPC (Inter-Process Communication) bridge from the main process to the renderer process. This is like going through airport security - only approved items can pass.

**Component:** Preload script with `contextBridge`

**Code location:** `src/preload/index.ts`

**The security model:**

```
┌─────────────────────────────────────┐
│      Main Process (Privileged)      │
│  - Can access network               │
│  - Can read files                   │
│  - Has Node.js access               │
│  - Runs Capture, Parser, Anonymizer│
└─────────────────────────────────────┘
                 ↓
         [IPC Bridge - Security Checkpoint]
         Only approved data can pass!
                 ↓
┌─────────────────────────────────────┐
│    Renderer Process (Sandboxed)     │
│  - Cannot access network            │
│  - Cannot read files                │
│  - No Node.js access                │
│  - Only displays UI                 │
└─────────────────────────────────────┘
```

**How it works:**

```typescript
// Main process sends
mainWindow.webContents.send('packet:batch', [anonPacket1, anonPacket2, ...])

// Preload script exposes a safe function
contextBridge.exposeInMainWorld('electronAPI', {
  onPacketBatch: (handler) => {
    ipcRenderer.on('packet:batch', (_event, packets) => handler(packets))
  }
})

// Renderer receives
window.electronAPI.onPacketBatch((packets) => {
  // Update UI with packets
})
```

**Security guarantees:**
- ✅ Only anonymized packets cross the bridge
- ✅ No raw bytes cross the bridge
- ✅ No file system access from renderer
- ✅ No network access from renderer
- ✅ Renderer can only receive, not send arbitrary commands

---

### Step 9: Renderer Receives and Displays Packets

**What happens:**
The renderer process (the UI) receives the batch of anonymized packets and displays them in the interface.

**Component:** React components with Zustand state management

**Code location:** `src/renderer/src/App.tsx` (to be implemented in Task 13)

```typescript
// Listen for packet batches
window.electronAPI.onPacketBatch((packets) => {
  // Add to Zustand store
  store.addPackets(packets)
  
  // React automatically re-renders the UI
})
```

**What you see in the UI:**

```
┌─────────────────────────────────────────────────────────────┐
│ Packet List                                                  │
├──────┬─────────────┬─────────────┬──────────┬────────┬──────┤
│ Time │ Source      │ Destination │ Protocol │ Length │ Info │
├──────┼─────────────┼─────────────┼──────────┼────────┼──────┤
│ 0.001│192.168.1.100│192.168.1.101│   TCP    │  154   │ SYN  │
│ 0.002│192.168.1.101│192.168.1.100│   TCP    │  154   │SYN,ACK│
│ 0.003│192.168.1.100│192.168.1.101│   TCP    │  154   │ ACK  │
│ 0.004│192.168.1.100│192.168.1.101│   TCP    │  254   │a3f5c8│ ← Pseudonym!
└──────┴─────────────┴─────────────┴──────────┴────────┴──────┘

Click a packet to see details:
┌─────────────────────────────────────────────────────────────┐
│ Packet Details                                               │
├─────────────────────────────────────────────────────────────┤
│ ▼ Ethernet                                                   │
│   └─ Destination: aa:bb:cc:dd:ee:ff                         │
│   └─ Source: 11:22:33:44:55:66                              │
│   └─ Type: IPv4 (0x0800)                                    │
│                                                              │
│ ▼ IPv4                                                       │
│   └─ Source: 192.168.1.100                                  │
│   └─ Destination: 192.168.1.101                             │
│   └─ Protocol: TCP (6)                                      │
│                                                              │
│ ▼ TCP                                                        │
│   └─ Source Port: 443                                       │
│   └─ Destination Port: 54321                                │
│   └─ Flags: PSH, ACK                                        │
│   └─ Payload (anonymized): a3f5c8d9  ← Safe to show!       │
└─────────────────────────────────────────────────────────────┘
```

---

## Deep Dive: Each Component

### Component 1: Capture Engine

**Purpose:** Interface with the operating system to grab packets from the network

**How it works:**
1. Opens a network interface (like "WiFi" or "Ethernet")
2. Tells the OS: "Give me a copy of every packet that passes through"
3. Receives packets in a callback function
4. Immediately copies the bytes (the OS reuses the buffer!)

**Real-world analogy:**
Like a security camera pointed at a conveyor belt - it records everything that passes by without stopping the flow.

**Key files:**
- `src/main/capture/cap-source.ts` - Live capture
- `src/main/capture/pcap-file-source.ts` - File import
- `src/main/capture/simulated-replay-source.ts` - Simulated replay

---

### Component 2: Parser

**Purpose:** Decode raw bytes into structured protocol information

**How it works:**
1. Reads bytes sequentially
2. Identifies protocol layers (Ethernet, IP, TCP, etc.)
3. Extracts fields from each layer
4. Handles errors gracefully (malformed packets don't crash)

**Real-world analogy:**
Like a translator who reads a letter in a foreign language and tells you: "This is from John, to Mary, sent on Tuesday, says 'Hello'"

**Supported protocols:**
- **Ethernet:** MAC addresses, EtherType
- **IPv4/IPv6:** IP addresses, TTL, protocol
- **TCP:** Ports, sequence numbers, flags
- **UDP:** Ports, length, checksum
- **ICMP:** Type, code (ping messages)
- **DNS:** Query names, record types
- **ARP:** Hardware/protocol addresses

**Key file:**
- `src/main/parser/index.ts`

---

### Component 3: Anonymizer

**Purpose:** Remove sensitive payload data while preserving educational value

**How it works:**
1. Generates a random session key at startup (32 bytes)
2. Finds where the payload starts (after all headers)
3. Extracts only the payload bytes
4. Creates a pseudonym: SHA-256(session_key + payload_bytes)
5. Replaces payload with pseudonym
6. Removes raw bytes entirely

**Real-world analogy:**
Like a document redactor who blacks out sensitive information but leaves the structure visible - you can see there's a message, but not what it says.

**What makes a good pseudonym:**
- **Deterministic:** Same payload → same pseudonym (in this session)
- **Unique:** Different payloads → different pseudonyms
- **One-way:** Can't reverse it to get original data
- **Session-scoped:** Restart app → different pseudonyms

**Key file:**
- `src/main/anonymizer/index.ts`

---

### Component 4: IPC Bridge

**Purpose:** Safely transfer data between privileged and sandboxed processes

**How it works:**
1. Main process has full system access (dangerous!)
2. Renderer process is sandboxed (safe!)
3. IPC bridge is the only communication channel
4. Only explicitly approved functions are exposed

**Real-world analogy:**
Like a bank teller window - you can make approved transactions, but you can't go into the vault yourself.

**Security features:**
- `nodeIntegration: false` - Renderer can't access Node.js
- `contextIsolation: true` - Renderer runs in isolated context
- `contextBridge` - Only approved functions exposed
- Input validation - All data validated with zod schemas

**Key files:**
- `src/preload/index.ts` - The bridge itself
- `src/main/ipc-handlers.ts` - Main process handlers
- `src/main/ipc-schemas.ts` - Validation schemas

---

## Security and Privacy

### Why Anonymization Matters

**Scenario 1: Password in HTTP request**
```
Without anonymization:
Payload: "POST /login HTTP/1.1\r\npassword=MySecret123"
You see: The actual password!

With anonymization:
Payload pseudonym: "a3f5c8d9"
You see: Just a code, not the password
```

**Scenario 2: Personal message**
```
Without anonymization:
Payload: "Hey John, my credit card is 1234-5678-9012-3456"
You see: The credit card number!

With anonymization:
Payload pseudonym: "b7e2f1a4"
You see: Just a code, not the message
```

### What's Safe to Show

**✅ Safe (metadata):**
- IP addresses (192.168.1.100)
- Port numbers (443, 80)
- Protocol types (TCP, UDP)
- Packet lengths (154 bytes)
- Timestamps (when captured)
- Header fields (flags, sequence numbers)

**❌ Not safe (payload):**
- Passwords
- Personal messages
- Credit card numbers
- Session tokens
- Any application data

### The Session Key

**What is it?**
A 32-byte random number generated when NetVis starts.

**Properties:**
- Generated once per session
- Never saved to disk
- Never logged
- Never sent over IPC
- Never exported to PCAP files

**Why it matters:**
Without the session key, you can't reverse the pseudonyms. Even if someone gets the pseudonym "a3f5c8d9", they can't figure out what the original payload was.

---

## Common Questions

### Q1: Why not just show the raw bytes?

**Answer:** Raw bytes often contain sensitive information like passwords, personal messages, and credit card numbers. By anonymizing, we can teach networking concepts without exposing private data.

---

### Q2: Can I reverse the pseudonym to see the original data?

**Answer:** No! The pseudonym is created using SHA-256, a one-way hash function. Even if you have the pseudonym "a3f5c8d9", you can't work backwards to get the original payload. You'd also need the session key, which is never saved or shared.

---

### Q3: Why keep IP addresses if they're "sensitive"?

**Answer:** IP addresses are metadata (like the "To" and "From" on an envelope), not payload (the letter inside). They're essential for understanding network communication and are already visible to anyone on the network. The real secrets are in the payload.

---

### Q4: What if two packets have the same payload?

**Answer:** They'll have the same pseudonym! This is actually useful - it helps you identify patterns. For example, if you see many packets with pseudonym "a3f5c8d9", you know they're carrying the same data.

---

### Q5: Why use a worker thread?

**Answer:** Packets can arrive at 1,000+ per second. Processing them (parsing, anonymizing) is CPU-intensive. If we did this on the main thread, the UI would freeze. The worker thread handles the heavy lifting while the main thread stays responsive.

---

### Q6: What happens if a packet is malformed?

**Answer:** The Parser handles it gracefully:
1. Decodes as much as possible
2. Marks the malformed layer with an error
3. Returns a partial packet
4. Never crashes

This is important because real networks have corrupted packets!

---

### Q7: How fast can NetVis process packets?

**Answer:** 
- **Target:** 1,000 packets per second
- **Latency:** <200ms from capture to UI display
- **Batching:** Groups packets to reduce IPC overhead
- **Performance:** Maintains 30 fps in UI even at high rates

---

### Q8: What if I restart NetVis?

**Answer:** A new session key is generated, so all pseudonyms will be different. This is intentional - it prevents correlation across sessions.

---

### Q9: Can I export anonymized packets?

**Answer:** Yes! When you export to PCAP, the anonymized packets are written to the file. The pseudonyms are preserved, but the original payload is gone forever.

---

### Q10: What about DNS queries?

**Answer:** DNS is special:
- **Query names:** Kept (e.g., "google.com") - they're not secret
- **Record types:** Kept (e.g., "A", "AAAA") - they're metadata
- **Answer IPs:** Anonymized - they could reveal private servers

---

## Visual Summary

Here's the complete journey in one diagram:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         NETWORK WIRE                                 │
│  Raw bytes: 45 00 00 3c 1c 46 40 00 40 06 b1 e6 c0 a8 01 64...     │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP 1: CAPTURE ENGINE                            │
│  Component: CapSource (libpcap/Npcap)                               │
│  Action: Grab packet from network interface                         │
│  Output: RawPacket { timestamp, data, length, linkType }            │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP 2: WORKER THREAD                             │
│  Component: CaptureController in worker                             │
│  Action: Receive packet in separate thread                          │
│  Why: Don't block main thread with heavy processing                 │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP 3: PARSER                                    │
│  Component: Parser.parse()                                          │
│  Action: Decode bytes into protocol layers                          │
│  Output: ParsedPacket {                                             │
│    layers: [                                                        │
│      { protocol: "Ethernet", fields: [...] },                       │
│      { protocol: "IPv4", fields: [...] },                           │
│      { protocol: "TCP", fields: [...] }                             │
│    ],                                                               │
│    rawData: [original bytes]                                        │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP 4: ANONYMIZER                                │
│  Component: Anonymizer.anonymize()                                  │
│  Actions:                                                           │
│    1. Find transport layer (TCP/UDP/ICMP)                           │
│    2. Calculate payload start offset                                │
│    3. Extract payload bytes only                                    │
│    4. Create pseudonym: SHA-256(session_key + payload)              │
│    5. Replace payload with pseudonym                                │
│    6. Remove rawData entirely                                       │
│  Output: AnonPacket {                                               │
│    layers: [...with pseudonym field],                               │
│    srcAddress: "192.168.1.100",                                     │
│    dstAddress: "192.168.1.101",                                     │
│    protocol: "TCP"                                                  │
│    // NO rawData!                                                   │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP 5: BACK TO MAIN THREAD                       │
│  Component: Worker → Main message                                   │
│  Action: Send anonymized packet to main thread                      │
│  Message: { type: 'packet-batch', packets: [AnonPacket] }          │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP 6: IPC BATCHER                               │
│  Component: IpcBatcher                                              │
│  Action: Group packets for efficient IPC                            │
│  Rules: Flush every 50ms OR when 100 packets accumulate             │
│  Why: Reduce IPC overhead (1000 packets/sec → 20 messages/sec)     │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP 7: IPC BRIDGE (Security Checkpoint)          │
│  Component: Preload script with contextBridge                       │
│  Action: Transfer data from main to renderer process                │
│  Security:                                                          │
│    ✅ Only anonymized packets cross                                 │
│    ✅ No raw bytes cross                                            │
│    ✅ No file/network access from renderer                          │
│    ✅ Renderer is sandboxed                                         │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP 8: RENDERER PROCESS                          │
│  Component: React UI with Zustand store                            │
│  Action: Display packets in user interface                          │
│  What you see:                                                      │
│    - Packet list with metadata                                      │
│    - Protocol details                                               │
│    - Pseudonym instead of actual payload                            │
│    - Charts and visualizations                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Capture:** Grab raw bytes from network interface
2. **Parse:** Decode bytes into protocol layers
3. **Anonymize:** Replace sensitive payload with pseudonym
4. **Transfer:** Send safely across IPC bridge
5. **Display:** Show in user interface

**Security is built-in at every step:**
- Worker thread isolation
- Payload anonymization
- IPC security boundary
- Renderer sandboxing

**Educational value preserved:**
- Protocol structure visible
- Header fields intact
- Patterns identifiable
- No sensitive data exposed

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-01  
**For:** NetVis Educational Network Packet Visualizer
