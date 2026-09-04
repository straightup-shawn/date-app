import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useMotionValue, type PanInfo } from 'framer-motion'
import { springSheet } from '@/lib/motion'

export type SnapPoint = 'peek' | 'half' | 'full'

interface SheetProps {
  snap: SnapPoint
  onSnapChange: (snap: SnapPoint) => void
  children: ReactNode
  /** viewport height fraction for each snap (0..1 of usable height). */
  ratios?: Record<SnapPoint, number>
}

/**
 * Draggable content sheet over the map (Section 2A.5).
 * Physically coherent with the drag gesture; never blocks input while animating.
 * Uses dynamic viewport height (dvh) — not 100vh — for mobile correctness.
 */
export function Sheet({ snap, onSnapChange, children, ratios }: SheetProps) {
  const r = ratios ?? { peek: 0.28, half: 0.55, full: 0.92 }
  const [vh, setVh] = useState(() => window.innerHeight)
  const y = useMotionValue(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onResize = () => setVh(window.visualViewport?.height ?? window.innerHeight)
    window.visualViewport?.addEventListener('resize', onResize)
    window.addEventListener('resize', onResize)
    return () => {
      window.visualViewport?.removeEventListener('resize', onResize)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const heightFor = (s: SnapPoint) => Math.round(vh * r[s])
  const targetHeight = heightFor(snap)

  useEffect(() => {
    // Reset drag offset when the snap point changes; height animates via layout.
    y.set(0)
  }, [snap, y])

  const handleDragEnd = (_e: unknown, info: PanInfo) => {
    const velocity = info.velocity.y
    const offset = info.offset.y
    const order: SnapPoint[] = ['peek', 'half', 'full']
    const idx = order.indexOf(snap)

    // Determine direction from offset + velocity.
    if (offset < -60 || velocity < -400) {
      onSnapChange(order[Math.min(order.length - 1, idx + 1)])
    } else if (offset > 60 || velocity > 400) {
      onSnapChange(order[Math.max(0, idx - 1)])
    }
    // Otherwise the drag stays within constraints (top/bottom = 0), so
    // Framer Motion eases the offset back home automatically on release.
  }

  return (
    <motion.div
      ref={containerRef}
      className="flow-material absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-sheet shadow-sheet"
      style={{ y, height: targetHeight }}
      animate={{ height: targetHeight }}
      transition={springSheet}
      role="dialog"
      aria-label="Itinerary details"
    >
      {/* Grab handle */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        className="flex cursor-grab touch-none justify-center py-3 active:cursor-grabbing"
      >
        <span className="h-1.5 w-10 rounded-full bg-text-tertiary/50" aria-hidden />
      </motion.div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
        {children}
      </div>
    </motion.div>
  )
}
