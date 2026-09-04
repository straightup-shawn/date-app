import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { springMicro } from '@/lib/motion'

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  label?: string
}

/** iOS-style segmented control with a shared-layout selection pill. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex gap-1 rounded-control border border-border bg-surface-elevated p-1"
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative flex-1 rounded-[8px] px-3 py-2 text-meta font-semibold',
              active ? 'text-accent-contrast' : 'text-text-secondary',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${label ?? 'x'}`}
                transition={springMicro}
                className="absolute inset-0 rounded-[8px] bg-accent"
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
