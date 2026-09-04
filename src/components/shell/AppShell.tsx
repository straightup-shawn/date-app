import type { ReactNode } from 'react'
import { FlowDock } from './FlowDock'

interface AppShellProps {
  children: ReactNode
  /** Hide/keep the dock static on immersive screens (e.g. Date Pass map). */
  hideDock?: boolean
  disableDockMinimize?: boolean
}

/**
 * App-wide layout. Content is the product; the dock floats above it.
 * Reserves bottom space so content never hides under the floating dock.
 */
export function AppShell({ children, hideDock, disableDockMinimize }: AppShellProps) {
  return (
    <div
      className="mx-auto min-h-[100dvh] w-full max-w-[520px]"
      style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}
    >
      {children}
      {!hideDock && <FlowDock disableMinimize={disableDockMinimize} />}
    </div>
  )
}
