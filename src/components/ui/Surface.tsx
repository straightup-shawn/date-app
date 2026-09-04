import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean
}

/** Calm content surface. NOT glass (glass is only for floating controls). */
export function Surface({ elevated, className, ...rest }: SurfaceProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-border',
        elevated ? 'bg-surface-elevated' : 'bg-surface',
        className,
      )}
      {...rest}
    />
  )
}
