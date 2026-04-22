import type React from 'react'
import { useNetVisStore } from '../store'
import { Button } from './ui/button'

/**
 * Container for all visualization components (Protocol_Chart, Timeline, etc.).
 * Includes Focus Visualization toggle button.
 * Req 24.1, 24.2, 24.6
 */
export function VisualizationPane({ children }: { children?: React.ReactNode }): React.JSX.Element {
  const focusVisualization = useNetVisStore((s) => s.focusVisualization)
  const toggleFocusVisualization = useNetVisStore((s) => s.toggleFocusVisualization)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          borderBottom: '1px solid var(--nv-border-subtle)',
          flexShrink: 0
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-ui)',
            fontWeight: 500,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--nv-text-tertiary)'
          }}
        >
          Visualizations
        </span>
        <Button
          size="sm"
          variant={focusVisualization ? 'default' : 'outline'}
          onClick={toggleFocusVisualization}
          aria-label={
            focusVisualization ? 'Exit focus visualization mode' : 'Enter focus visualization mode'
          }
          aria-pressed={focusVisualization}
          style={{
            height: 'calc(var(--nv-control-height) - 4px)',
            padding: '0 var(--nv-space-2)',
            fontSize: 'var(--nv-text-label)',
            fontWeight: 600,
            borderColor: focusVisualization ? 'var(--proto-tcp)' : undefined,
            backgroundColor: focusVisualization ? 'var(--proto-tcp)' : undefined,
            color: focusVisualization ? '#fff' : undefined
          }}
        >
          {focusVisualization ? 'Exit Focus Mode' : 'Focus Mode'}
        </Button>
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        {children ?? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--nv-text-tertiary)',
              fontSize: 13,
              fontFamily: 'var(--font-ui)',
              textAlign: 'center'
            }}
          >
            Visualizations will appear here once packets are captured.
          </div>
        )}
      </div>
    </div>
  )
}
