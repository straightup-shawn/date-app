import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { motionTokens, pressFeedback } from '@/lib/motion'

// Framer Motion redefines these DOM event props; omit them to avoid a type clash.
type ConflictingProps =
  | 'onAnimationStart'
  | 'onAnimationEnd'
  | 'onAnimationIteration'
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd'
  | 'onDragEnter'
  | 'onDragExit'
  | 'onDragLeave'
  | 'onDragOver'
  | 'onDrop'

interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, ConflictingProps> {
  /** Accessible name is required for icon-only buttons (Section 2A.12). */
  label: string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, className, children, ...rest }, ref) {
    return (
      <motion.button
        ref={ref}
        aria-label={label}
        title={label}
        whileTap={pressFeedback}
        transition={{ duration: motionTokens.press }}
        className={cn(
          'inline-flex h-11 w-11 items-center justify-center rounded-control',
          'text-text-primary',
          className,
        )}
        {...rest}
      >
        {children}
      </motion.button>
    )
  },
)
