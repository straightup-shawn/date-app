// ============================================================
// Flow v7.1 — Display formatting helpers.
// Prices/hours are estimates and must be labeled honestly (Section 9).
// ============================================================

export function formatMYR(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return `RM ${Math.round(amount).toLocaleString('en-MY')}`
}

/** "19:00:00" -> "7:00 PM" */
export function formatTime(t: string | null | undefined): string {
  if (!t) return ''
  const [hStr, mStr] = t.split(':')
  const h = Number(hStr)
  const m = Number(mStr)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

export function formatDuration(mins: number | null | undefined): string {
  if (!mins) return ''
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function formatTransit(stop: {
  transit_mode: string | null
  transit_time_mins: number | null
}): string | null {
  if (!stop.transit_mode || !stop.transit_time_mins) return null
  const verb = stop.transit_mode === 'walk' ? 'walk' : 'ride'
  return `${stop.transit_time_mins} min ${verb}`
}

export interface ConfidenceLabel {
  text: string
  tone: 'success' | 'warning' | 'default'
}

/** Confidence-aware estimate/verify labels (Section 5 Step 16). */
export function confidenceLabel(confidence: number | null | undefined): ConfidenceLabel {
  const c = confidence ?? 0
  if (c >= 82) return { text: 'High confidence', tone: 'success' }
  if (c >= 65) return { text: 'Estimated — verify hours & booking', tone: 'warning' }
  return { text: 'Low confidence — details may vary', tone: 'warning' }
}

const OCCASION_LABEL: Record<string, string> = {
  first_date: 'First Date',
  anniversary: 'Anniversary',
  casual: 'Casual Hangout',
  casual_group: 'Group Outing',
}
export function occasionLabel(o: string | null | undefined): string {
  return (o && OCCASION_LABEL[o]) || 'Date'
}
