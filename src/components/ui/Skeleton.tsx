import { cn } from '@/lib/cn'

/** Layout-preserving skeleton (Section 2A.14). Never a full-page spinner. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-[10px] bg-[color-mix(in_srgb,var(--text-tertiary)_22%,transparent)]',
        className,
      )}
      aria-hidden
    />
  )
}
