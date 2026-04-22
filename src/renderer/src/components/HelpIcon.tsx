import type React from 'react'
import { HelpCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import helpText from '../data/help-text.json'

type HelpTextKey = keyof typeof helpText

interface HelpEntry {
  label: string
  description: string
}

/**
 * A small "?" icon button that shows a tooltip with a plain-English
 * description of the adjacent control.
 *
 * Req 10.1, 20.1 — contextual help for every non-obvious UI control.
 *
 * @param helpId - Key from help-text.json identifying the control to explain.
 * @param side   - Tooltip placement (default: "top").
 */
export function HelpIcon({
  helpId,
  side = 'top'
}: {
  helpId: HelpTextKey
  side?: 'top' | 'bottom' | 'left' | 'right'
}): React.JSX.Element | null {
  const entry = helpText[helpId] as HelpEntry | undefined
  if (!entry) return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Help: ${entry.label}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            padding: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--nv-text-tertiary)',
            flexShrink: 0,
            borderRadius: '50%',
            transition: 'color 120ms ease'
          }}
          onMouseEnter={(e) => {
            ; (e.currentTarget as HTMLButtonElement).style.color = 'var(--nv-text-secondary)'
          }}
          onMouseLeave={(e) => {
            ; (e.currentTarget as HTMLButtonElement).style.color = 'var(--nv-text-tertiary)'
          }}
          onFocus={(e) => {
            ; (e.currentTarget as HTMLButtonElement).style.color = 'var(--nv-text-secondary)'
          }}
          onBlur={(e) => {
            ; (e.currentTarget as HTMLButtonElement).style.color = 'var(--nv-text-tertiary)'
          }}
        >
          <HelpCircle size={14} aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        style={{
          maxWidth: 320,
          lineHeight: 1.45,
          padding: '10px 12px',
          backgroundColor: 'var(--nv-bg-surface-2)',
          border: '1px solid var(--nv-border-emphasis)',
          boxShadow: 'var(--nv-shadow-overlay)'
        }}
        aria-label={entry.description}
      >
        <p
          style={{
            fontWeight: 600,
            marginBottom: 4,
            fontSize: 12,
            fontFamily: 'var(--font-ui)',
            color: 'var(--nv-text-primary)'
          }}
        >
          {entry.label}
        </p>
        <p style={{ fontSize: 12, fontFamily: 'var(--font-ui)', color: 'var(--nv-text-secondary)' }}>
          {entry.description}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
