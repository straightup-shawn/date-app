// ============================================================
// Flow v7.1 — Flow Engine core (Steps 10-16)
// Deterministic candidate graph, sequence generation, schedule +
// budget solvers, sequence scoring, confidence engine, relaxation.
// NIM/research only contribute SOFT signals to candidate scoring.
// ============================================================
import type {
  ConfidenceBreakdown,
  NormalizedRequest,
  PlannedStop,
  Venue,
  WeatherContext,
} from './types.ts'
import {
  FAMILY_DURATION,
  ROLE_FAMILIES,
  dampartSuitability,
  familyWeightForExperience,
  primaryFamily,
  type ExperienceFamily,
  type StopRole,
} from './taxonomy.ts'
import { estimateTravel, maxTransferMeters } from './geo.ts'
import { buildFitReason } from './fit_reason.ts'
import { totalBudget } from './normalize.ts'

/** Soft signal boosts keyed by venue id (from research + semantic recall). */
export type SoftSignals = Map<string, number> // venue_id -> 0..1 boost

interface RoleCandidate {
  venue: Venue
  family: ExperienceFamily
  role: StopRole
  baseScore: number
}

export interface ScoredSequence {
  stops: PlannedStop[]
  score: number
  totalCost: number
  perPerson: number
  scheduleOk: boolean
  budgetOk: boolean
  confidence: ConfidenceBreakdown
}

// Section 5 Step 14 scoring weights (from configuration in spec).
const WEIGHTS = {
  vibe_match: 0.17,
  budget_quality: 0.14,
  schedule_quality: 0.16,
  travel_quality: 0.14,
  community_signal: 0.1,
  place_quality: 0.09,
  weather_fit: 0.08,
  variety: 0.08,
  novelty: 0.04,
}

/** Estimate a venue's per-group cost, honoring pax where relevant. */
function estimateVenueCost(v: Venue, pax: number): { cost: number; known: boolean } {
  if (typeof v.est_cost_total === 'number' && v.est_cost_total > 0) {
    // est_cost_total is stored per-group baseline for ~2 pax; scale gently.
    const scaled = Math.round(v.est_cost_total * (pax / 2))
    return { cost: scaled, known: true }
  }
  // Conservative fallback from price bucket (per person), clearly an estimate.
  const perPersonByBucket: Record<number, number> = { 1: 20, 2: 45, 3: 90, 4: 160 }
  const bucket = v.price_bucket ?? 2
  const perPerson = perPersonByBucket[bucket] ?? 45
  return { cost: perPerson * pax, known: false }
}

function isExcluded(v: Venue, exclusions: string[]): boolean {
  if (exclusions.length === 0) return false
  const hay = [
    v.name.toLowerCase(),
    ...v.categories.map((c) => c.toLowerCase()),
    ...v.vibe_tags.map((t) => t.toLowerCase()),
    ...v.experience_families.map((f) => f.toLowerCase()),
  ].join(' ')
  return exclusions.some((ex) => hay.includes(ex))
}

/** Honor explicit indoor/outdoor preference as a hard-ish filter. */
function passesPreferenceFilters(v: Venue, req: NormalizedRequest, w: WeatherContext): boolean {
  const wantsIndoor = req.preferences.includes('mostly_indoor') || req.preferences.includes('mostly indoors')
  if (wantsIndoor && v.outdoor === true && v.indoor !== true) return false

  // Weather: if outdoor unsuitable, drop purely-outdoor venues (Step 9).
  if (!w.outdoor_suitable && v.outdoor === true && v.indoor !== true) return false

  if (req.preferences.includes('alcohol-free') || req.preferences.includes('alcohol_free')) {
    if (v.experience_families.includes('nightlife')) return false
  }
  return true
}

/** Build role-tagged candidates with a deterministic base score. */
export function buildCandidates(
  venues: Venue[],
  req: NormalizedRequest,
  weather: WeatherContext,
  soft: SoftSignals,
): RoleCandidate[] {
  const expWeights = familyWeightForExperience(req.experience_preference)
  const out: RoleCandidate[] = []

  for (const v of venues) {
    if (isExcluded(v, req.exclusions)) continue
    if (!passesPreferenceFilters(v, req, weather)) continue

    const fam = primaryFamily(v.experience_families) ?? primaryFamily(v.categories)
    if (!fam) continue

    // Which roles can this family fill?
    for (const role of Object.keys(ROLE_FAMILIES) as StopRole[]) {
      if (!ROLE_FAMILIES[role].includes(fam)) continue

      const daypart = dampartSuitability(fam, req.daypart)
      const expW = expWeights[fam] ?? 1
      const quality = (v.data_quality ?? 50) / 100
      const rating = v.rating ? Math.min(1, v.rating / 5) : 0.5
      const softBoost = soft.get(v.id) ?? 0

      const baseScore =
        0.30 * daypart +
        0.20 * expW +
        0.20 * quality +
        0.15 * rating +
        0.15 * softBoost

      out.push({ venue: v, family: fam, role, baseScore })
    }
  }
  return out
}

/** Generate + evaluate feasible sequences (Steps 11-16). Returns best-first. */
export function planSequences(
  candidates: RoleCandidate[],
  req: NormalizedRequest,
  weather: WeatherContext,
): ScoredSequence[] {
  const byRole: Record<StopRole, RoleCandidate[]> = {
    anchor: [],
    activity: [],
    closer: [],
  }
  for (const c of candidates) byRole[c.role].push(c)
  for (const role of Object.keys(byRole) as StopRole[]) {
    byRole[role].sort((a, b) => b.baseScore - a.baseScore)
    byRole[role] = byRole[role].slice(0, 8) // keep top-N per role for tractability
  }

  const templates: StopRole[][] = [
    ['anchor', 'activity', 'closer'],
    ['activity', 'anchor', 'closer'],
    ['anchor', 'closer'],
    ['activity', 'anchor'],
  ]

  const results: ScoredSequence[] = []
  const seen = new Set<string>()

  for (const template of templates) {
    // Cartesian over top candidates per role, but bounded.
    const options = template.map((r) => byRole[r])
    if (options.some((o) => o.length === 0)) continue

    const combos = boundedCartesian(options, 40)
    for (const combo of combos) {
      // No duplicate venue within a sequence.
      const ids = combo.map((c) => c.venue.id)
      if (new Set(ids).size !== ids.length) continue

      const key = ids.join('>')
      if (seen.has(key)) continue
      seen.add(key)

      const evaluated = evaluateSequence(combo, req, weather)
      if (evaluated) results.push(evaluated)
    }
  }

  results.sort((a, b) => b.score - a.score)
  return results
}

function evaluateSequence(
  combo: RoleCandidate[],
  req: NormalizedRequest,
  weather: WeatherContext,
): ScoredSequence | null {
  const startMs = new Date(req.scheduled_for).getTime()
  const endMs = new Date(req.end_by).getTime()

  let cursor = startMs
  let totalCost = 0
  let totalTravelMins = 0
  let unknownCostCount = 0
  const stops: PlannedStop[] = []
  const maxTransfer = maxTransferMeters(req.travel_preference)

  const budgetCap = totalBudget(req)

  for (let i = 0; i < combo.length; i++) {
    const c = combo[i]
    const v = c.venue
    let transit: { mode: 'walk' | 'ride'; minutes: number; meters: number } | null = null

    if (i > 0) {
      const prev = combo[i - 1].venue
      const est = estimateTravel(
        { lat: prev.lat, lng: prev.lng },
        { lat: v.lat, lng: v.lng },
        req.travel_preference,
      )
      // Hard feasibility: transfer must be within acceptable distance.
      if (est.distance_meters > maxTransfer) return null
      transit = { mode: est.mode, minutes: est.minutes, meters: est.distance_meters }
      cursor += est.minutes * 60000
      totalTravelMins += est.minutes
    }

    const duration = FAMILY_DURATION[c.family]
    const arrive = new Date(cursor)
    const depart = cursor + duration * 60000

    // Schedule solver: whole outing must fit the window (Step 12).
    if (depart > endMs) return null

    // Opening-hours feasibility when known (Step 12).
    if (v.opening_hours && !isOpenDuring(v.opening_hours, arrive, new Date(depart))) {
      return null
    }

    const { cost, known } = estimateVenueCost(v, req.pax)
    totalCost += cost
    if (!known) unknownCostCount++

    const withinBudget = totalCost <= budgetCap

    const hh = String(arrive.getHours()).padStart(2, '0')
    const mm = String(arrive.getMinutes()).padStart(2, '0')

    stops.push({
      venue_id: v.id,
      stop_order: i + 1,
      venue_name: v.name,
      venue_address: v.address,
      coordinates: { lat: v.lat, lng: v.lng },
      category: c.family,
      fit_reason: buildFitReason(v, {
        role: c.role,
        family: c.family,
        withinBudget,
        transitFromPrev: transit ? { mode: transit.mode, minutes: transit.minutes } : null,
        indoor: v.indoor,
      }),
      fact_confidence: Math.round(((v.hours_confidence ?? 30) + (v.data_quality ?? 50)) / 2),
      community_confidence: v.rating ? Math.min(90, Math.round(v.rating * 18)) : null,
      scheduled_time: `${hh}:${mm}:00`,
      duration_minutes: duration,
      est_cost_total: cost,
      transit_mode: transit?.mode ?? null,
      transit_time_mins: transit?.minutes ?? null,
      transit_distance_meters: transit?.meters ?? null,
      route_geojson: null,
      booking_url: v.booking_url,
    })

    cursor = depart
  }

  // Hard budget ceiling (Step 13). Allow a small tolerance? No — hard cap.
  const budgetOk = totalCost <= budgetCap

  const score = scoreSequence(combo, {
    totalCost,
    budgetCap,
    totalTravelMins,
    weather,
    req,
    unknownCostCount,
  })

  const confidence = computeConfidence(combo, {
    totalCost,
    budgetCap,
    weather,
    unknownCostCount,
    routingUsed: false,
  })

  return {
    stops,
    score: budgetOk ? score : score * 0.4, // heavily penalize but keep for relaxation hints
    totalCost,
    perPerson: Math.round(totalCost / req.pax),
    scheduleOk: true,
    budgetOk,
    confidence,
  }
}

function scoreSequence(
  combo: RoleCandidate[],
  ctx: {
    totalCost: number
    budgetCap: number
    totalTravelMins: number
    weather: WeatherContext
    req: NormalizedRequest
    unknownCostCount: number
  },
): number {
  const vibe = avg(combo.map((c) => c.baseScore))

  const budgetRatio = ctx.budgetCap > 0 ? ctx.totalCost / ctx.budgetCap : 1
  const budgetQuality = budgetRatio <= 1 ? 1 - Math.abs(0.8 - budgetRatio) : 0.2

  const scheduleQuality = 1 // survived the schedule solver

  const travelQuality = clamp01(1 - ctx.totalTravelMins / 60)

  const community = avg(
    combo.map((c) => (c.venue.rating ? Math.min(1, c.venue.rating / 5) : 0.5)),
  )
  const placeQuality = avg(combo.map((c) => (c.venue.data_quality ?? 50) / 100))

  const weatherFit = ctx.weather.outdoor_suitable ? 1 : hasIndoorBias(combo) ? 0.9 : 0.5

  const families = new Set(combo.map((c) => c.family))
  const variety = clamp01(families.size / combo.length)

  const novelty = avg(
    combo.map((c) => (c.venue.vibe_tags.includes('unusual') ? 1 : 0.4)),
  )

  return (
    WEIGHTS.vibe_match * vibe +
    WEIGHTS.budget_quality * budgetQuality +
    WEIGHTS.schedule_quality * scheduleQuality +
    WEIGHTS.travel_quality * travelQuality +
    WEIGHTS.community_signal * community +
    WEIGHTS.place_quality * placeQuality +
    WEIGHTS.weather_fit * weatherFit +
    WEIGHTS.variety * variety +
    WEIGHTS.novelty * novelty
  )
}

function computeConfidence(
  combo: RoleCandidate[],
  ctx: {
    totalCost: number
    budgetCap: number
    weather: WeatherContext
    unknownCostCount: number
    routingUsed: boolean
  },
): ConfidenceBreakdown {
  const venue_fact_confidence = Math.round(
    avg(combo.map((c) => (c.venue.hours_confidence + c.venue.data_quality) / 2)),
  )
  // Graduated schedule confidence: full credit when hours are known; partial
  // credit when unknown but the stop falls in a normal operating daypart
  // (most food/drinks/activity venues are open in the evening). We never claim
  // certainty — we just avoid punishing every discovered venue equally.
  const knownHours = combo.filter((c) => c.venue.opening_hours).length
  const knownRatio = knownHours / combo.length
  const schedule_confidence = Math.round(60 + knownRatio * 25)
  const budget_confidence = Math.round(
    100 - (ctx.unknownCostCount / combo.length) * 40,
  )
  const community_confidence = Math.round(
    avg(combo.map((c) => (c.venue.rating ? Math.min(90, c.venue.rating * 18) : 40))),
  )
  const weather_confidence = ctx.weather.confidence
  const routing_confidence = ctx.routingUsed ? 90 : 60

  const overall_confidence = Math.round(
    0.25 * venue_fact_confidence +
      0.2 * schedule_confidence +
      0.2 * budget_confidence +
      0.12 * community_confidence +
      0.1 * weather_confidence +
      0.13 * routing_confidence,
  )

  return {
    venue_fact_confidence,
    schedule_confidence,
    budget_confidence,
    community_confidence,
    weather_confidence,
    routing_confidence,
    overall_confidence,
  }
}

/** Smallest useful relaxation suggestion (Step 16). */
export function relaxationSuggestion(
  req: NormalizedRequest,
  bestInfeasible: ScoredSequence | null,
): string | null {
  if (!bestInfeasible) {
    if (req.travel_preference === 'walkable') return 'Allow a short Grab ride to reach more places.'
    return 'Try a neighboring area, or widen your time window.'
  }
  if (!bestInfeasible.budgetOk) {
    const over = bestInfeasible.totalCost - totalBudget(req)
    const bump = Math.ceil(over / 10) * 10
    return `Increase the total budget by about RM${bump}.`
  }
  if (req.travel_preference === 'walkable') return 'Allow a 10-minute ride.'
  return 'Start 30 minutes earlier to fit another stop.'
}

// ---------------- helpers ----------------

function isOpenDuring(hours: { [k: string]: Array<{ open: number; close: number }> }, arrive: Date, depart: Date): boolean {
  const wd = String(arrive.getDay())
  const windows = hours[wd]
  if (!windows || windows.length === 0) return false
  const a = arrive.getHours() * 60 + arrive.getMinutes()
  let d = depart.getHours() * 60 + depart.getMinutes()
  if (depart.getDate() !== arrive.getDate()) d += 1440 // crossed midnight
  return windows.some((w) => a >= w.open && d <= (w.close < w.open ? w.close + 1440 : w.close))
}

function hasIndoorBias(combo: RoleCandidate[]): boolean {
  return combo.filter((c) => c.venue.indoor === true).length >= combo.length - 1
}

function boundedCartesian<T>(arrays: T[][], cap: number): T[][] {
  let result: T[][] = [[]]
  for (const arr of arrays) {
    const next: T[][] = []
    for (const prefix of result) {
      for (const item of arr) {
        next.push([...prefix, item])
        if (next.length >= cap) break
      }
      if (next.length >= cap) break
    }
    result = next
  }
  return result
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}
