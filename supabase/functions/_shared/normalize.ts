// ============================================================
// Flow v7.1 — Flow Engine Step 1: deterministic request normalization
// Explicit hard constraints always win over any soft NIM interpretation.
// ============================================================
import type {
  BudgetMode,
  ExperiencePreference,
  GenerateRequest,
  NormalizedRequest,
  Occasion,
  TimeWindow,
  TravelPreference,
} from './types.ts'

const OCCASIONS: Occasion[] = ['first_date', 'anniversary', 'casual', 'casual_group']
const TIME_WINDOWS: TimeWindow[] = ['afternoon', 'evening', 'late_night']
const TRAVEL: TravelPreference[] = ['walkable', 'short_ride_ok']
const EXPERIENCE: ExperiencePreference[] = [
  'food_focused',
  'activity_focused',
  'explore',
  'surprise_me',
]

/** Default start/end clock windows per daypart, local time (hours). */
const DAYPART_WINDOW: Record<TimeWindow, { start: number; end: number }> = {
  afternoon: { start: 14, end: 19 }, // extends into early evening for more options
  evening: { start: 18, end: 23 },
  late_night: { start: 21, end: 26 }, // 26 = 2am next day
}

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' ? Math.round(n) : NaN
  if (Number.isNaN(v)) return fallback
  return Math.max(min, Math.min(max, v))
}

function pick<T>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

export function normalizeRequest(req: GenerateRequest): NormalizedRequest {
  const neighborhood = String(req.neighborhood ?? '').trim()
  const pax = clampInt(req.pax, 1, 20, 2)
  const occasion = pick<Occasion>(req.occasion, OCCASIONS, 'casual')
  const time_window = pick<TimeWindow>(req.time_window, TIME_WINDOWS, 'evening')
  const travel_preference = pick<TravelPreference>(
    req.travel_preference,
    TRAVEL,
    'short_ride_ok',
  )
  const experience_preference = pick<ExperiencePreference>(
    req.experience_preference,
    EXPERIENCE,
    'surprise_me',
  )

  const budget_mode: BudgetMode =
    req.budget?.mode === 'per_person' ? 'per_person' : 'total'
  const rawBudget = clampInt(req.budget?.amount_myr, 0, 100000, 150)
  const budget_myr = rawBudget
  const budget_per_person =
    budget_mode === 'per_person' ? rawBudget : Math.round(rawBudget / pax)

  // Resolve schedule window.
  const now = new Date()
  const win = DAYPART_WINDOW[time_window]
  const scheduled = req.scheduled_for ? new Date(req.scheduled_for) : defaultStart(now, win.start)
  const endBy = req.end_by
    ? new Date(req.end_by)
    : new Date(scheduled.getTime() + (win.end - win.start) * 60 * 60 * 1000)

  const available_minutes = Math.max(
    45,
    Math.round((endBy.getTime() - scheduled.getTime()) / 60000),
  )

  return {
    neighborhood,
    occasion,
    pax,
    time_window,
    budget_mode,
    budget_myr,
    budget_per_person,
    travel_preference,
    experience_preference,
    preferences: sanitizeList(req.preferences),
    exclusions: sanitizeList(req.exclusions),
    free_text: String(req.free_text ?? '').slice(0, 500),
    scheduled_for: scheduled.toISOString(),
    end_by: endBy.toISOString(),
    available_minutes,
    daypart: time_window,
  }
}

export function totalBudget(n: NormalizedRequest): number {
  return n.budget_mode === 'per_person' ? n.budget_myr * n.pax : n.budget_myr
}

function defaultStart(now: Date, startHour: number): Date {
  const d = new Date(now)
  d.setHours(startHour, 0, 0, 0)
  // If that hour already passed today, plan for the same window tomorrow.
  if (d.getTime() < now.getTime() + 30 * 60 * 1000) {
    d.setDate(d.getDate() + 1)
  }
  return d
}

function sanitizeList(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  return list
    .map((x) => String(x).trim().toLowerCase())
    .filter((x) => x.length > 0 && x.length <= 40)
    .slice(0, 12)
}
