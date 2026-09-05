// ============================================================
// Flow v7.1 — Shared types for Edge Functions (Deno runtime)
// ============================================================

export type BudgetMode = 'total' | 'per_person'
export type TravelPreference = 'walkable' | 'short_ride_ok'
export type ExperiencePreference =
  | 'food_focused'
  | 'activity_focused'
  | 'explore'
  | 'surprise_me'
export type Occasion =
  | 'first_date'
  | 'anniversary'
  | 'casual'
  | 'casual_group'
export type TimeWindow = 'afternoon' | 'evening' | 'late_night'

/** Raw request from the browser to generate-flow. */
export interface GenerateRequest {
  neighborhood: string
  occasion?: Occasion
  pax?: number
  time_window?: TimeWindow
  budget?: { mode: BudgetMode; amount_myr: number }
  travel_preference?: TravelPreference
  experience_preference?: ExperiencePreference
  preferences?: string[]
  exclusions?: string[]
  free_text?: string
  scheduled_for?: string // ISO
  end_by?: string // ISO
}

/** Deterministically normalized request (Flow Engine Step 1). */
export interface NormalizedRequest {
  neighborhood: string
  occasion: Occasion
  pax: number
  time_window: TimeWindow
  budget_mode: BudgetMode
  budget_myr: number
  budget_per_person: number
  travel_preference: TravelPreference
  experience_preference: ExperiencePreference
  preferences: string[]
  exclusions: string[]
  free_text: string
  scheduled_for: string // ISO
  end_by: string // ISO
  available_minutes: number
  daypart: TimeWindow
}

/** Soft preferences that NIM reasoning may structure (Step 1, soft only). */
export interface StructuredIntent {
  vibes?: string[]
  wants_indoor?: boolean | null
  wants_quiet?: boolean | null
  activity_heavy?: boolean | null
  food_heavy?: boolean | null
  low_cost?: boolean | null
}

export interface ResearchSignal {
  sourceUrl: string
  sourceDomain?: string
  mentionedName?: string
  signalType: string
  signalStrength: number
}

export interface ResearchSignals {
  signals: ResearchSignal[]
}

export interface Venue {
  id: string
  name: string
  neighborhood: string
  categories: string[]
  address: string | null
  lat: number
  lng: number
  price_bucket: number | null
  est_cost_total: number | null
  rating: number | null
  opening_hours: OpeningHours | null
  booking_url: string | null
  website_url: string | null
  indoor: boolean | null
  outdoor: boolean | null
  experience_families: string[]
  vibe_tags: string[]
  pax_min: number | null
  pax_max: number | null
  price_confidence: number
  hours_confidence: number
  data_quality: number
}

/** Normalized opening hours per weekday (0=Sun..6=Sat). Minutes since midnight. */
export interface OpeningHours {
  // e.g. { "5": [{ open: 660, close: 1380 }] }
  [weekday: string]: Array<{ open: number; close: number }>
}

export interface CandidateEvent {
  id: string
  name: string
  neighborhood: string
  starts_at: string
  ends_at: string | null
  est_cost_total: number | null
  booking_url: string | null
  indoor: boolean | null
  lat: number
  lng: number
  categories: string[]
  experience_families: string[]
}

export interface WeatherContext {
  rain_risk: number // 0..1
  outdoor_suitable: boolean
  heat_discomfort: boolean
  confidence: number // 0..100
  summary: string
  source: 'live' | 'cached' | 'unavailable'
}

/** One alternative option for a stop (same role/time slot). */
export interface StopOption {
  venue_id: string | null
  venue_name: string
  venue_address: string | null
  coordinates: { lat: number; lng: number }
  fit_reason: string
  est_cost_total: number | null
  booking_url: string | null
}

export interface PlannedStop {
  venue_id: string | null
  stop_order: number
  venue_name: string
  venue_address: string | null
  coordinates: { lat: number; lng: number }
  category: string | null
  fit_reason: string
  fact_confidence: number | null
  community_confidence: number | null
  scheduled_time: string | null // "HH:MM:SS"
  duration_minutes: number | null
  est_cost_total: number | null
  transit_mode: string | null
  transit_time_mins: number | null
  transit_distance_meters: number | null
  route_geojson: unknown | null
  booking_url: string | null
  /** Other options for this stop (same role/slot), best-first. Excludes the primary. */
  alternatives: StopOption[]
}

export interface ConfidenceBreakdown {
  venue_fact_confidence: number
  schedule_confidence: number
  budget_confidence: number
  community_confidence: number
  weather_confidence: number
  routing_confidence: number
  overall_confidence: number
}

export interface GenerateResult {
  share_hash: string
  overall_confidence: number
  confidence: ConfidenceBreakdown
  stops: PlannedStop[]
  total_budget_estimate: number
  per_person_budget_estimate: number
  relaxation_suggestion: string | null
  degraded: boolean
}
