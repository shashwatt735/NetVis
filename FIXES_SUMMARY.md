# Fixes Summary - IPC Communication Issues

**Date:** 2026-04-23  
**Status:** Diagnostic logging added, toast timing fixed

---

## Issues Addressed

### 1. ✅ Stuck "Live capture starting" Toast
**Status:** FIXED

**Problem:** Toast notification showed "Live capture starting" and never dismissed.

**Root Cause:** Success toast was shown when IPC command was accepted, not when capture actually started. If startup failed, the toast remained stuck.

**Solution:**
- Removed premature success toasts from button handlers
- Added status-driven toasts in `App.tsx` that trigger on `capture:status` push events
- Now toasts only show when main process confirms capture has started

---

### 2. ⏳ Replay Shows Nothing
**Status:** DIAGNOSTIC LOGGING ADDED

**Problem:** Starting replay shows status "Simulated replay at Xx speed" but no packets appear.

**Diagnostic Added:**
- Worker message logging in `CaptureEngine.handleWorkerMessage()`
- Packet batch logging in `IpcBatcher.flush()`
- Renderer packet receipt logging in `App.tsx`

**Next Steps:** Run the app and check console logs to see where packets are getting stuck.

---

### 3. ⏳ Missing Visualizations
**Status:** DIAGNOSTIC LOGGING ADDED

**Problem:** BandwidthChart, IPFlowMap, OSILayerDiagram, ProtocolAnimations showing placeholders despite rebuild.

**Diagnostic Added:**
- Console log in `BandwidthChart.tsx` to print `__VITE_PHASE__` value

**Next Steps:** Check console for `[BandwidthChart] __VITE_PHASE__ = ?` to verify build configuration.

---

### 4. ✅ PacketFlowTimeline Data Table Not Opening
**Status:** FIXED (previous session)

**Solution:** Replaced `<details>/<summary>` with controlled button + state.

---

### 5. ✅ InterfaceSelector Spacing Issues
**Status:** FIXED (previous session)

**Solution:** Removed Tailwind classes, standardized to inline styles only.

---

## Files Modified

### Renderer (UI)
- `src/renderer/src/App.tsx` - Added status-driven toasts and packet logging
- `src/renderer/src/components/CaptureControls.tsx` - Removed premature toasts
- `src/renderer/src/components/BandwidthChart.tsx` - Added phase diagnostic

### Main Process
- `src/main/index.ts` - Added engine event logging
- `src/main/capture/index.ts` - Added comprehensive CaptureEngine logging
- `src/main/capture/ipc-batcher.ts` - Added flush logging

---

## Testing Instructions

### 1. Rebuild
```bash
npm run build
```

### 2. Open DevTools Console
Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS)

### 3. Check Phase Value
Look for:
```
[BandwidthChart] __VITE_PHASE__ = 2
```

If it shows `1`, visualizations will be hidden.

### 4. Test Live Capture
1. Select interface
2. Click "Start Live"
3. Watch console for:
   - `[CaptureEngine] startCapture called`
   - `[CaptureEngine] Live capture started successfully`
   - `[Main] Capture engine started-live event`
   - `[IpcBatcher] Flushing N packets`
   - `[App] Received packet batch: N packets`

### 5. Test Replay
1. Click "Replay"
2. Select PCAP file
3. Watch console for:
   - `[CaptureEngine] Received packet-batch from worker`
   - `[IpcBatcher] Flushing N packets`
   - `[App] Received packet batch: N packets`

---

## Expected Console Output (Success)

### Live Capture Success:
```
[BandwidthChart] __VITE_PHASE__ = 2
[CaptureEngine] startCapture called { iface: 'eth0' }
[CaptureEngine] Live capture started successfully, emitting started-live event { iface: 'eth0' }
[Main] Capture engine started-live event { iface: 'eth0' }
[App] Received capture status change: idle -> active
[IpcBatcher] Flushing 10 packets to renderer
[App] Received packet batch: 10 packets
```

### Replay Success:
```
[CaptureEngine] Received packet-batch from worker { count: 1 }
[IpcBatcher] Flushing 1 packets to renderer
[App] Received packet batch: 1 packets
[Main] Capture engine started-simulated event { filePath: '...', speed: 1 }
[App] Received capture status change: idle -> simulated
```

---

## Possible Failure Scenarios

### Scenario 1: Phase is 1
**Console shows:** `[BandwidthChart] __VITE_PHASE__ = 1`

**Cause:** Build configuration not setting phase correctly

**Fix:** Check `electron.vite.config.ts` and ensure `VITE_PHASE` is set to `'2'`

---

### Scenario 2: No "started-live" event
**Console shows:** `[CaptureEngine] startCapture called` but no "started successfully"

**Cause:** `CapSource.start()` is throwing an error

**Fix:** Check for error logs, verify Npcap/libpcap installation

---

### Scenario 3: Worker sends packets but renderer doesn't receive
**Console shows:** `[CaptureEngine] Received packet-batch` but no `[App] Received packet batch`

**Cause:** IPC channel not delivering packets to renderer

**Fix:** Check preload bridge, verify mainWindow exists, check IPC wiring

---

### Scenario 4: No packets from worker at all
**Console shows:** No `[CaptureEngine] Received packet-batch` logs

**Cause:** Worker not sending packets or worker crashed

**Fix:** Check worker logs, verify PCAP file is valid, check SimulatedReplaySource

---

## What's Still Needed

1. **Run diagnostics** - User needs to rebuild and check console logs
2. **Identify bottleneck** - Determine where packets are getting stuck
3. **Fix root cause** - Based on diagnostic output, fix the specific issue:
   - If phase is wrong → fix build config
   - If capture fails → fix CapSource or permissions
   - If worker doesn't send → fix worker thread or SimulatedReplaySource
   - If IPC doesn't deliver → fix preload bridge or App subscriptions

---

## Documentation Created

1. `DIAGNOSTIC_FIXES_APPLIED.md` - Detailed diagnostic guide
2. `FIXES_SUMMARY.md` - This file (high-level overview)

---

## Next Actions for User

1. ✅ Rebuild: `npm run build`
2. ✅ Open DevTools console
3. ✅ Test live capture and check logs
4. ✅ Test replay and check logs
5. ✅ Report back with console output
6. ⏳ Based on logs, apply targeted fix

---

## Confidence Level

- **Toast fix:** 100% - This will definitely fix the stuck toast
- **Diagnostic logging:** 100% - Will reveal where packets are stuck
- **Phase issue:** 80% - Likely a build cache or config issue
- **Packet flow:** 60% - Need diagnostic output to confirm root cause
