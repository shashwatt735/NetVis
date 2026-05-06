import { BookOpen, Radio, Settings, Trophy } from 'lucide-react'
import type React from 'react'
import { useNetVisStore, type AppPage } from '../store'

type NavIcon = React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>

const TOP_NAV_ITEMS: Array<{ page: AppPage; label: string; icon: NavIcon }> = [
  { page: 'capture', label: 'Capture', icon: Radio },
  { page: 'learn', label: 'Learn', icon: BookOpen },
  { page: 'challenges', label: 'Challenges', icon: Trophy }
]

const BOTTOM_NAV_ITEMS: Array<{ page: AppPage; label: string; icon: NavIcon }> = [
  { page: 'settings', label: 'Settings', icon: Settings }
]

function NavButton({
  label,
  icon: Icon,
  isActive,
  onClick
}: {
  label: string
  icon: NavIcon
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
        position: 'relative',
        minHeight: 62,
        width: '100%',
        border: 'none',
        borderRadius: 'var(--nv-radius-md)',
        backgroundColor: isActive ? 'var(--nv-bg-surface-2)' : 'transparent',
        color: isActive ? 'var(--nv-text-primary)' : 'var(--nv-text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '7px 5px',
        cursor: 'pointer',
        fontFamily: 'var(--font-ui)',
        fontSize: label === 'Challenges' ? 10 : 10.5,
        fontWeight: isActive ? 600 : 500,
        lineHeight: 1.15,
        transition:
          'background-color var(--nv-duration-fast) var(--nv-ease-enter), color var(--nv-duration-fast) var(--nv-ease-enter), box-shadow var(--nv-duration-fast) var(--nv-ease-enter)',
        boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none'
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'var(--nv-bg-surface-1)'
          e.currentTarget.style.color = 'var(--nv-text-primary)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.color = 'var(--nv-text-secondary)'
        }
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 10,
          bottom: 10,
          width: 3,
          borderRadius: 999,
          backgroundColor: isActive ? 'var(--nv-accent)' : 'transparent'
        }}
      />
      <span
        style={{
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          paddingLeft: 3
        }}
      >
        <span
          style={{
            width: 30,
            height: 28,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 'var(--nv-radius-md)',
            color: isActive ? 'var(--nv-accent)' : 'currentColor',
            backgroundColor: isActive ? 'var(--nv-accent-dim)' : 'transparent'
          }}
        >
          <Icon size={18} aria-hidden />
        </span>
        <span
          style={{
            width: 72,
            textAlign: 'center',
            whiteSpace: 'nowrap',
            color: isActive ? 'var(--nv-text-primary)' : 'currentColor'
          }}
        >
          {label}
        </span>
      </span>
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
        width: 92,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 8,
        padding: '12px 8px',
        backgroundColor: 'var(--nv-bg-base)',
        borderRight: '1px solid var(--nv-border-subtle)'
      }}
    >
      {TOP_NAV_ITEMS.map((item) => (
        <NavButton
          key={item.page}
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
          label={item.label}
          icon={item.icon}
          isActive={activePage === item.page}
          onClick={() => setActivePage(item.page)}
        />
      ))}
    </nav>
  )
}
