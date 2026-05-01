# NetVis UI Reference

**Last updated:** 2026-05-02

This document consolidates the previous one-off UI, visual-depth, responsive-layout, scrollbar, enhancement, and visualization-status notes.

## Current UI Surfaces

NetVis uses a work-focused desktop layout:

- Sidebar navigation for Capture, Learn, Challenges, and Settings.
- Toolbar for interface selection, capture actions, filters, and utility controls.
- Capture page with packet list, detail inspector, and visualization panels.
- Status bar for capture state, packet rate, buffer status, and overflow notices.
- Settings page for appearance, buffer capacity, default interface, privacy notes, and logs.

## Visualization Inventory

| Component            | Status | Purpose                                                 |
| -------------------- | ------ | ------------------------------------------------------- |
| `ProtocolChart`      | Active | Protocol distribution and filtering.                    |
| `PacketFlowTimeline` | Active | Time-bucketed packet activity and time-range filtering. |
| `BandwidthChart`     | Active | Protocol-stacked byte volume over the capture window.   |
| `IPFlowMap`          | Active | Endpoint graph and node/edge-generated filters.         |
| `OSILayerDiagram`    | Active | Protocol-to-OSI-layer educational view.                 |
| `ProtocolAnimations` | Active | TCP, DNS, and ICMP step-through explanations.           |

Phase 2 visualizations are enabled by default through `VITE_PHASE=2`.

## Interface Selector UX

Interface rows should show a semantic label plus a recognizable adapter name:

```text
Ethernet - Realtek PCIe GbE Family Controller
VPN - Express TAP Adapter
Loopback - Adapter for loopback traffic capture
```

Rows may include badges such as:

- `Recommended`
- `Primary route`
- `Specialized`
- `Local only`
- `No address`
- `Local address hidden`

The UI must not show raw local IP or MAC addresses by default.

## Visual System

The visual system uses:

- Tokenized colors and spacing in `src/renderer/src/assets/theme.css`.
- Locked protocol color mapping in `src/renderer/src/constants/protocol-colors.ts`.
- Radix UI primitives wrapped in `src/renderer/src/components/ui/`.
- Surface hierarchy and subtle elevation for dense operational scanning.
- Custom scrollbar styling for consistency across scrollable panels.
- `warm-dark`, `dark`, `light`, and `system` themes.

## Responsive Behavior

The app is designed primarily for desktop and laptop use. Responsive behavior should preserve usability at narrower widths by:

- Allowing toolbar controls to wrap or compact without overlap.
- Maintaining stable packet-list and visualization dimensions.
- Showing a minimum-window warning when the layout becomes too constrained.
- Avoiding text clipping inside buttons, cards, toolbar controls, and dropdown rows.

## Accessibility Expectations

- Packet list supports keyboard navigation.
- Visualizations provide text alternatives or accessible summaries where practical.
- Help controls use tooltips with explicit labels.
- Color should not be the only way to distinguish protocol or state.
- Focus rings must remain visible.

## Historical Notes Consolidated

This file replaces the previous one-off UI notes:

- `ENHANCED_DEPTH_APPLIED.md`
- `REBUILD_TO_SEE_CHANGES.md`
- `RESPONSIVE_LAYOUT_COMPLETE.md`
- `UX_IMPROVEMENTS_IMPLEMENTED.md`
- `VISUALIZATION_STATUS.md`
- `docs/DESIGN_SYSTEM_RESTORATION.md`
- `docs/RESPONSIVE_LAYOUT_PLAN.md`
- `docs/SCROLLBAR_ANALYSIS.md`
- `docs/UI_ENHANCEMENT_OPPORTUNITIES.md`
- `docs/UI_Visualization_Inventory.md`
- `docs/VISUAL_IMPROVEMENTS_APPLIED.md`

Use this file for durable UI reference. Use `docs/PROJECT_STATUS.md` for implementation state and `docs/BUGFIX_REFERENCE.md` for bugfix history.
