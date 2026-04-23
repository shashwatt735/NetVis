# Quick Diagnostic Guide

**Run these steps in order to diagnose the issues:**

---

## Step 1: Rebuild

```bash
npm run build
```

Wait for build to complete.

---

## Step 2: Start the App

Run the built application (not `npm run dev`).

---

## Step 3: Open DevTools Console

**Windows/Linux:** Press `Ctrl + Shift + I`  
**macOS:** Press `Cmd + Option + I`

Keep the console open for all tests.

---

## Step 4: Check Phase Value

Look for this line in the console:

```
[BandwidthChart] __VITE_PHASE__ = 2
```

**If it shows `1` or `undefined`:**
- ❌ Visualizations will be hidden
- Problem: Build configuration
- Fix needed: Update `electron.vite.config.ts`

**If it shows `2`:**
- ✅ Phase is correct
- Visualizations should render
- Continue to next step

---

## Step 5: Test Live Capture

1. Select a network interface from dropdown
2. Click "Start Live" button
3. Watch the console

### What You Should See:

```
[CaptureEngine] startCapture called { iface: '...' }
[CaptureEngine] Live capture started successfully, emitting started-live event
[Main] Capture engine started-live event
[IpcBatcher] Flushing N packets to renderer
[App] Received packet batch: N packets
```

### If You See This Instead:

**No "started successfully" log:**
```
[CaptureEngine] startCapture called
[CaptureEngine] Failed to start live capture { error: '...' }
```
→ Problem: Capture startup failed (Npcap/libpcap issue)

**"started successfully" but no packets:**
```
[CaptureEngine] Live capture started successfully
(no IpcBatcher or App logs)
```
→ Problem: No network traffic or packet handler not working

**IpcBatcher logs but no App logs:**
```
[IpcBatcher] Flushing 10 packets
(no [App] Received packet batch)
```
→ Problem: IPC channel not delivering to renderer

---

## Step 6: Test Replay

1. Click "Replay" button
2. Select a PCAP file
3. Watch the console

### What You Should See:

```
[CaptureEngine] Received packet-batch from worker { count: 1 }
[IpcBatcher] Flushing N packets to renderer
[App] Received packet batch: N packets
[Main] Capture engine started-simulated event
```

### If You See This Instead:

**No worker packet-batch logs:**
```
(no [CaptureEngine] Received packet-batch logs)
```
→ Problem: Worker not sending packets (file invalid or worker crashed)

**Worker sends but IpcBatcher doesn't flush:**
```
[CaptureEngine] Received packet-batch from worker
(no [IpcBatcher] Flushing)
```
→ Problem: Batcher not flushing (timer issue or batch empty)

**IpcBatcher flushes but renderer doesn't receive:**
```
[IpcBatcher] Flushing 10 packets
(no [App] Received packet batch)
```
→ Problem: IPC channel broken

---

## Step 7: Report Results

Copy the console output and report:

1. **Phase value:** `__VITE_PHASE__ = ?`
2. **Live capture logs:** (paste relevant lines)
3. **Replay logs:** (paste relevant lines)
4. **Any error messages:** (paste full error)

---

## Common Issues Quick Reference

| Symptom | Likely Cause | Where to Look |
|---------|--------------|---------------|
| Visualizations show placeholders | Phase is 1 | Console: `__VITE_PHASE__` |
| Toast stuck at "Starting" | Fixed by this update | Should not happen now |
| No packets in live capture | No traffic or startup failed | Console: CaptureEngine logs |
| No packets in replay | Worker not sending | Console: Worker packet-batch logs |
| Packets sent but not received | IPC broken | Console: IpcBatcher vs App logs |

---

## What to Do Next

Based on console output:

### If Phase = 1:
→ Need to fix build configuration

### If "Failed to start live capture":
→ Need to check Npcap/libpcap installation and permissions

### If worker not sending packets:
→ Need to check worker thread and PCAP file validity

### If IPC not delivering:
→ Need to check preload bridge and App.tsx subscriptions

---

## Files to Check Based on Issue

**Phase issue:**
- `electron.vite.config.ts`
- `package.json` (scripts)

**Live capture startup:**
- `src/main/capture/cap-source.ts`
- `src/main/capture/index.ts` (startCapture method)

**Worker packets:**
- `src/main/capture/capture-worker.ts`
- `src/main/capture/simulated-replay-source.ts`

**IPC delivery:**
- `src/preload/index.ts` (onPacketBatch)
- `src/renderer/src/App.tsx` (subscription)
- `src/main/index.ts` (engine packet handler)

---

## Success Criteria

✅ **Phase:** Console shows `__VITE_PHASE__ = 2`  
✅ **Live Capture:** Packets appear in list, status shows "Capturing on [interface]"  
✅ **Replay:** Packets stream into list, status shows "Simulated replay at Xx speed"  
✅ **Visualizations:** All charts render (no placeholders)  
✅ **Toasts:** Show "Live capture started" or "Replay started" (not stuck at "starting")

---

**After running diagnostics, report the console output so we can apply the targeted fix!**
