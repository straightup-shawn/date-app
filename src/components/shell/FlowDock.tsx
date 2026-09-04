import { NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Compass, PlusCircle, Bookmark } from 'lucide-react'
import { cn } from '@/lib/cn'
import { springDock } from '@/lib/motion'
import { useFlowDockBehavior } from '@/lib/useFlowDockBehavior'

const ITEMS = [
  { to: '/', label: 'Explore', Icon: Compass, end: true },
  { to: '/create', label: 'Create', Icon: PlusCircle, end: false },
  { to: '/saved', label: 'My Passes', Icon: Bookmark, end: false },
]

/**
 * Floating capsule dock (Section 2A.2). Minimizes rather than disappears;
 * always recoverable. Sits above the device safe area, never imitates the
 * OS home indicator.
 */
export function FlowDock({ disableMinimize }: { disableMinimize?: boolean }) {
  const location = useLocation()
  const { expanded, expand } = useFlowDockBehavior({
    routeKey: location.pathname,
    disableMinimize,
  })

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
      style={{ bottom: 'max(10px, env(safe-area-inset-bottom))' }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {expanded ? (
          <motion.nav
            key="expanded"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={springDock}
            aria-label="Primary"
            className="flow-material pointer-events-auto flex w-full max-w-[420px] items-center gap-1 rounded-capsule p-1.5"
          >
            {ITEMS.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-capsule px-2 py-1 text-micro font-semibold',
                    isActive ? 'text-accent' : 'text-text-secondary',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={20} strokeWidth={isActive ? 2.4 : 1.9} aria-hidden />
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </motion.nav>
        ) : (
          <motion.button
            key="minimized"
            type="button"
            onClick={expand}
            aria-label="Show navigation"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 0.85, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={springDock}
            className="flow-material pointer-events-auto flex h-[32px] w-[60px] items-center justify-center rounded-capsule"
          >
            <span className="h-1.5 w-6 rounded-full bg-accent" aria-hidden />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
