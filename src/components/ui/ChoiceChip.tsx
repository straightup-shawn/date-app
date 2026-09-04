import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { motionTokens, pressFeedback } from '@/lib/motion'

interface ChoiceChipProps {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}

/** Selectable chip for low-friction multi/single choice input (Section 2A.7). */
export function ChoiceChip({ selected, onClick, children }: ChoiceChipProps) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      whileTap={pressFeedback}
      transition={{ duration: motionTokens.press }}
      className={cn(
        'min-h-[44px] rounded-capsule border px-4 text-meta font-semibold',
        selected
          ? 'border-accent bg-accent text-accent-contrast'
          : 'border-border bg-surface text-text-secondary',
      )}
    >
      {children}
    </motion.button>
  )
}
