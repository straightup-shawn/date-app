// ============================================================
// Flow v7.1 — Frontend domain types (mirror the RPC/function payloads).
// ============================================================

export type BudgetMode = 'total' | 'per_person'
export type TravelPreference = 'walkable' | 'short_ride_ok'
export type ExperiencePreference =
  | 'food_focused'
  | 'activity_focused'
  | 'explore'
  | 'surprise_me'
export type Occasion = 'first_date' | 'anniversary' | 'casual' | 'casual_group'
export type TimeWindow = 'afternoon' | 'evening' | 'late_night'

export interface CreateInput {
  neighborhood: string
  occasion: Occasion
  pax: number
  time_window: TimeWindow
  budget_mode: BudgetMode
  budget_myr: number
  travel_preference: TravelPreference
  experience_preference: ExperiencePreference
  preferences: string[]
  free_text?: string
}

export interface WeatherSnapshot {
  rain_risk: number
  outdoor_suitable: boolean
  heat_discomfort: boolean
  confidence: number
  summary: string
  source: 'live' | 'cached' | 'unavailable'
}

export interface StopOption {
  venue_id: string | null
  venue_name: string
  venue_address: string | null
  coordinates: { lat: number; lng: number }
  fit_reason: string
  est_cost_total: number | null
  booking_url: string | null
}

export interface PassStop {
  id: string
  stop_order: number
  venue_name: string
  venue_address: string | null
  category: string | null
  fit_reason: string
  fact_confidence: number | null
  community_confidence: number | null
  scheduled_time: string | null
  duration_minutes: number | null
  est_cost_total: number | null
  transit_mode: string | null
  transit_time_mins: number | null
  transit_distance_meters: number | null
  coordinates: { lat: number; lng: number }
  route_geojson: unknown | null
  booking_url: string | null
  alternatives?: StopOption[]
}

export interface DatePass {
  id: string
  title: string | null
  neighborhood: string
  occasion: string | null
  time_window: string | null
  travel_preference: string | null
  experience_preference: string | null
  pax: number
  budget_mode: BudgetMode
  budget_myr: number | null
  scheduled_for: string | null
  end_by: string | null
  total_budget_estimate: number | null
  per_person_budget_estimate: number | null
  overall_confidence: number | null
  weather_snapshot: WeatherSnapshot | null
  stops: PassStop[]
}

export interface GenerateResponse {
  share_hash: string
  overall_confidence: number
  total_budget_estimate: number
  per_person_budget_estimate: number
  relaxation_suggestion: string | null
  degraded: boolean
}

export interface GenerateError {
  error: string
  message?: string
  relaxation_suggestion?: string | null
}

/** Saved-pass list row (owner select). */
export interface SavedPassRow {
  id: string
  share_hash: string
  title: string | null
  neighborhood: string
  pax: number
  total_budget_estimate: number | null
  overall_confidence: number | null
  created_at: string
}
