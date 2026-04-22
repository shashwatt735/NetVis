import type React from 'react'
import { MainLayout } from './MainLayout'
import { PacketDetailInspector } from './PacketDetailInspector'
import { PacketList } from './PacketList'
import { PacketFlowTimeline } from './PacketFlowTimeline'
import { ProtocolChart } from './ProtocolChart'
import { OSILayerDiagram } from './OSILayerDiagram'
import { ProtocolAnimations } from './ProtocolAnimations'
import { IPFlowMap } from './IPFlowMap'
import { BandwidthChart } from './BandwidthChart'
import { StatusBar } from './StatusBar'
import { Toolbar } from './Toolbar'
import { VisualizationPane } from './VisualizationPane'

interface AppShellProps {
  /** Slot for the packet list / detail pane content */
  detailPane?: React.ReactNode
  /** Slot for visualization components (charts, timeline, etc.) */
  visualizations?: React.ReactNode
}

/**
 * Root application shell: Toolbar → MainLayout (VisualizationPane + DetailPane) → StatusBar.
 * Req 24.1, 24.2, 24.6
 */
export function AppShell({ detailPane, visualizations }: AppShellProps): React.JSX.Element {
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

      <main
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          minHeight: 0
        }}
      >
        <MainLayout
          visualizationPane={
            <VisualizationPane>
              {visualizations ?? (
                <>
                  <ProtocolChart />
                  <PacketFlowTimeline />
                  <BandwidthChart />
                  <IPFlowMap />
                  <OSILayerDiagram />
                  <ProtocolAnimations />
                </>
              )}
            </VisualizationPane>
          }
          detailPane={
            detailPane ?? (
              <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <PacketList />
                </div>
                <PacketDetailInspector />
              </div>
            )
          }
        />
      </main>

      <StatusBar />
    </div>
  )
}
