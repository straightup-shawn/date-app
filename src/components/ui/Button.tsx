import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { motionTokens, pressFeedback } from '@/lib/motion'

type Variant = 'primary' | 'secondary' | 'ghost'

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

interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, ConflictingProps> {
  variant?: Variant
  loading?: boolean
  fullWidth?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-contrast',
  secondary: 'bg-surface-elevated text-text-primary border border-border',
  ghost: 'bg-transparent text-text-primary',
}

/**
 * Primary action button. One clear action per screen state (Section 2A.1).
 * >= 44px touch target. Does not change position between loading/success.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading, fullWidth, className, children, disabled, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={disabled || loading ? undefined : pressFeedback}
      transition={{ duration: motionTokens.press }}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-control px-5 text-body font-semibold',
        'select-none disabled:opacity-60 disabled:cursor-not-allowed',
        VARIANTS[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : children}
    </motion.button>
  )
})

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden
    />
  )
}
