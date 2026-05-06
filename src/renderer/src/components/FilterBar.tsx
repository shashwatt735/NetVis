import { AlertTriangle, ChevronDown, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { useNetVisStore } from '../store'
import { HelpIcon } from './HelpIcon'
import { Input } from './ui/input'

const COMMON_FILTERS = [
  { label: 'TCP packets', expression: 'proto == TCP', hint: 'Connections and handshakes' },
  { label: 'DNS lookups', expression: 'proto == DNS', hint: 'Name queries and responses' },
  { label: 'UDP packets', expression: 'proto == UDP', hint: 'Datagrams and DNS transport' },
  { label: 'ARP requests', expression: 'proto == ARP', hint: 'Local network address discovery' },
  { label: 'ICMP packets', expression: 'proto == ICMP', hint: 'Ping and network diagnostics' },
  { label: 'HTTPS traffic', expression: 'port == 443', hint: 'Encrypted web service port' },
  { label: 'HTTP traffic', expression: 'port == 80', hint: 'Plain web service port' },
  { label: 'DNS service port', expression: 'port == 53', hint: 'Queries by port' }
]

/**
 * Filter expression input wired to store.setFilter().
 * Req 9.1-9.5, 20.5, 20.1
 */
export function FilterBar(): React.JSX.Element {
  const filterExpression = useNetVisStore((s) => s.filterExpression)
  const filterError = useNetVisStore((s) => s.filterError)
  const setFilter = useNetVisStore((s) => s.setFilter)
  const [isOpen, setIsOpen] = useState(false)
  const [draftFilter, setDraftFilter] = useState(filterExpression)

  useEffect(() => {
    setDraftFilter(filterExpression)
  }, [filterExpression])

  const suggestions = useMemo(() => {
    const query = draftFilter.trim().toLowerCase()
    if (!query) return COMMON_FILTERS
    return COMMON_FILTERS.filter((filter) => {
      return (
        filter.label.toLowerCase().includes(query) ||
        filter.expression.toLowerCase().includes(query) ||
        filter.hint.toLowerCase().includes(query)
      )
    })
  }, [draftFilter])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDraftFilter(e.target.value)
      setIsOpen(true)
    },
    []
  )

  const handleClear = useCallback(() => {
    setDraftFilter('')
    setFilter('')
    setIsOpen(true)
  }, [setFilter])

  const hasError =
    filterError !== null &&
    filterExpression.trim().length > 0 &&
    draftFilter.trim() === filterExpression.trim()

  return (
    <div
      style={{
        width: '100%',
        minWidth: 0,
        maxWidth: 'none',
        position: 'relative'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 30 }}>
        <div
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setIsOpen(false)
            }
          }}
          style={{ position: 'relative', flex: 1, minWidth: 0 }}
        >
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
            value={draftFilter}
            onChange={handleChange}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setIsOpen(false)
              if (event.key === 'Enter') {
                setFilter(draftFilter.trim())
                setIsOpen(false)
              }
            }}
            placeholder="Filter packets..."
            aria-label="Filter packets"
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            aria-controls="filter-suggestions"
            aria-invalid={hasError}
            aria-describedby={hasError ? 'filter-error' : undefined}
            data-help-id="filter-bar"
            className="font-mono"
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: 12,
              height: 30,
              paddingLeft: 30,
              paddingRight: 54,
              backgroundColor: 'var(--input-background)',
              borderColor: hasError ? 'var(--nv-status-error)' : undefined
            }}
          />
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            aria-label="Show common packet filters"
            aria-expanded={isOpen}
            aria-controls="filter-suggestions"
            className="nv-focus"
            style={{
              position: 'absolute',
              right: draftFilter ? 28 : 6,
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
            <ChevronDown size={13} aria-hidden />
          </button>
          {draftFilter && (
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
          {isOpen && (
            <div
              id="filter-suggestions"
              role="listbox"
              aria-label="Common packet filters"
              style={{
                position: 'absolute',
                top: 34,
                left: 0,
                right: 0,
                zIndex: 'var(--nv-z-dropdown)',
                display: 'grid',
                gap: 2,
                padding: 4,
                border: '1px solid var(--nv-border-default)',
                borderRadius: 'var(--nv-radius-lg)',
                backgroundColor: 'var(--nv-bg-surface-1)',
                boxShadow: 'var(--nv-shadow-overlay)'
              }}
            >
              {suggestions.length > 0 ? (
                suggestions.map((filter) => (
                  <button
                    key={filter.expression}
                    type="button"
                    role="option"
                    aria-selected={filterExpression.trim() === filter.expression}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setFilter(filter.expression)
                      setDraftFilter(filter.expression)
                      setIsOpen(false)
                    }}
                    style={{
                      minHeight: 38,
                      display: 'grid',
                      gridTemplateColumns: 'minmax(96px, 0.72fr) minmax(0, 1fr)',
                      alignItems: 'center',
                      gap: 10,
                      padding: '6px 8px',
                      border: 'none',
                      borderRadius: 'var(--nv-radius-md)',
                      backgroundColor:
                        filterExpression.trim() === filter.expression
                          ? 'var(--nv-accent-dim)'
                          : 'transparent',
                      color: 'var(--nv-text-primary)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-ui)',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.backgroundColor = 'var(--nv-bg-surface-2)'
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.backgroundColor =
                        filterExpression.trim() === filter.expression
                          ? 'var(--nv-accent-dim)'
                          : 'transparent'
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 650 }}>{filter.label}</span>
                    <span
                      style={{
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: 'var(--nv-text-secondary)',
                        fontFamily: 'var(--font-data)',
                        fontSize: 11
                      }}
                    >
                      {filter.expression}
                    </span>
                  </button>
                ))
              ) : (
                <div
                  role="status"
                  style={{
                    padding: '8px 10px',
                    color: 'var(--nv-text-secondary)',
                    fontSize: 12
                  }}
                >
                  Press Enter to apply this custom filter.
                </div>
              )}
            </div>
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
