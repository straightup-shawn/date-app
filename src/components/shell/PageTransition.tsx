import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { motionTokens } from '@/lib/motion'

/** Subtle enter animation only. No exit (routes swap immediately). */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: motionTokens.standard }}
    >
      {children}
    </motion.div>
  )
}
