import { cn } from '@/lib/cn'
import { formatMYR } from '@/lib/format'
import type { PassStop, StopOption } from '@/lib/types'

interface StopCarouselProps {
  stop: PassStop
  /** index of the currently chosen option: -1 = primary, 0..n = alternatives */
  selectedIndex: number
  onSelectOption: (index: number) => void
}

/**
 * Horizontal scroll-snap carousel of options for a stop (Section 2A.6 allows a
 * single-level carousel per card). Choosing an option updates the map pin +
 * timeline via the parent. Accessible: buttons with pressed state, keyboard OK.
 */
export function StopCarousel({ stop, selectedIndex, onSelectOption }: StopCarouselProps) {
  const alts = stop.alternatives ?? []
  if (alts.length === 0) return null

  // Build the full option list: primary (index -1) + alternatives (0..n).
  const primary: StopOption = {
    venue_id: null,
    venue_name: stop.venue_name,
    venue_address: stop.venue_address,
    coordinates: stop.coordinates,
    fit_reason: stop.fit_reason,
    est_cost_total: stop.est_cost_total,
    booking_url: stop.booking_url,
  }
  const options: Array<{ idx: number; opt: StopOption }> = [
    { idx: -1, opt: primary },
    ...alts.map((opt, i) => ({ idx: i, opt })),
  ]

  return (
    <div className="mt-3">
      <p className="mb-2 text-micro font-semibold text-text-tertiary">
        {options.length} options — swipe to compare
      </p>
      <div
        className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1"
        style={{ scrollbarWidth: 'none' }}
        role="listbox"
        aria-label={`Options for stop ${stop.stop_order}`}
      >
        {options.map(({ idx, opt }) => {
          const active = idx === selectedIndex
          return (
            <button
              key={`${idx}-${opt.venue_name}`}
              role="option"
              aria-selected={active}
              onClick={() => onSelectOption(idx)}
              className={cn(
                'w-[200px] shrink-0 snap-start rounded-card border p-3 text-left',
                active ? 'border-accent bg-accent/5' : 'border-border bg-surface',
              )}
            >
              <span className="block truncate text-body font-semibold text-text-primary">
                {opt.venue_name}
              </span>
              <span className="mt-0.5 line-clamp-2 block text-meta text-text-secondary">
                {opt.fit_reason}
              </span>
              {opt.est_cost_total != null && (
                <span className="mt-1 block text-meta tabular text-text-tertiary">
                  {formatMYR(opt.est_cost_total)} est.
                </span>
              )}
              {active && (
                <span className="mt-1 inline-block text-micro font-semibold text-accent">
                  ✓ Selected
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
