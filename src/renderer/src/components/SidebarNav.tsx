import { BookOpen, Radio, Settings, Trophy } from 'lucide-react'
import type React from 'react'
import { useNetVisStore, type AppPage } from '../store'

const TOP_NAV_ITEMS: Array<{ page: AppPage; label: string; icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }> }> = [
  { page: 'capture', label: 'Capture', icon: Radio },
  { page: 'learn', label: 'Learn', icon: BookOpen },
  { page: 'challenges', label: 'Challenges', icon: Trophy }
]

const BOTTOM_NAV_ITEMS: Array<{ page: AppPage; label: string; icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }> }> = [
  { page: 'settings', label: 'Settings', icon: Settings }
]

function NavButton({
  page,
  label,
  icon: Icon,
  isActive,
  onClick
}: {
  page: AppPage
  label: string
  icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>
  isActive: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className="nv-focus"
      style={{
        minHeight: 56,
        width: '100%',
        border: '1px solid transparent',
        borderColor: isActive ? 'var(--nv-border-default)' : 'transparent',
        borderRadius: 'var(--nv-radius-md)',
        backgroundColor: isActive ? 'var(--nv-bg-surface-2)' : 'transparent',
        color: isActive ? 'var(--nv-text-primary)' : 'var(--nv-text-tertiary)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        cursor: 'pointer',
        fontFamily: 'var(--font-ui)',
        fontSize: page === 'challenges' ? 8.5 : 9.5,
        fontWeight: isActive ? 600 : 500,
        lineHeight: 1,
        transition: 'all 0.15s ease',
        boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none'
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'var(--nv-bg-surface-1)'
          e.currentTarget.style.color = 'var(--nv-text-secondary)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.color = 'var(--nv-text-tertiary)'
        }
      }}
    >
      <Icon size={18} aria-hidden />
      <span>{label}</span>
    </button>
  )
}

/**
 * Persistent left navigation for the app shell.
 * Top items: capture, learn, challenges.
 * Bottom item: settings (pushed to bottom via flex spacer).
 */
export function SidebarNav(): React.JSX.Element {
  const activePage = useNetVisStore((s) => s.activePage)
  const setActivePage = useNetVisStore((s) => s.setActivePage)

  return (
    <nav
      aria-label="Primary navigation"
      style={{
        width: 64,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 6,
        padding: '12px 6px',
        backgroundColor: 'var(--nv-bg-base)',
        borderRight: '1px solid var(--nv-border-subtle)'
      }}
    >
      {TOP_NAV_ITEMS.map((item) => (
        <NavButton
          key={item.page}
          page={item.page}
          label={item.label}
          icon={item.icon}
          isActive={activePage === item.page}
          onClick={() => setActivePage(item.page)}
        />
      ))}

      {/* Spacer pushes settings to the bottom */}
      <div style={{ flex: 1 }} aria-hidden />

      <div
        aria-hidden
        style={{
          height: 1,
          margin: '2px 4px 6px',
          backgroundColor: 'var(--nv-border-subtle)'
        }}
      />

      {BOTTOM_NAV_ITEMS.map((item) => (
        <NavButton
          key={item.page}
          page={item.page}
          label={item.label}
          icon={item.icon}
          isActive={activePage === item.page}
          onClick={() => setActivePage(item.page)}
        />
      ))}
    </nav>
  )
}
