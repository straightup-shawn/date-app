// ============================================================
// Flow v7.1 — Flow Dock scroll behavior (Section 2A.2)
// Single reusable controller: minimize on downward scroll intent,
// expand on upward/near-top/route-change/visibility. Uses intent,
// not raw pixels, and resets the accumulator on direction change.
// ============================================================
import { useEffect, useRef, useState } from 'react'

interface Options {
  routeKey: string
  disableMinimize?: boolean
}

const DOWN_THRESHOLD = 24
const UP_THRESHOLD = 12
const NEAR_TOP = 48

export function useFlowDockBehavior({ routeKey, disableMinimize }: Options) {
  const [expanded, setExpanded] = useState(true)
  const lastY = useRef(0)
  const accum = useRef(0)
  const lastDir = useRef<'up' | 'down' | null>(null)

  // Expand on route change.
  useEffect(() => {
    setExpanded(true)
    accum.current = 0
  }, [routeKey])

  // Expand when the app regains visibility/focus.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') setExpanded(true)
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onVis)
    }
  }, [])

  useEffect(() => {
    if (disableMinimize) {
      setExpanded(true)
      return
    }

    const onScroll = () => {
      const y = window.scrollY
      const delta = y - lastY.current
      lastY.current = y

      if (y < NEAR_TOP) {
        setExpanded(true)
        accum.current = 0
        return
      }

      const dir: 'up' | 'down' = delta > 0 ? 'down' : 'up'
      if (dir !== lastDir.current) {
        accum.current = 0 // reset accumulator on direction change
        lastDir.current = dir
      }
      accum.current += Math.abs(delta)

      if (dir === 'down' && accum.current > DOWN_THRESHOLD) {
        setExpanded(false)
      } else if (dir === 'up' && accum.current > UP_THRESHOLD) {
        setExpanded(true)
      }
    }

    // Desktop: moving the pointer into the lower zone expands the dock.
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.clientY > window.innerHeight - 120) {
        setExpanded(true)
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pointermove', onPointerMove)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointermove', onPointerMove)
    }
  }, [disableMinimize])

  return { expanded, expand: () => setExpanded(true) }
}
