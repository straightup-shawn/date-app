import { CloudRain, ShieldCheck, TriangleAlert } from 'lucide-react'
import type { DatePass } from '@/lib/types'
import { formatMYR, confidenceLabel, occasionLabel } from '@/lib/format'

/** Peek-state summary: title + cost + stops + distance + confidence. */
export function PassSummary({ pass }: { pass: DatePass }) {
  const stops = pass.stops.length
  const totalMeters = pass.stops.reduce((sum, s) => sum + (s.transit_distance_meters ?? 0), 0)
  const km = (totalMeters / 1000).toFixed(1)
  const conf = confidenceLabel(pass.overall_confidence)
  const weatherAdjusted = pass.weather_snapshot && !pass.weather_snapshot.outdoor_suitable

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h1 className="text-title text-text-primary">{pass.title ?? pass.neighborhood}</h1>
      </div>

      <p className="text-body tabular text-text-secondary">
        {formatMYR(pass.total_budget_estimate)} · {stops} stops · {km} km
        {pass.per_person_budget_estimate
          ? ` · ${formatMYR(pass.per_person_budget_estimate)}/person`
          : ''}
      </p>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Badge tone={conf.tone}>
          {conf.tone === 'success' ? <ShieldCheck size={13} /> : <TriangleAlert size={13} />}
          {conf.text}
        </Badge>
        <Badge tone="default">{occasionLabel(pass.occasion)} · {pass.pax} pax</Badge>
        {weatherAdjusted && (
          <Badge tone="warning">
            <CloudRain size={13} />
            Weather-adjusted
          </Badge>
        )}
      </div>
    </div>
  )
}

function Badge({
  tone,
  children,
}: {
  tone: 'success' | 'warning' | 'default'
  children: React.ReactNode
}) {
  const cls =
    tone === 'success'
      ? 'text-success border-success/30 bg-success/10'
      : tone === 'warning'
        ? 'text-warning border-warning/30 bg-warning/10'
        : 'text-text-secondary border-border bg-surface-elevated'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-capsule border px-2.5 py-1 text-micro font-semibold ${cls}`}
    >
      {children}
    </span>
  )
}
