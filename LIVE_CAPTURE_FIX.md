# Live Capture Fix Applied

**Date:** 2026-04-23  
**Issue:** Live capture starts but no packets arrive

---

## Root Cause

The `cap` library requires `setMinBytes(0)` to be called after `cap.open()` to dispatch packets immediately. Without this call, the library may buffer packets internally and not fire the `'packet'` event until the buffer fills.

---

## Fix Applied

**File:** `src/main/capture/cap-source.ts`

**Change:** Added `this.cap.setMinBytes(0)` immediately after `cap.open()`

```typescript
this.cap = new Cap()
const rawLinkType: unknown = this.cap.open(this.iface, '', 65535, this.buffer)
const linkTypeNum = normalizeLinkType(rawLinkType)

// CRITICAL: setMinBytes(0) tells cap to dispatch packets immediately without buffering
// Without this, cap may wait for the buffer to fill before firing 'packet' events
this.cap.setMinBytes(0)
```

---

## Additional Fixes

### 1. PacketFlowTimeline Data Table

**Issue:** Table rows were cut off and only one row visible

**Fix:** Replaced button-based table rows with proper `<tr>` elements with click handlers

**File:** `src/renderer/src/components/PacketFlowTimeline.tsx`

---

### 2. Enhanced Logging

Added detailed logging throughout the packet capture pipeline:

**CapSource:**
- Log when cap opens successfully with link type
- Log each packet captured with size and link type
- Log truncated packets that are dropped

**CaptureEngine:**
- Log when onPacket callback fires
- Log after packet is parsed
- Log when packet is pushed to batcher

This will help diagnose any remaining issues.

---

## Testing Instructions

### 1. Rebuild
```bash
npm run build
```

### 2. Start the app and open DevTools console

### 3. Test Live Capture

1. Select a network interface
2. Click "Start Live"
3. Generate some network traffic (open a website, ping something)

### Expected Console Output:

```
[CapSource] Cap opened successfully { iface: '...', rawLinkType: 'ETHERNET', linkTypeNum: 1 }
[CaptureEngine] Live capture started successfully, emitting started-live event
[Main] Capture engine started-live event
[CapSource] Packet captured { nbytes: 66, linkType: 1 }
[CaptureEngine] onPacket callback fired { length: 66, linkType: 1 }
[CaptureEngine] Packet parsed { protocol: 'TCP', id: '...' }
[CaptureEngine] Pushing packet to batcher
[IpcBatcher] Flushing 1 packets to renderer
[App] Received packet batch: 1 packets
```

### 4. Check Packet List

Packets should now appear in the packet list as they are captured.

---

## If Packets Still Don't Arrive

Check the console logs to see where the flow stops:

**If you see "Cap opened" but no "Packet captured":**
- No network traffic on the interface
- Try generating traffic (ping, browse web)
- Try a different interface

**If you see "Packet captured" but no "onPacket callback":**
- Packet handler not wired correctly (should not happen with current code)

**If you see "Packet parsed" but no "Flushing":**
- Batcher not flushing (timer issue)
- Check if batcher.start() was called

**If you see "Flushing" but no "Received packet batch":**
- IPC channel broken
- Check preload bridge
- Check App.tsx subscription

---

## PacketFlowTimeline Data Table Fix

The data table should now:
- Show all rows with proper spacing
- Be scrollable if there are many rows
- Have clickable rows that filter to that time bucket
- Have proper hover effects

---

## Files Modified

1. `src/main/capture/cap-source.ts` - Added `setMinBytes(0)` and logging
2. `src/main/capture/index.ts` - Added packet flow logging
3. `src/renderer/src/components/PacketFlowTimeline.tsx` - Fixed table layout

---

## Expected Behavior After Fix

1. **Live Capture:**
   - Click "Start Live" → toast shows "Live capture started"
   - Packets immediately appear in list as traffic occurs
   - Status bar shows "Capturing on [interface] (0:00)"
   - Console shows packet capture logs

2. **PacketFlowTimeline:**
   - Click "Show data table" → table expands
   - All rows visible with proper spacing
   - Rows are clickable to filter
   - Table is scrollable if needed

---

## Rollback

If this causes issues:

```bash
git checkout HEAD~1 -- src/main/capture/cap-source.ts
git checkout HEAD~1 -- src/main/capture/index.ts
git checkout HEAD~1 -- src/renderer/src/components/PacketFlowTimeline.tsx
npm run build
```
