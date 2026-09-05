import { motion } from 'framer-motion'
import { Footprints, Car, ChevronRight } from 'lucide-react'
import { StopCarousel } from './StopCarousel'
import type { PassStop } from '@/lib/types'
import { formatMYR, formatTime, formatDuration, formatTransit } from '@/lib/format'
import { cn } from '@/lib/cn'
import { springMicro } from '@/lib/motion'

interface TimelineProps {
  stops: PassStop[]
  selectedStopId: string | null
  onSelectStop: (id: string) => void
  selectedOptions: Record<string, number>
  onSelectOption: (stopId: string, index: number) => void
}

/**
 * Editorial timeline. Selecting a stop expands it and (via parent) highlights
 * the matching map pin. Map information is mirrored here so the map is not the
 * only way to understand the itinerary (Section 2A.12).
 */
export function Timeline({
  stops,
  selectedStopId,
  onSelectStop,
  selectedOptions,
  onSelectOption,
}: TimelineProps) {
  return (
    <ol className="space-y-2">
      {stops.map((stop) => {
        const active = stop.id === selectedStopId
        const transit = formatTransit(stop)
        return (
          <li key={stop.id}>
            {transit && (
              <div className="flex items-center gap-1.5 py-1 pl-1 text-micro text-text-tertiary">
                {stop.transit_mode === 'walk' ? (
                  <Footprints size={13} aria-hidden />
                ) : (
                  <Car size={13} aria-hidden />
                )}
                {transit}
              </div>
            )}

            <button
              type="button"
              onClick={() => onSelectStop(stop.id)}
              aria-expanded={active}
              className={cn(
                'w-full rounded-card border p-4 text-left transition-colors',
                active ? 'border-accent bg-accent/5' : 'border-border bg-surface',
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-micro font-bold',
                    active ? 'bg-accent text-accent-contrast' : 'bg-surface-elevated text-text-secondary',
                  )}
                >
                  {stop.stop_order}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-micro font-semibold tabular text-text-secondary">
                      {formatTime(stop.scheduled_time)}
                      {stop.duration_minutes ? ` · ${formatDuration(stop.duration_minutes)}` : ''}
                    </span>
                    <ChevronRight
                      size={16}
                      className={cn('shrink-0 text-text-tertiary transition-transform', active && 'rotate-90')}
                      aria-hidden
                    />
                  </div>

                  <span className="mt-0.5 block truncate text-section text-text-primary">
                    {stop.venue_name}
                  </span>
                  <span className="mt-0.5 block text-meta text-text-secondary">
                    {stop.fit_reason}
                  </span>

                  {stop.est_cost_total != null && (
                    <span className="mt-1 block text-meta tabular text-text-tertiary">
                      {formatMYR(stop.est_cost_total)} estimated for your group
                    </span>
                  )}

                  {active && (stop.venue_address || stop.category) && (
                    <div className="mt-3 space-y-1 border-t border-border pt-3 text-meta text-text-secondary">
                      {stop.venue_address && <p>{stop.venue_address}</p>}
                      {stop.category && (
                        <p className="capitalize text-text-tertiary">{stop.category}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </button>

            {/* Options carousel lives OUTSIDE the button (it contains buttons). */}
            {active && stop.alternatives && stop.alternatives.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={springMicro}
                className="px-1"
              >
                <StopCarousel
                  stop={stop}
                  selectedIndex={selectedOptions[stop.id] ?? -1}
                  onSelectOption={(index) => onSelectOption(stop.id, index)}
                />
              </motion.div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
