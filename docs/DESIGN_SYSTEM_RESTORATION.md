# Design System Restoration

**Date:** 2026-04-23  
**Status:** Completed

## Problem Analysis

The NetVis UI degraded in quality, UX, and visual attractiveness compared to the original Figma design system during the porting process from the design system workspace to the main repository.

### Root Causes

1. **Missing Depth Hierarchy**
   - The design system defines a layered surface approach using `--nv-bg-base`, `--nv-bg-surface-1`, `--nv-bg-surface-2`, and `--nv-bg-surface-3`
   - These tokens were defined in `theme.css` but not consistently applied across the component hierarchy
   - Most containers inherited `--nv-bg-base`, creating a flat, monotonous appearance

2. **No Atmospheric Texture**
   - The original design likely included subtle grid patterns or technical textures
   - These atmospheric details were not ported, making the interface feel like a "flat void"

3. **Weak Visual Grouping**
   - The toolbar lacked visual separators between logical control clusters
   - This made the interface feel cluttered and harder to scan cognitively

4. **Missing Containment Boundaries**
   - Panels didn't have proper background differentiation
   - Content zones blended together without clear visual hierarchy

5. **Incomplete Design Token Application**
   - Design tokens were defined but not systematically applied during component implementation
   - The connection between the design system's intent and the component implementation was lost

## Solution: Five Strategic Changes

### Change 1: Grid Texture on Root Container

**Location:** `AppShell.tsx` root div

```tsx
backgroundImage: `linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
                 linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)`,
backgroundSize: '8px 8px'
```

**Impact:** Single highest-impact atmospheric change. Transforms the base layer from a flat void into a technical surface.

### Change 2: Surface-1 Container for VisualizationPane

**Location:** `AppShell.tsx` wrapping `<VisualizationPane>`

```tsx
<div
  style={{
    backgroundColor: 'var(--nv-bg-surface-1)',
    borderRight: '1px solid var(--nv-border-subtle)',
    height: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  }}
>
  <VisualizationPane>...</VisualizationPane>
</div>
```

**Impact:** Creates the first containment boundary, lifting the visualization rail one level above base.

### Change 3: Surface-2 for Detail Pane Wrapper

**Location:** `AppShell.tsx` outer div wrapping PacketList and PacketDetailInspector

```tsx
backgroundColor: 'var(--nv-bg-surface-2)'
```

**Impact:** Creates depth separation between the visualization zone and the packet workspace zone.

### Change 4: Surface-3 for PacketList Container

**Location:** `AppShell.tsx` inner div wrapping only `<PacketList />`

```tsx
backgroundColor: 'var(--nv-bg-surface-3)',
borderRight: '1px solid var(--nv-border-subtle)'
```

**Impact:** Makes the packet list the "most elevated" panel visually, which is correct since it's where the user's primary focus goes.

### Change 5: Toolbar Visual Grouping

**Location:** `Toolbar.tsx` between logical clusters

Added separators between four clusters:

- **Cluster A:** Brand + Interface Selector + Start Live
- **Cluster B:** Replay + Import + Export (Capture Controls)
- **Cluster C:** Filter Bar
- **Cluster D:** Challenges + Guide + Theme + Settings

```tsx
<div
  aria-hidden
  style={{
    width: '1px',
    height: '20px',
    backgroundColor: 'var(--nv-border-default)',
    alignSelf: 'center',
    flexShrink: 0
  }}
/>
```

**Impact:** Breaks the toolbar into scannable groups, reducing cognitive load.

## Visual Hierarchy Established

```
Base Layer (--nv-bg-base + grid texture)
├── Surface-1 (Visualization Pane)
│   └── Visualization components
├── Surface-2 (Detail Pane Wrapper)
│   ├── Surface-3 (Packet List) ← Primary focus
│   └── Packet Detail Inspector
└── Surface-2 (Toolbar with grouped separators)
```

## Design System Principles Applied

1. **Layered Elevation:** Each surface level represents a conceptual elevation in the UI hierarchy
2. **Atmospheric Foundation:** Subtle textures create technical sophistication without distraction
3. **Visual Grouping:** Separators reduce cognitive load by creating scannable clusters
4. **Focus Hierarchy:** The most elevated surface (surface-3) contains the primary user focus area

## Prevention Guidelines

To prevent design degradation in future development:

1. **Always Reference Design Tokens First**
   - Before implementing a component, review `theme.css` for applicable tokens
   - Don't use hardcoded colors or spacing values

2. **Maintain Surface Hierarchy**
   - Base layer: Application background
   - Surface-1: Primary containers (sidebars, main panels)
   - Surface-2: Secondary containers (toolbars, nested panels)
   - Surface-3: Content surfaces (lists, cards, primary focus areas)

3. **Apply Atmospheric Details Early**
   - Grid textures, subtle shadows, and borders should be part of the initial implementation
   - These details are not "polish" — they're foundational to the design language

4. **Group Related Controls**
   - Use visual separators to break toolbars and control panels into logical clusters
   - Each cluster should represent a distinct functional area

5. **Test Against Design System Reference**
   - Periodically compare the running application against the design system workspace
   - Look for missing textures, flat surfaces, and weak visual hierarchy

## Files Modified

- `netvis/src/renderer/src/components/AppShell.tsx`
- `netvis/src/renderer/src/components/Toolbar.tsx`

## Design System Authority

The canonical design system tokens are defined in:

- `netvis/src/renderer/src/assets/theme.css`

All components must reference these tokens rather than defining custom values.

## Next Steps

Consider these additional improvements:

1. **Audit All Components:** Review all components for consistent design token usage
2. **Shadow Application:** Ensure `--nv-shadow-*` tokens are applied to elevated surfaces
3. **Border Consistency:** Verify all borders use `--nv-border-subtle`, `--nv-border-default`, or `--nv-border-emphasis`
4. **Spacing Audit:** Replace hardcoded spacing with `--nv-space-*` tokens
5. **Typography Audit:** Ensure all text uses `--nv-text-*` tokens for color and `--font-ui` or `--font-data` for families

## Conclusion

The design degradation was not due to a poor design system, but rather incomplete application of the design system's tokens and principles during component implementation. The design system itself is production-ready; the issue was in the translation layer between design intent and code implementation.

By systematically applying the five strategic changes above, we've restored the visual hierarchy, atmospheric quality, and professional polish that the original design system intended.
