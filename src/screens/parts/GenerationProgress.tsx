import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springMicro } from '@/lib/motion'

// Progress copy tied to real stages (Section 2A.7). No fake percentages.
const STAGES = [
  'Checking the weather…',
  'Finding a strong first stop…',
  'Keeping the next stop nearby…',
  'Putting your night together…',
]

export function GenerationProgress() {
  const [i, setI] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setI((v) => Math.min(v + 1, STAGES.length - 1)), 900)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-8"
      aria-live="polite"
    >
      <motion.div
        className="h-12 w-12 rounded-full border-[3px] border-accent border-t-transparent"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
        aria-hidden
      />
      <AnimatePresence mode="wait">
        <motion.p
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={springMicro}
          className="text-section text-text-primary"
        >
          {STAGES[i]}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
