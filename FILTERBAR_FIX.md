# FilterBar Fix

**Issue:** FilterBar was broken after responsive layout implementation

## Problem

The FilterBar had fixed width constraints (`clamp(260px, 34vw, 430px)`) which conflicted with the responsive toolbar container.

## Solution

### Before (Broken)

```tsx
// FilterBar.tsx
<div style={{
  width: 'clamp(260px, 34vw, 430px)',  // ← Fixed width
  minWidth: 240,
  maxWidth: 430,
  position: 'relative'
}}>
```

### After (Fixed)

```tsx
// FilterBar.tsx
<div style={{
  width: '100%',      // ← Flexible width
  maxWidth: 430,      // ← Only max constraint
  position: 'relative'
}}>
```

## Changes Made

1. **FilterBar.tsx** - Changed width from `clamp()` to `100%`
2. **Toolbar.tsx** - Improved container flex behavior

## Result

- ✅ FilterBar now adapts to available space
- ✅ Works at all window sizes
- ✅ No overflow or cutoff
- ✅ Maintains max-width of 430px

## Test

```bash
npm run dev
```

Verify FilterBar is visible and functional at all window sizes.
