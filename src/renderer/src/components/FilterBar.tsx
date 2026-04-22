import { AlertTriangle, Search, X } from 'lucide-react'
import { useCallback } from 'react'
import type React from 'react'
import { useNetVisStore } from '../store'
import { HelpIcon } from './HelpIcon'
import { Input } from './ui/input'

/**
 * Filter expression input wired to store.setFilter().
 * Req 9.1-9.5, 20.5, 20.1
 */
export function FilterBar(): React.JSX.Element {
  const filterExpression = useNetVisStore((s) => s.filterExpression)
  const filterError = useNetVisStore((s) => s.filterError)
  const setFilter = useNetVisStore((s) => s.setFilter)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilter(e.target.value)
    },
    [setFilter]
  )

  const handleClear = useCallback(() => {
    setFilter('')
  }, [setFilter])

  const hasError = filterError !== null && filterExpression.length > 0

  return (
    <div
      style={{
        width: 'clamp(260px, 34vw, 430px)',
        minWidth: 240,
        maxWidth: 430,
        position: 'relative'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 30 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <Search
            aria-hidden
            size={14}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--nv-text-tertiary)',
              pointerEvents: 'none',
              zIndex: 1
            }}
          />
          <Input
            type="text"
            value={filterExpression}
            onChange={handleChange}
            placeholder="Filter: proto == TCP"
            aria-label="Filter packets"
            aria-invalid={hasError}
            aria-describedby={hasError ? 'filter-error' : undefined}
            data-help-id="filter-bar"
            className="font-mono"
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: 12,
              height: 30,
              paddingLeft: 30,
              paddingRight: 30,
              backgroundColor: 'var(--input-background)',
              borderColor: hasError ? 'var(--nv-status-error)' : undefined
            }}
          />
          {filterExpression && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear filter"
              style={{
                position: 'absolute',
                right: 6,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 18,
                height: 18,
                background: 'none',
                border: 'none',
                borderRadius: 'var(--nv-radius-sm)',
                cursor: 'pointer',
                color: 'var(--nv-text-tertiary)',
                lineHeight: 1
              }}
            >
              <X size={12} aria-hidden />
            </button>
          )}
        </div>
        <HelpIcon helpId="filter-bar" side="bottom" />
      </div>

      {hasError && (
        <div
          id="filter-error"
          role="alert"
          style={{
            position: 'absolute',
            top: 34,
            left: 0,
            right: 28,
            zIndex: 'var(--nv-z-tooltip)',
            display: 'inline-flex',
            alignItems: 'flex-start',
            gap: 6,
            padding: '6px 8px',
            borderRadius: 'var(--nv-radius-md)',
            border: '1px solid var(--nv-status-error)',
            backgroundColor: 'var(--nv-bg-surface-1)',
            boxShadow: 'var(--nv-shadow-md)',
            fontSize: 11,
            lineHeight: 1.35,
            color: 'var(--nv-status-error)',
            fontFamily: 'var(--font-ui)'
          }}
        >
          <AlertTriangle size={12} aria-hidden style={{ marginTop: 1, flexShrink: 0 }} />
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{filterError}</span>
        </div>
      )}
    </div>
  )
}
