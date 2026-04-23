# Responsive Layout Implementation Plan

**Date:** 2026-04-23  
**Status:** Proposed

## Problem Analysis

### Current Issues

1. **No Responsiveness**
   - Fixed 42%/58% split doesn't adapt to window size
   - Breaks in split-screen mode (half window)
   - Visualization pane too wide at small sizes
   - No minimum window size enforcement

2. **Insufficient Visual Depth**
   - Shadows too subtle (barely visible)
   - Grid texture not showing (opacity too low)
   - Surface hierarchy not prominent enough
   - Panels don't feel elevated

3. **Layout Proportions**
   - Visualization pane takes 42% (too much for small windows)
   - PacketList gets squeezed
   - No adaptive behavior based on content

---

## Proposed Solution

### 1. Responsive Breakpoints

```typescript
// Breakpoint system
const BREAKPOINTS = {
  xs: 640, // Minimum usable width
  sm: 768, // Small window / half-screen
  md: 1024, // Medium window
  lg: 1280, // Large window (current design target)
  xl: 1600 // Extra large
}
```

### 2. Adaptive Layout Proportions

| Window Width | Viz Pane | Detail Pane | Behavior                     |
| ------------ | -------- | ----------- | ---------------------------- |
| < 768px      | 100%     | Hidden      | Stack vertically OR hide viz |
| 768-1024px   | 35%      | 65%         | Favor packet list            |
| 1024-1280px  | 38%      | 62%         | Balanced                     |
| 1280-1600px  | 42%      | 58%         | Current design               |
| > 1600px     | 40%      | 60%         | Cap viz pane width           |

### 3. Enhanced Visual Depth

#### Stronger Shadows

```css
/* Current (too subtle) */
--nv-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.1);
--nv-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.15);

/* Proposed (more prominent) */
--nv-shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.12);
--nv-shadow-md: 0 4px 16px rgba(0, 0, 0, 0.18);
--nv-shadow-toolbar: 0 2px 8px rgba(0, 0, 0, 0.1);
--nv-shadow-panel: 0 2px 8px rgba(0, 0, 0, 0.08);
```

#### Stronger Grid Texture

```css
/* Current (barely visible) */
backgroundImage: `linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`

/* Proposed (more visible) */
backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)`
/* Note: Lower opacity but with better contrast via surface colors */
```

#### Stronger Surface Contrast

```css
/* Light mode - increase contrast */
--nv-bg-base: #f6f8fa; /* Keep */
--nv-bg-surface-1: #ffffff; /* Keep */
--nv-bg-surface-2: #eef1f4; /* Darker (was #f0f2f5) */
--nv-bg-surface-3: #e4e7eb; /* Darker (was #e8eaed) */

/* Dark mode - increase contrast */
--nv-bg-base: #0d1117; /* Keep */
--nv-bg-surface-1: #161b22; /* Keep */
--nv-bg-surface-2: #1f242b; /* Darker (was #21262d) */
--nv-bg-surface-3: #2d333a; /* Darker (was #30363d) */
```

---

## Implementation Strategy

### Phase 1: Enhanced Visual Depth (Safe, No Breaking Changes)

1. **Strengthen shadows** - More prominent elevation
2. **Increase surface contrast** - Better layer separation
3. **Fix grid texture** - Make it actually visible
4. **Add panel borders** - Clearer boundaries

**Risk:** None - purely visual enhancements  
**Time:** 15 minutes  
**Impact:** Immediate visual improvement

### Phase 2: Responsive Layout (Requires Testing)

1. **Add useWindowSize hook** - Track window dimensions
2. **Implement breakpoint logic** - Adaptive proportions
3. **Add minimum width constraints** - Prevent breaking
4. **Test at different sizes** - Verify no regressions

**Risk:** Low - uses existing flex system  
**Time:** 30 minutes  
**Impact:** Works in split-screen mode

### Phase 3: Advanced Responsiveness (Optional)

1. **Collapsible visualization pane** - Toggle button
2. **Vertical stacking** - For very small windows
3. **Resizable splitter** - User-controlled proportions
4. **Persistent layout preferences** - Remember user choices

**Risk:** Medium - more complex interactions  
**Time:** 1-2 hours  
**Impact:** Professional-grade responsiveness

---

## Recommended Approach

### Start with Phase 1 (Enhanced Visual Depth)

**Why:**

- Zero risk of breaking functionality
- Immediate visual improvement
- Addresses "not up to the mark" feedback
- Can be done in 15 minutes

**Changes:**

1. Strengthen all shadow values
2. Increase surface color contrast
3. Make grid texture visible
4. Add subtle panel borders

### Then Phase 2 (Responsive Layout)

**Why:**

- Addresses split-screen use case
- Low risk (uses existing flex)
- Doesn't change default behavior
- Graceful degradation

**Changes:**

1. Add window size tracking
2. Adjust proportions based on width
3. Set minimum widths
4. Test at 768px, 1024px, 1280px

### Skip Phase 3 (For Now)

**Why:**

- More complex to implement
- Higher risk of bugs
- Can be added later if needed
- Current users don't expect it

---

## Detailed Implementation

### Phase 1: Enhanced Visual Depth

#### 1. Update Shadow Tokens

**File:** `src/renderer/src/assets/theme.css`

```css
:root {
  /* Stronger shadows for better depth perception */
  --nv-shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.12);
  --nv-shadow-md: 0 4px 16px rgba(0, 0, 0, 0.18);
  --nv-shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.24);
  --nv-shadow-overlay: 0 16px 48px rgba(0, 0, 0, 0.32);

  /* Specific component shadows */
  --nv-shadow-toolbar: 0 2px 8px rgba(0, 0, 0, 0.1);
  --nv-shadow-panel: 0 2px 8px rgba(0, 0, 0, 0.08);
  --nv-shadow-header: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.dark {
  /* Stronger shadows in dark mode */
  --nv-shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.5);
  --nv-shadow-md: 0 4px 16px rgba(0, 0, 0, 0.6);
  --nv-shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.7);
  --nv-shadow-overlay: 0 16px 48px rgba(0, 0, 0, 0.8);

  --nv-shadow-toolbar: 0 2px 8px rgba(0, 0, 0, 0.4);
  --nv-shadow-panel: 0 2px 8px rgba(0, 0, 0, 0.35);
  --nv-shadow-header: 0 2px 6px rgba(0, 0, 0, 0.4);
}
```

#### 2. Increase Surface Contrast

**File:** `src/renderer/src/assets/theme.css`

```css
:root {
  /* Light mode - stronger contrast */
  --nv-bg-surface-2: #eef1f4; /* Darker */
  --nv-bg-surface-3: #e4e7eb; /* Darker */
}

.dark {
  /* Dark mode - stronger contrast */
  --nv-bg-surface-2: #1f242b; /* Darker */
  --nv-bg-surface-3: #2d333a; /* Darker */
}
```

#### 3. Fix Grid Texture

**File:** `src/renderer/src/components/AppShell.tsx`

```tsx
// Make grid more visible with better contrast
backgroundImage: `
  linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px),
  linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px)
`,
backgroundSize: '16px 16px'  // Larger grid for better visibility
```

For dark mode, use a CSS class:

```css
.dark {
  /* Override grid for dark mode */
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px) !important;
}
```

#### 4. Update Component Shadows

**Files:** All component files

```tsx
// Toolbar
boxShadow: 'var(--nv-shadow-toolbar)'

// StatusBar
boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.08)'

// Panel headers
boxShadow: 'var(--nv-shadow-header)'

// VisualizationPanel
boxShadow: 'var(--nv-shadow-panel)'
```

---

### Phase 2: Responsive Layout

#### 1. Create useWindowSize Hook

**File:** `src/renderer/src/hooks/useWindowSize.ts`

```typescript
import { useState, useEffect } from 'react'

interface WindowSize {
  width: number
  height: number
}

export function useWindowSize(): WindowSize {
  const [windowSize, setWindowSize] = useState<WindowSize>({
    width: window.innerWidth,
    height: window.innerHeight
  })

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return windowSize
}
```

#### 2. Update MainLayout with Responsive Logic

**File:** `src/renderer/src/components/MainLayout.tsx`

```typescript
import { useWindowSize } from '../hooks/useWindowSize'

export function MainLayout({ visualizationPane, detailPane }: MainLayoutProps) {
  const focusVisualization = useNetVisStore((s) => s.focusVisualization)
  const { width } = useWindowSize()

  // Adaptive proportions based on window width
  const getVisualizationFlex = () => {
    if (focusVisualization) return '1 1 100%'
    if (width < 768) return '0 0 100%'  // Full width on small screens
    if (width < 1024) return '0 0 35%'  // Favor packet list
    if (width < 1280) return '0 0 38%'  // Balanced
    if (width < 1600) return '0 0 42%'  // Current design
    return '0 0 40%'  // Cap at large sizes
  }

  const getVisualizationMinWidth = () => {
    if (focusVisualization) return '100%'
    if (width < 768) return '100%'
    return 280  // Minimum usable width
  }

  const getVisualizationMaxWidth = () => {
    if (focusVisualization) return '100%'
    if (width < 768) return '100%'
    if (width < 1024) return '45%'
    return '60%'
  }

  const shouldShowDetailPane = !focusVisualization && width >= 768

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
      <div
        aria-label="Visualization pane"
        style={{
          flex: getVisualizationFlex(),
          minWidth: getVisualizationMinWidth(),
          maxWidth: getVisualizationMaxWidth(),
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRight: shouldShowDetailPane ? '1px solid var(--nv-border-subtle)' : 'none',
          transition: 'flex 300ms var(--nv-ease-enter)'
        }}
      >
        {visualizationPane}
      </div>

      {shouldShowDetailPane && (
        <div
          aria-label="Detail pane"
          style={{
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 400  // Ensure packet list is usable
          }}
        >
          {detailPane}
        </div>
      )}
    </div>
  )
}
```

#### 3. Add Minimum Window Size Warning

**File:** `src/renderer/src/components/AppShell.tsx`

```tsx
const { width } = useWindowSize()
const isWindowTooSmall = width < 640

return (
  <div style={{...}}>
    {isWindowTooSmall && (
      <div
        style={{
          position: 'fixed',
          top: 52,
          left: 0,
          right: 0,
          padding: 8,
          backgroundColor: 'var(--nv-status-warning)',
          color: '#000',
          textAlign: 'center',
          fontSize: 12,
          zIndex: 1000
        }}
      >
        Window too small. Minimum width: 640px for optimal experience.
      </div>
    )}
    {/* Rest of app */}
  </div>
)
```

---

## Testing Plan

### Visual Depth Testing

1. Compare before/after screenshots
2. Verify shadows visible in both light/dark modes
3. Check grid texture is visible
4. Confirm surface layers are distinct

### Responsive Testing

1. Test at 640px (minimum)
2. Test at 768px (half-screen)
3. Test at 1024px (medium)
4. Test at 1280px (design target)
5. Test at 1920px (full HD)
6. Test window resizing (smooth transitions)

### Regression Testing

1. Verify all features still work
2. Check focus mode still works
3. Verify packet list scrolling
4. Test packet detail inspector
5. Verify all visualizations render

---

## Risk Assessment

### Phase 1 (Enhanced Visual Depth)

- **Risk:** Very Low
- **Breaking:** None
- **Reversible:** Yes (just revert CSS values)
- **Testing:** Visual inspection only

### Phase 2 (Responsive Layout)

- **Risk:** Low
- **Breaking:** Minimal (only at < 768px width)
- **Reversible:** Yes (revert MainLayout)
- **Testing:** Resize window, verify no crashes

---

## Recommendation

**Implement Phase 1 immediately:**

- Stronger shadows
- Better surface contrast
- Visible grid texture
- Takes 15 minutes
- Zero risk

**Then evaluate Phase 2:**

- If users report split-screen issues → implement
- If current layout works for users → skip
- Can always add later

**Skip Phase 3 for now:**

- Complex to implement
- Not critical for MVP
- Can be future enhancement
