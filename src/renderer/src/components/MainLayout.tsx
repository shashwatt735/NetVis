import type React from 'react'
import { useNetVisStore } from '../store'

interface MainLayoutProps {
  visualizationPane: React.ReactNode
  detailPane: React.ReactNode
}

/**
 * Two-column layout: VisualizationPane (≥40% at ≥1280px) + DetailPane.
 * Supports Focus Visualization mode (toggleFocusVisualization).
 * Req 24.1, 24.2, 24.6
 */
export function MainLayout({ visualizationPane, detailPane }: MainLayoutProps): React.JSX.Element {
  const focusVisualization = useNetVisStore((s) => s.focusVisualization)

  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        minHeight: 0
      }}
    >
      {/* VisualizationPane — ≥40% at ≥1280px; 100% in focus mode */}
      <div
        aria-label="Visualization pane"
        style={{
          flex: focusVisualization ? '1 1 100%' : '0 0 42%',
          minWidth: focusVisualization ? '100%' : 320,
          maxWidth: focusVisualization ? '100%' : '60%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRight: focusVisualization ? 'none' : '1px solid var(--nv-border-subtle)',
          transition: 'flex var(--nv-duration-panel) var(--nv-ease-enter)'
        }}
      >
        {visualizationPane}
      </div>

      {/* DetailPane — hidden in focus mode */}
      {!focusVisualization && (
        <div
          aria-label="Detail pane"
          style={{
            flex: '1 1 58%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0
          }}
        >
          {detailPane}
        </div>
      )}
    </div>
  )
}
