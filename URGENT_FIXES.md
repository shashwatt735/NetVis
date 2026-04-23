# Urgent Fixes Required

## Issues Identified from Screenshot

### 1. ❌ IPFlowMap, ProtocolAnimations, BandwidthChart, OSILayerDiagram Not Showing

**Cause:** Phase gate check `__VITE_PHASE__ < 2` is showing placeholders  
**Solution:** Rebuild with correct phase

```bash
# Ensure VITE_PHASE=2 (should be default)
npm run build

# Or for development
npm run dev
```

### 2. ❌ PacketFlowTimeline Data Table Not Opening

**Cause:** CSS issue with `<details>` element or missing interaction  
**Fix:** Add proper styling and ensure clickable

### 3. ❌ Interface Selector Spacing Issues

**Cause:** Tailwind classes mixed with inline styles causing layout conflicts  
**Fix:** Standardize to inline styles or Tailwind, not both

### 4. ❌ Live Capture Stuck at "Stopping"

**Cause:** Worker thread or IPC timeout issue  
**Fix:** Check capture-worker.ts stop logic and timeout handling

---

## Immediate Actions

### Action 1: Rebuild the App

```bash
cd netvis
npm run build
```

### Action 2: Check Runtime Phase

Open DevTools Console and run:

```javascript
console.log('VITE_PHASE:', __VITE_PHASE__)
```

Should output: `VITE_PHASE: 2`

If it outputs `1`, the visualizations will show placeholders.

### Action 3: Clear Build Cache

```bash
rm -rf out/
rm -rf dist/
npm run build
```

---

## Root Cause Analysis

### Why Visualizations Show Placeholders

**File:** `src/renderer/src/components/BandwidthChart.tsx` (line 44)

```typescript
if (__VITE_PHASE__ < 2) {
  return <PhasePlaceholder componentName="Bandwidth Chart" />
}
```

Same pattern in:

- `IPFlowMap.tsx` (line 36)
- `OSILayerDiagram.tsx` (line 182)
- `ProtocolAnimations.tsx` (line 242)

**Config:** `electron.vite.config.ts` (line 8)

```typescript
const phase = process.env.VITE_PHASE ?? '2' // Should default to 2
```

**Possible Issues:**

1. Build cache has old phase value
2. Environment variable override
3. Build not completed properly

---

## Detailed Fixes

### Fix 1: PacketFlowTimeline Data Table

The `<details>` element should work, but might need better styling.

**Current Issue:** Arrow not rotating, table not expanding

**Solution:** Add state management for open/closed

```typescript
const [tableOpen, setTableOpen] = useState(false)

// Replace <details> with controlled component
<div style={{ marginTop: 8 }}>
  <button
    type="button"
    onClick={() => setTableOpen(!tableOpen)}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 8px',
      fontSize: 11,
      fontFamily: 'var(--font-ui)',
      color: 'var(--nv-text-secondary)',
      background: 'none',
      border: '1px solid var(--nv-border-subtle)',
      borderRadius: 'var(--nv-radius-sm)',
      cursor: 'pointer',
      width: '100%',
      textAlign: 'left'
    }}
  >
    <span
      aria-hidden
      style={{
        transition: 'transform 150ms ease',
        transform: tableOpen ? 'rotate(90deg)' : 'rotate(0deg)'
      }}
    >
      ▸
    </span>
    {tableOpen ? 'Hide' : 'Show'} data table
  </button>

  {tableOpen && (
    <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 8 }}>
      {/* Table content */}
    </div>
  )}
</div>
```

### Fix 2: Interface Selector Spacing

**Current Issue:** Mixed Tailwind + inline styles causing layout conflicts

**Solution:** Remove Tailwind classes, use only inline styles

```typescript
// Replace this:
<div className="flex items-center gap-1.5">

// With this:
<div style={{
  display: 'flex',
  alignItems: 'center',
  gap: '6px'
}}>
```

### Fix 3: Live Capture Stuck at Stopping

**Possible Causes:**

1. Worker thread not responding to stop command
2. IPC timeout not handled
3. Cap.close() hanging

**Check:**

1. Open DevTools Console
2. Look for errors like:
   - "Worker timeout"
   - "Stop command failed"
   - "IPC timeout"

**Temporary Workaround:**

- Restart the app
- Don't use "Stop" - use "Clear" instead

**Permanent Fix:** Check `src/main/capture/capture-worker.ts` stop logic

---

## Verification Steps

### Step 1: Verify Build

```bash
npm run build
```

Look for output:

```
✓ built in XXXms
```

### Step 2: Check Phase in Runtime

1. Start app
2. Open DevTools (F12)
3. Console: `console.log(__VITE_PHASE__)`
4. Should show: `2`

### Step 3: Verify Visualizations

After rebuild, you should see:

- ✅ Protocol Distribution (pie chart)
- ✅ Packet Flow Timeline (bar chart)
- ✅ Bandwidth Chart (stacked area chart)
- ✅ IP Flow Map (network graph)
- ✅ OSI Layer Diagram (layer visualization)
- ✅ Protocol Animations (animated sequence)

### Step 4: Test Data Table

1. Capture some packets
2. Scroll to "Packet Flow Timeline"
3. Click "Show data table"
4. Table should expand with packet counts

---

## Quick Fix Script

Create a file `fix-build.sh`:

```bash
#!/bin/bash

echo "Cleaning build artifacts..."
rm -rf out/
rm -rf dist/
rm -rf node_modules/.vite/

echo "Rebuilding..."
npm run build

echo "Done! Start the app with: npm run dev"
```

Run:

```bash
chmod +x fix-build.sh
./fix-build.sh
```

---

## If Issues Persist

### Nuclear Option: Full Clean Rebuild

```bash
# Stop all running processes
pkill -f electron

# Clean everything
rm -rf out/
rm -rf dist/
rm -rf node_modules/.vite/
rm -rf .electron-vite/

# Rebuild
npm run build

# Start fresh
npm run dev
```

### Check for Environment Variables

```bash
# Check if VITE_PHASE is set
echo $VITE_PHASE

# Should be empty or "2"
# If it's "1", unset it:
unset VITE_PHASE
```

---

## Expected Behavior After Fixes

1. **All 6 visualizations visible** in left panel
2. **Data table expands** when clicked in PacketFlowTimeline
3. **Interface selector** has proper spacing
4. **Live capture stops** within 2 seconds

---

## Contact Points for Further Investigation

If issues persist after rebuild:

1. Check `electron.vite.config.ts` - ensure `phase` defaults to `'2'`
2. Check browser console for React errors
3. Check main process logs for worker errors
4. Verify no `.env` file is overriding VITE_PHASE
