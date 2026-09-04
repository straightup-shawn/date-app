// ============================================================
// Flow v7.1 — Venue + event loading (Steps 4, 5) and semantic recall (Step 3)
// ============================================================
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import type { Venue } from './types.ts'

interface VenueRow {
  id: string
  name: string
  neighborhood: string
  categories: string[] | null
  address: string | null
  lat: number
  lng: number
  price_bucket: number | null
  est_cost_total: number | null
  rating: number | null
  opening_hours: unknown
  booking_url: string | null
  website_url: string | null
  indoor: boolean | null
  outdoor: boolean | null
  experience_families: string[] | null
  vibe_tags: string[] | null
  pax_min: number | null
  pax_max: number | null
  price_confidence: number | null
  hours_confidence: number | null
  data_quality: number | null
}

/**
 * Load active venues in a neighborhood. We rely on an RPC-free select plus a
 * lightweight lat/lng projection view. To keep things portable we select the
 * geography as GeoJSON via PostgREST computed columns is not available, so we
 * expose lat/lng through a helper SQL function `venues_in_area`.
 */
export async function loadVenues(
  service: SupabaseClient,
  neighborhood: string,
): Promise<Venue[]> {
  const { data, error } = await service.rpc('venues_in_area', {
    p_neighborhood: neighborhood,
  })
  if (error || !data) return []
  return (data as VenueRow[]).map(mapVenue)
}

export async function loadVenuesByIds(
  service: SupabaseClient,
  ids: string[],
): Promise<Venue[]> {
  if (ids.length === 0) return []
  const { data, error } = await service.rpc('venues_by_ids', { p_ids: ids })
  if (error || !data) return []
  return (data as VenueRow[]).map(mapVenue)
}

function mapVenue(r: VenueRow): Venue {
  return {
    id: r.id,
    name: r.name,
    neighborhood: r.neighborhood,
    categories: r.categories ?? [],
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    price_bucket: r.price_bucket,
    est_cost_total: r.est_cost_total,
    rating: r.rating,
    opening_hours: (r.opening_hours as Venue['opening_hours']) ?? null,
    booking_url: r.booking_url,
    website_url: r.website_url,
    indoor: r.indoor,
    outdoor: r.outdoor,
    experience_families: r.experience_families ?? [],
    vibe_tags: r.vibe_tags ?? [],
    pax_min: r.pax_min,
    pax_max: r.pax_max,
    price_confidence: r.price_confidence ?? 30,
    hours_confidence: r.hours_confidence ?? 30,
    data_quality: r.data_quality ?? 50,
  }
}
