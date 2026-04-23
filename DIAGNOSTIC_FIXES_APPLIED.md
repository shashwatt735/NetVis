# Diagnostic Fixes Applied

**Date:** 2026-04-23  
**Issues Addressed:** Stuck "Live capture starting" toast, empty replay mode, missing visualizations

---

## Summary of Changes

### 1. Fixed Toast Notification Timing

**Problem:** The "Live capture starting" toast was shown immediately when the Start button was clicked, but never dismissed because it was a success toast that doesn't auto-dismiss.

**Root Cause:** The toast was triggered when the IPC command was accepted, not when capture actually started. If the capture failed to start (e.g., CapSource.start() threw an error), the toast would remain stuck.

**Fix Applied:**
- Removed premature success toasts from `CaptureControls.tsx` (lines 106-109, 169-171)
- Added toast notifications in `App.tsx` that trigger when `capture:status` push events arrive
- Now toasts only show when the main process confirms capture has actually started

**Files Modified:**
- `src/renderer/src/components/CaptureControls.tsx`
- `src/renderer/src/App.tsx`

---

### 2. Added Comprehensive Debug Logging

**Purpose:** Track the complete flow from IPC command → worker/main thread → packet capture → IPC push → renderer

**Logging Added:**

#### Main Process (`src/main/index.ts`)
- Log all `capture:status` push events with state and metadata
- Track when engine events fire (`started-live`, `started-simulated`, `error`, `stopped`)

#### CaptureEngine (`src/main/capture/index.ts`)
- Log `startCapture()` entry and success/failure
- Log when `started-live` event is emitted
- Log all worker messages (`packet-batch`, `command-ok`, `command-error`, `command-complete`)
- Track packet batch counts from worker

#### IpcBatcher (`src/main/capture/ipc-batcher.ts`)
- Log every flush operation with packet count

#### Renderer (`src/renderer/src/App.tsx`)
- Log when `packet:batch` IPC events arrive with packet count
- Log capture status changes with state transitions

---

### 3. Phase Diagnostic Logging

**Purpose:** Verify that `__VITE_PHASE__` is actually 2 at runtime

**Added:**
- Console log in `BandwidthChart.tsx` to print `__VITE_PHASE__` value on every render

**Expected Output:**
```
[BandwidthChart] __VITE_PHASE__ = 2
```

If it shows `1` or `undefined`, the build configuration is not working correctly.

---

## How to Use These Diagnostics

### Step 1: Rebuild the Application

```bash
npm run build
```

### Step 2: Start the Application

Run the built application (not dev mode) to test.

### Step 3: Open DevTools Console

Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS) to open DevTools.

### Step 4: Check Phase Value

Look for this line in the console:
```
[BandwidthChart] __VITE_PHASE__ = 2
```

If it shows `1`, the visualizations will be hidden. This means the build is using the wrong phase value.

### Step 5: Test Live Capture

1. Select a network interface
2. Click "Start Live"
3. Watch the console for these log messages:

**Expected Flow:**
```
[CaptureEngine] startCapture called { iface: '...' }
[CaptureEngine] Live capture started successfully, emitting started-live event { iface: '...' }
[Main] Capture engine started-live event { iface: '...' }
[App] Received capture status change: idle -> active
[IpcBatcher] Flushing N packets to renderer
[App] Received packet batch: N packets
```

**If capture fails:**
```
[CaptureEngine] Failed to start live capture { error: '...', stack: '...' }
[Main] Capture engine error event { error: {...} }
[App] Received capture status change: idle -> error
```

### Step 6: Test Simulated Replay

1. Click "Replay"
2. Select a PCAP file
3. Watch the console for these log messages:

**Expected Flow:**
```
[CaptureEngine] Received packet-batch from worker { count: N }
[IpcBatcher] Flushing N packets to renderer
[App] Received packet batch: N packets
[Main] Capture engine started-simulated event { filePath: '...', speed: 1 }
[App] Received capture status change: idle -> simulated
```

---

## Common Issues and Diagnostics

### Issue: No "started-live" event logged

**Possible Causes:**
1. `CapSource.start()` is throwing an error
2. The error is being caught but not logged
3. Npcap/libpcap is not installed or accessible

**Check:**
- Look for error logs before the "started-live" line
- Check if there's a "Failed to start live capture" log
- Verify Npcap is installed (Windows) or libpcap permissions (Linux)

---

### Issue: "started-live" logged but no packets arrive

**Possible Causes:**
1. No network traffic on the selected interface
2. Packet handler not wired correctly
3. IpcBatcher not flushing

**Check:**
- Generate some network traffic (open a website, ping something)
- Look for "[IpcBatcher] Flushing" logs
- Check if packets are being captured but not sent to renderer

---

### Issue: Worker sends packets but renderer doesn't receive them

**Possible Causes:**
1. IPC channel not wired correctly in preload
2. Renderer listener not subscribed
3. mainWindow is null when sending

**Check:**
- Look for "[App] Received packet batch" logs
- Verify preload bridge is exposing `onPacketBatch`
- Check if mainWindow exists when engine tries to send

---

### Issue: Visualizations still showing placeholders

**Possible Causes:**
1. `__VITE_PHASE__` is not 2
2. Build cache has old compiled code
3. Environment variable not set correctly

**Check:**
- Console log shows `__VITE_PHASE__ = 2`
- Delete `out/` and `build/` folders and rebuild
- Check `electron.vite.config.ts` for phase definition

---

## Next Steps

After running diagnostics:

1. **If phase is wrong:** Fix build configuration in `electron.vite.config.ts`
2. **If capture starts but no packets:** Check network traffic and interface selection
3. **If worker doesn't send packets:** Check worker thread logs and SimulatedReplaySource
4. **If IPC doesn't deliver packets:** Check preload bridge and App.tsx subscriptions

---

## Files Modified in This Fix

1. `src/renderer/src/components/CaptureControls.tsx` - Removed premature success toasts
2. `src/renderer/src/App.tsx` - Added status-driven toasts and packet logging
3. `src/main/index.ts` - Added event logging for all engine events
4. `src/main/capture/index.ts` - Added comprehensive logging in CaptureEngine
5. `src/main/capture/ipc-batcher.ts` - Added flush logging
6. `src/renderer/src/components/BandwidthChart.tsx` - Added phase diagnostic log

---

## Expected Behavior After Fix

1. **Live Capture:**
   - Click "Start Live" → button shows "Starting..."
   - When capture actually starts → toast shows "Live capture started"
   - Packets appear in list immediately
   - Status bar shows "Capturing on [interface] (0:00)"

2. **Simulated Replay:**
   - Click "Replay" → select file → button shows "Starting..."
   - When replay starts → toast shows "Replay started"
   - Packets stream into list at selected speed
   - Status bar shows "Simulated replay at Xx speed"

3. **Visualizations:**
   - All Phase 2 visualizations render (no placeholders)
   - BandwidthChart, IPFlowMap, OSILayerDiagram, ProtocolAnimations all visible
   - Console shows `__VITE_PHASE__ = 2`

---

## Rollback Instructions

If these changes cause issues, revert with:

```bash
git checkout HEAD~1 -- src/renderer/src/components/CaptureControls.tsx
git checkout HEAD~1 -- src/renderer/src/App.tsx
git checkout HEAD~1 -- src/main/index.ts
git checkout HEAD~1 -- src/main/capture/index.ts
git checkout HEAD~1 -- src/main/capture/ipc-batcher.ts
git checkout HEAD~1 -- src/renderer/src/components/BandwidthChart.tsx
```

Then rebuild:
```bash
npm run build
```
