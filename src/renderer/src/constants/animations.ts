// Animation timing constants — all durations in milliseconds.
// Under prefers-reduced-motion these are overridden to 0 via CSS custom properties.
// See src/renderer/src/assets/base.css for the @media override.

export const ANIMATION = {
  ROW_FADE_IN_MS: 200, // PKT-06: new Packet_List row fade-in (150–300 ms range)
  CHART_TRANSITION_MS: 300, // VIS-04: Protocol_Chart segment resize (200–400 ms range)
  PDI_SLIDE_IN_MS: 200, // PDI-01: detail panel slide-in (150–250 ms range)
  CAPTURE_PULSE_MS: 900 // Req 21.4: CaptureActiveIndicator CSS keyframe duration
} as const
