import type React from 'react'
import { CapturePage } from './CapturePage'
import { ChallengesPage } from './ChallengesPage'
import { LearnPage } from './LearnPage'
import { SettingsPage } from './SettingsPage'
import { SidebarNav } from './SidebarNav'
import { StatusBar } from './StatusBar'
import { Toolbar } from './Toolbar'
import { OnboardingHints } from './OnboardingHints'
import { useNetVisStore } from '../store'

function ActivePage(): React.JSX.Element {
  const activePage = useNetVisStore((s) => s.activePage)

  switch (activePage) {
    case 'learn':
      return <LearnPage />
    case 'challenges':
      return <ChallengesPage />
    case 'settings':
      return <SettingsPage />
    case 'capture':
    default:
      return <CapturePage />
  }
}

/**
 * Root application shell: page toolbar, persistent sidebar, workspace, status bar.
 */
export function AppShell(): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        backgroundColor: 'var(--nv-bg-base)',
        fontFamily: 'var(--font-ui)'
      }}
    >
      <Toolbar />

      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          minHeight: 0
        }}
      >
        <SidebarNav />
        <main
          aria-label="Page workspace"
          style={{
            flex: 1,
            display: 'flex',
            minWidth: 0,
            minHeight: 0,
            overflow: 'hidden'
          }}
        >
          <ActivePage />
        </main>
      </div>

      <StatusBar />
      <OnboardingHints />
    </div>
  )
}
