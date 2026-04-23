# UI Enhancement Opportunities

**Date:** 2026-04-23  
**Status:** Recommendations for Visual Polish

## Overview

This document identifies specific areas where NetVis can be visually enhanced to match the polish and sophistication of the original Figma design system. These recommendations build on the foundational depth hierarchy established in `DESIGN_SYSTEM_RESTORATION.md`.

---

## 1. PacketList Enhancements

### Current State

- Flat header with minimal visual weight
- Row hover states are functional but subtle
- No visual distinction between header and content area

### Recommended Improvements

#### A. Enhanced Header Visual Weight

**Location:** `PacketList.tsx` - `PacketListHeader` component

```tsx
<div
  aria-hidden="true"
  style={{
    display: 'grid',
    gridTemplateColumns: '110px 1fr 1fr 60px 60px',
    alignItems: 'center',
    height: 32, // Increased from 28
    padding: '0 12px',
    gap: 8,
    backgroundColor: 'var(--nv-bg-surface-2)',
    borderBottom: '1px solid var(--nv-border-default)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)', // Add subtle shadow
    flexShrink: 0,
    position: 'sticky',
    top: 0,
    zIndex: 10
  }}
>
```

**Impact:** Creates visual separation between header and scrolling content, adds professional polish.

#### B. Row Hover Enhancement

**Location:** `PacketList.tsx` - `PacketRow` component

Add hover state:

```tsx
'&:hover': {
  backgroundColor: isSelected
    ? dim
    : 'var(--nv-bg-surface-2)',
  borderLeftColor: color,
  borderLeftWidth: '2px'
}
```

**Impact:** Stronger hover feedback improves scannability and interaction confidence.

#### C. Alternating Row Background (Optional)

For dense packet lists, consider subtle zebra striping:

```tsx
backgroundColor: isSelected ? dim : index % 2 === 0 ? 'transparent' : 'rgba(0, 0, 0, 0.02)' // Very subtle
```

**Impact:** Improves row tracking in long lists.

---

## 2. PacketDetailInspector Enhancements

### Current State

- Clean collapsible layer structure
- Functional hex strip
- Minimal visual hierarchy between layers

### Recommended Improvements

#### A. Layer Header Enhancement

**Location:** `PacketDetailInspector.tsx` - `LayerSection` component

```tsx
<CollapsibleTrigger
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    padding: `6px 12px 6px ${12 + depth * 16}px`, // Increased vertical padding
    backgroundColor: dim,
    borderBottom: '1px solid var(--nv-border-subtle)',
    borderLeft: `3px solid ${color}`,
    boxShadow: open ? 'inset 0 1px 2px rgba(0, 0, 0, 0.05)' : 'none', // Subtle inset when open
    cursor: 'pointer',
    outline: 'none',
    textAlign: 'left',
    borderRadius: 0,
    transition: 'all 150ms ease'
  }}
>
```

**Impact:** Adds depth perception to open/closed states.

#### B. Field Row Hover State

**Location:** `PacketDetailInspector.tsx` - `FieldRow` component

```tsx
style={{
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 60px',
  alignItems: 'center',
  gap: 8,
  padding: `4px 12px 4px ${12 + depth * 16}px`, // Increased padding
  borderBottom: '1px solid var(--nv-border-subtle)',
  outline: 'none',
  cursor: 'default',
  transition: 'background-color 80ms ease',
  backgroundColor: 'transparent'
}}
onMouseEnter={(e) => {
  e.currentTarget.style.backgroundColor = 'var(--nv-bg-surface-2)'
  onHover({ offset: field.byteOffset, length: field.byteLength })
}}
onMouseLeave={(e) => {
  e.currentTarget.style.backgroundColor = 'transparent'
  onHover(null)
}}
```

**Impact:** Clearer visual feedback when hovering fields to see hex highlighting.

#### C. Hex Strip Enhancement

**Location:** `PacketDetailInspector.tsx` - `HexStrip` component

Add subtle grid background:

```tsx
<div
  aria-label="Hex byte strip"
  style={{
    borderTop: '1px solid var(--nv-border-subtle)',
    padding: '10px 12px', // Increased padding
    backgroundColor: 'var(--nv-bg-surface-2)',
    backgroundImage: 'linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px)',
    backgroundSize: '100% 16px', // Row grid lines
    flexShrink: 0
  }}
>
```

**Impact:** Technical aesthetic that reinforces the hex dump nature.

---

## 3. StatusBar Enhancements

### Current State

- Functional status messages
- Minimal visual presence

### Recommended Improvements

#### A. Add Subtle Top Shadow

**Location:** `StatusBar.tsx`

```tsx
<footer
  role="contentinfo"
  aria-label="Status bar"
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    height: 32,
    padding: '0 16px',
    backgroundColor: 'var(--nv-bg-surface-2)',
    borderTop: '1px solid var(--nv-border-subtle)',
    boxShadow: '0 -1px 3px rgba(0, 0, 0, 0.06)', // Subtle top shadow
    flexShrink: 0,
    overflow: 'hidden'
  }}
>
```

**Impact:** Creates visual lift, separates status bar from content area.

#### B. Enhanced Buffer Occupancy Visualization

Add a mini progress indicator:

```tsx
function BufferOccupancy(): React.JSX.Element {
  const { count, capacity, percentage } = useNetVisStore((s) => s.bufferStats)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        aria-label={`Buffer: ${count} of ${capacity} packets (${Math.round(percentage)}%)`}
        style={{
          fontSize: 11,
          fontFamily: 'var(--font-data)',
          color: 'var(--nv-text-tertiary)',
          whiteSpace: 'nowrap',
          flexShrink: 0
        }}
      >
        {count.toLocaleString()} / {capacity.toLocaleString()} pkts
      </span>
      <div
        style={{
          width: 60,
          height: 4,
          backgroundColor: 'var(--nv-bg-surface-3)',
          borderRadius: 2,
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: percentage > 90 ? 'var(--nv-status-warning)' : 'var(--proto-tcp)',
            transition: 'width 300ms ease, background-color 300ms ease'
          }}
        />
      </div>
    </div>
  )
}
```

**Impact:** Visual at-a-glance buffer status without reading numbers.

---

## 4. VisualizationPanel Enhancements

### Current State

- Clean panel structure
- Functional but minimal visual presence

### Recommended Improvements

#### A. Add Subtle Panel Shadow

**Location:** `VisualizationPanel.tsx`

```tsx
<div
  style={{
    padding: 'var(--nv-panel-padding)',
    background: 'var(--nv-bg-surface-1)',
    border: '1px solid var(--nv-border-subtle)',
    borderRadius: 'var(--nv-radius-lg)',
    boxShadow: 'var(--nv-shadow-sm)', // Add subtle shadow
    transition: 'box-shadow 200ms ease'
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.boxShadow = 'var(--nv-shadow-md)'
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.boxShadow = 'var(--nv-shadow-sm)'
  }}
>
```

**Impact:** Panels feel more elevated and interactive.

#### B. Enhanced Title Typography

```tsx
<div
  style={{
    fontFamily: 'var(--font-ui)', // Changed from font-data
    fontSize: 'var(--nv-text-label)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em', // Increased from 0.1em
    fontWeight: 600, // Added weight
    color: 'var(--nv-text-secondary)' // Changed from tertiary
  }}
>
  {title}
</div>
```

**Impact:** Stronger visual hierarchy, easier to scan multiple panels.

---

## 5. Toolbar Enhancements

### Current State

- Functional grouping with separators (from previous fix)
- Flat appearance

### Recommended Improvements

#### A. Add Subtle Toolbar Shadow

**Location:** `Toolbar.tsx`

```tsx
<header
  role="banner"
  aria-label="Application toolbar"
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 52,
    padding: '0 12px',
    backgroundColor: 'var(--nv-bg-surface-2)',
    borderBottom: '1px solid var(--nv-border-default)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)', // Add shadow
    flexShrink: 0,
    overflow: 'visible',
    zIndex: 100 // Ensure toolbar stays above content
  }}
>
```

**Impact:** Creates visual hierarchy, toolbar feels more prominent.

#### B. Enhanced Button States

Add consistent hover/active states to all toolbar buttons:

```tsx
// For primary action buttons (Start Live)
style={{
  ...controlButtonBaseStyle,
  backgroundColor: 'var(--proto-tcp)',
  color: '#fff',
  border: 'none',
  transition: 'all 150ms ease',
  boxShadow: '0 1px 2px rgba(59, 130, 246, 0.3)'
}}
onMouseEnter={(e) => {
  e.currentTarget.style.backgroundColor = '#2563eb' // Darker blue
  e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.4)'
}}
onMouseLeave={(e) => {
  e.currentTarget.style.backgroundColor = 'var(--proto-tcp)'
  e.currentTarget.style.boxShadow = '0 1px 2px rgba(59, 130, 246, 0.3)'
}}
```

**Impact:** More responsive, polished interaction feedback.

---

## 6. VisualizationPane Enhancements

### Current State

- Functional focus mode toggle
- Minimal header presence

### Recommended Improvements

#### A. Enhanced Header

**Location:** `VisualizationPane.tsx`

```tsx
<div
  style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px', // Increased from 6px
    borderBottom: '1px solid var(--nv-border-default)', // Changed from subtle
    backgroundColor: 'var(--nv-bg-surface-2)', // Add background
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)', // Subtle shadow
    flexShrink: 0
  }}
>
```

**Impact:** Clearer visual separation, more professional appearance.

---

## 7. CaptureControls Enhancements

### Current State

- Functional button groups
- Protocol-colored buttons

### Recommended Improvements

#### A. Enhanced Button Group Container

**Location:** `CaptureControls.tsx`

For the speed selector container:

```tsx
<div
  className="flex items-center gap-2"
  style={{
    padding: '3px 6px', // Increased padding
    border: '1px solid var(--nv-border-default)', // Changed from subtle
    borderRadius: 'var(--nv-radius-md)',
    backgroundColor: 'var(--nv-bg-surface-1)', // Changed from surface-2
    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)' // Subtle inset
  }}
>
```

**Impact:** Better visual grouping, more tactile appearance.

---

## 8. FilterBar Enhancements

### Current State

- Functional search input
- Error state display

### Recommended Improvements

#### A. Enhanced Input Visual State

**Location:** `FilterBar.tsx`

```tsx
<Input
  type="text"
  value={filterExpression}
  onChange={handleChange}
  placeholder="Filter: proto == TCP"
  style={{
    fontFamily: 'var(--font-data)',
    fontSize: 12,
    height: 32, // Increased from 30
    paddingLeft: 32, // Increased from 30
    paddingRight: 32, // Increased from 30
    backgroundColor: 'var(--input-background)',
    borderColor: hasError ? 'var(--nv-status-error)' : 'var(--nv-border-default)',
    boxShadow: hasError ? '0 0 0 3px rgba(207, 34, 46, 0.1)' : '0 1px 2px rgba(0, 0, 0, 0.05)',
    transition: 'all 150ms ease'
  }}
  onFocus={(e) => {
    if (!hasError) {
      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'
      e.currentTarget.style.borderColor = 'var(--proto-tcp)'
    }
  }}
  onBlur={(e) => {
    if (!hasError) {
      e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)'
      e.currentTarget.style.borderColor = 'var(--nv-border-default)'
    }
  }}
/>
```

**Impact:** More prominent focus states, clearer interaction feedback.

---

## 9. InterfaceSelector Enhancements

### Current State

- Functional dropdown
- Error state handling

### Recommended Improvements

#### A. Enhanced Dropdown Visual State

**Location:** `InterfaceSelector.tsx`

Add visual indicator for recommended interface:

```tsx
<SelectItem key={iface.name} value={iface.name}>
  <span className="flex min-w-0 items-center gap-2">
    <span
      style={{
        width: 8, // Increased from 6
        height: 8, // Increased from 6
        borderRadius: '50%',
        flexShrink: 0,
        backgroundColor: iface.isUp ? 'var(--nv-status-success)' : 'var(--nv-text-tertiary)',
        boxShadow: iface.isUp ? '0 0 4px rgba(26, 127, 55, 0.4)' : 'none' // Glow effect for active
      }}
    />
    <span className="min-w-0">
      <span
        style={{
          display: 'block',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: isRecommended ? 600 : 400 // Bold recommended
        }}
      >
        {iface.displayName}
        {isRecommended && (
          <span
            style={{
              marginLeft: 6,
              fontSize: 10,
              color: 'var(--proto-tcp)',
              fontWeight: 500
            }}
          >
            ★ recommended
          </span>
        )}
      </span>
      {/* ... rest of item ... */}
    </span>
  </span>
</SelectItem>
```

**Impact:** Clearer guidance for interface selection.

---

## 10. Global Micro-Interactions

### Recommended Additions

#### A. Smooth Scroll Behavior

**Location:** `main.css`

```css
* {
  scroll-behavior: smooth;
}

@media (prefers-reduced-motion: reduce) {
  * {
    scroll-behavior: auto;
  }
}
```

#### B. Enhanced Focus Rings

**Location:** `theme.css`

```css
.nv-focus:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 3px rgba(59, 130, 246, 0.5),
    0 0 0 1px rgba(59, 130, 246, 0.8); /* Double ring */
  transition: box-shadow 150ms ease;
}
```

#### C. Subtle Transitions on All Interactive Elements

Add to all buttons, inputs, and interactive components:

```tsx
transition: 'all 150ms ease'
```

---

## 11. Typography Refinements

### Current State

- Functional typography
- Inconsistent weight usage

### Recommended Improvements

#### A. Establish Clear Type Scale

**Location:** `theme.css`

Add missing type scale tokens:

```css
:root {
  /* Typography scale */
  --nv-text-xs: 10px;
  --nv-text-sm: 11px;
  --nv-text-base: 13px;
  --nv-text-md: 14px;
  --nv-text-lg: 16px;
  --nv-text-xl: 18px;
  --nv-text-2xl: 24px;

  /* Font weights */
  --nv-font-normal: 400;
  --nv-font-medium: 500;
  --nv-font-semibold: 600;
  --nv-font-bold: 700;
}
```

#### B. Consistent Weight Application

- **Headers/Titles:** `--nv-font-semibold` (600)
- **Labels:** `--nv-font-medium` (500)
- **Body text:** `--nv-font-normal` (400)
- **Emphasis:** `--nv-font-bold` (700)

---

## 12. Color Refinements

### Recommended Improvements

#### A. Add Hover State Colors

**Location:** `theme.css`

```css
:root {
  /* Interactive state colors */
  --nv-hover-overlay: rgba(0, 0, 0, 0.04);
  --nv-active-overlay: rgba(0, 0, 0, 0.08);
  --nv-focus-ring: rgba(59, 130, 246, 0.5);
}

.dark {
  --nv-hover-overlay: rgba(255, 255, 255, 0.06);
  --nv-active-overlay: rgba(255, 255, 255, 0.12);
  --nv-focus-ring: rgba(88, 166, 255, 0.5);
}
```

---

## Implementation Priority

### High Impact (Implement First)

1. **PacketList header shadow** - Immediate visual improvement
2. **StatusBar top shadow** - Professional polish
3. **Toolbar shadow** - Establishes hierarchy
4. **VisualizationPanel shadows** - Depth perception
5. **Enhanced button hover states** - Better interaction feedback

### Medium Impact (Implement Second)

6. **PacketDetailInspector layer enhancements** - Improved usability
7. **FilterBar focus states** - Clearer interaction
8. **Buffer occupancy visualization** - Better at-a-glance status
9. **Typography refinements** - Consistency

### Low Impact (Polish Phase)

10. **Alternating row backgrounds** - Optional enhancement
11. **Hex strip grid background** - Aesthetic detail
12. **Interface selector enhancements** - Nice-to-have

---

## Testing Checklist

After implementing enhancements:

- [ ] Test in both light and dark modes
- [ ] Verify all hover states work correctly
- [ ] Check focus states with keyboard navigation
- [ ] Ensure shadows don't create visual clutter
- [ ] Verify performance with 10K+ packets
- [ ] Test on different screen sizes
- [ ] Validate accessibility (contrast ratios, focus indicators)
- [ ] Check with reduced motion preference enabled

---

## Conclusion

These enhancements focus on:

- **Depth perception** through shadows and layering
- **Interaction feedback** through hover/focus states
- **Visual hierarchy** through typography and spacing
- **Professional polish** through consistent micro-interactions

The goal is to match the sophistication of the original Figma design while maintaining NetVis's technical, educational character.

Each enhancement is incremental and can be implemented independently without breaking existing functionality.
