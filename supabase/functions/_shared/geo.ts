// ============================================================
// Flow v7.1 — Geo + travel estimation (Section 3.6)
// PostGIS is used for candidate discovery; these helpers estimate
// travel for scheduling/scoring when a routing API is not called.
// ============================================================
import type { TravelPreference } from './types.ts'

const EARTH_RADIUS_M = 6371000

/** Straight-line (haversine) distance in meters. */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

// Conservative constants. Road distance is longer than straight-line.
const ROAD_FACTOR = 1.35
const WALK_SPEED_M_PER_MIN = 75 // ~4.5 km/h conservative
const CITY_DRIVE_SPEED_M_PER_MIN = 330 // ~20 km/h w/ city traffic

export interface TravelEstimate {
  mode: 'walk' | 'ride'
  distance_meters: number
  minutes: number
}

/**
 * Estimate travel between two points given the user's travel preference.
 * Short walks stay walking even if rides are allowed.
 */
export function estimateTravel(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  pref: TravelPreference,
): TravelEstimate {
  const straight = haversineMeters(a, b)
  const roadDist = Math.round(straight * ROAD_FACTOR)

  const walkMins = Math.ceil(roadDist / WALK_SPEED_M_PER_MIN)

  // Under ~800m road distance is comfortably walkable for everyone.
  const walkable = roadDist <= 800
  if (walkable || pref === 'walkable') {
    return { mode: 'walk', distance_meters: roadDist, minutes: walkMins }
  }

  // Short ride allowed. Add a small hailing/boarding overhead.
  const rideMins = Math.ceil(roadDist / CITY_DRIVE_SPEED_M_PER_MIN) + 5
  return { mode: 'ride', distance_meters: roadDist, minutes: rideMins }
}

/** Max acceptable transfer distance given travel preference (hard-ish filter). */
export function maxTransferMeters(pref: TravelPreference): number {
  return pref === 'walkable' ? 1200 : 6000
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}
