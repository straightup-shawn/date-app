// ============================================================
// Flow v7.1 — Geoapify provider (Section 3.5/3.6, Layer B)
// Worldwide structured discovery: geocode an arbitrary area name and
// discover real places around it. Results are normalized to the Venue
// shape and can be persisted (self-expanding catalog, Section 4.10).
//
// All calls are credit-guarded via consume_geoapify_credits and fail OPEN:
// on any error/missing key/exhausted budget, callers continue from local
// knowledge. Geoapify never decides feasibility — it only supplies candidates.
// ============================================================
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { getEnv } from './env.ts'
import type { Venue } from './types.ts'
import type { ExperienceFamily } from './taxonomy.ts'

function key(): string | undefined {
  return getEnv('GEOAPIFY_API_KEY')
}

export interface GeocodedArea {
  name: string // resolved, human place name
  lat: number
  lng: number
}

/**
 * Geocode a free-text area (e.g. "Shibuya, Tokyo" or "Bangsar") to a center
 * point. 1 credit. Returns null on failure/no key (caller falls back).
 */
export async function geocodeArea(
  service: SupabaseClient,
  area: string,
  dailyBudget: number,
): Promise<GeocodedArea | null> {
  const apiKey = key()
  if (!apiKey || !area.trim()) return null

  const query = expandAbbreviation(area.trim())

  // First try a strict city lookup (best precision). If it finds nothing,
  // fall back to a general search so abbreviations, neighborhoods, landmarks
  // and loosely-typed input still resolve. Each attempt costs 1 credit, and
  // we only spend the second when the first returns no usable result.
  const strict = await geocodeOnce(service, apiKey, query, dailyBudget, true)
  if (strict) return strict
  return geocodeOnce(service, apiKey, query, dailyBudget, false)
}

async function geocodeOnce(
  service: SupabaseClient,
  apiKey: string,
  query: string,
  dailyBudget: number,
  cityOnly: boolean,
): Promise<GeocodedArea | null> {
  if (!(await consume(service, 1, dailyBudget))) return null
  try {
    const typeParam = cityOnly ? '&type=city' : ''
    const url =
      `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}` +
      `${typeParam}&limit=1&format=json&apiKey=${apiKey}`
    const res = await withTimeout(fetch(url), 8000)
    if (!res.ok) return null
    const json = (await res.json()) as {
      results?: Array<{
        lat?: number
        lon?: number
        formatted?: string
        city?: string
        name?: string
        suburb?: string
        district?: string
      }>
    }
    const r = json.results?.[0]
    if (!r || typeof r.lat !== 'number' || typeof r.lon !== 'number') return null
    return {
      name: r.name || r.suburb || r.district || r.city || r.formatted || query,
      lat: r.lat,
      lng: r.lon,
    }
  } catch {
    return null
  }
}

// Common area abbreviations users type. Keeps discovery robust to shorthand.
const ABBREVIATIONS: Record<string, string> = {
  kl: 'Kuala Lumpur',
  nyc: 'New York City',
  sf: 'San Francisco',
  la: 'Los Angeles',
  pj: 'Petaling Jaya',
  jb: 'Johor Bahru',
  kk: 'Kota Kinabalu',
  hk: 'Hong Kong',
  sg: 'Singapore',
  bkk: 'Bangkok',
  dxb: 'Dubai',
  ldn: 'London',
}

function expandAbbreviation(input: string): string {
  const key = input.toLowerCase().replace(/[.\s]/g, '')
  return ABBREVIATIONS[key] ?? input
}

// Geoapify Places categories mapped to Flow experience families.
// Each family we plan for maps to a set of Geoapify category strings.
const FAMILY_TO_GEOAPIFY: Record<ExperienceFamily, string[]> = {
  // Restaurants only (no fast food as a date anchor).
  food: ['catering.restaurant'],
  drinks: ['catering.cafe', 'catering.bar'],
  activity: [
    'entertainment.cinema',
    'entertainment.bowling_alley',
    'entertainment.escape_game',
    'entertainment.miniature_golf',
    'leisure.spa',
    'entertainment.activity_park',
  ],
  // Real cultural venues, not generic "sights".
  culture: ['entertainment.museum', 'entertainment.culture', 'entertainment.culture.gallery', 'entertainment.culture.theatre'],
  outdoor: ['leisure.park', 'natural', 'tourism.attraction.viewpoint'],
  // Markets + specific attractions, not civic "sights".
  explore: ['commercial.marketplace', 'tourism.attraction'],
  shopping: ['commercial.shopping_mall', 'commercial.marketplace'],
  nightlife: ['catering.bar', 'catering.pub', 'adult.nightclub'],
  event: [],
}

// Category fragments that should NEVER be recommended as date stops.
const BLOCKED_CATEGORY_FRAGMENTS = [
  'government',
  'office',
  'administrative',
  'townhall',
  'courthouse',
  'embassy',
  'police',
  'fire_station',
  'hospital',
  'clinic',
  'fuel',
  'parking',
  'bank',
  'atm',
  'fast_food',
  'monument', // civic monuments/plazas (e.g. Dataran DBKL) aren't date stops
  'memorial',
  'sport.sports_centre', // generic sports halls / associations / clubs
  'sport.stadium',
  'school',
  'university',
  'college',
  'place_of_worship',
]

/**
 * Discover places around a center point for the given families.
 * Returns normalized Venues (source='geoapify'). Credit cost ≈ 1 per family
 * request. Fails open (returns []).
 */
export async function discoverVenues(
  service: SupabaseClient,
  opts: {
    center: { lat: number; lng: number }
    neighborhood: string
    families: ExperienceFamily[]
    radiusMeters: number
    perFamilyLimit: number
    dailyBudget: number
  },
): Promise<Venue[]> {
  const apiKey = key()
  if (!apiKey) return []

  // Only families that have category mappings.
  const families = opts.families.filter((f) => (FAMILY_TO_GEOAPIFY[f] ?? []).length > 0)

  // Guard credits up front (one per family), stopping at the budget ceiling.
  const allowed: ExperienceFamily[] = []
  for (const fam of families) {
    if (await consume(service, 1, opts.dailyBudget)) allowed.push(fam)
    else break
  }
  if (allowed.length === 0) return []

  // Fire all discovery calls CONCURRENTLY — this is the big latency win.
  const results = await Promise.all(
    allowed.map(async (fam) => {
      const cats = FAMILY_TO_GEOAPIFY[fam]
      const url =
        `https://api.geoapify.com/v2/places?categories=${encodeURIComponent(cats.join(','))}` +
        `&filter=circle:${opts.center.lng},${opts.center.lat},${opts.radiusMeters}` +
        `&bias=proximity:${opts.center.lng},${opts.center.lat}` +
        `&limit=${opts.perFamilyLimit}&apiKey=${apiKey}`
      try {
        const res = await withTimeout(fetch(url), 9000)
        if (!res.ok) return [] as Venue[]
        const json = (await res.json()) as GeoapifyPlacesResponse
        return (json.features ?? [])
          .map((feat) => normalize(feat, fam, opts.neighborhood))
          .filter((v): v is Venue => v !== null)
      } catch {
        return [] as Venue[] // fail open per family
      }
    }),
  )

  const out: Venue[] = []
  const seen = new Set<string>()
  for (const list of results) {
    for (const v of list) {
      if (seen.has(v.id)) continue
      seen.add(v.id)
      out.push(v)
    }
  }
  return out
}

interface GeoapifyPlacesResponse {
  features?: Array<{
    properties?: {
      place_id?: string
      name?: string
      address_line2?: string
      formatted?: string
      lat?: number
      lon?: number
      categories?: string[]
      website?: string
      opening_hours?: string
    }
    geometry?: { coordinates?: [number, number] }
  }>
}

/**
 * Normalize a Geoapify feature to a Venue. Unnamed places are skipped
 * (not recommendable without identity, Section 4.9). est_cost_total is left
 * null so the planner uses conservative, clearly-estimated category pricing.
 */
function normalize(
  feat: NonNullable<GeoapifyPlacesResponse['features']>[number],
  fam: ExperienceFamily,
  neighborhood: string,
): Venue | null {
  const p = feat.properties
  if (!p || !p.name || !p.place_id) return null
  const lat = p.lat ?? feat.geometry?.coordinates?.[1]
  const lng = p.lon ?? feat.geometry?.coordinates?.[0]
  if (typeof lat !== 'number' || typeof lng !== 'number') return null

  const cats = p.categories ?? []

  // Reject civic/utility/no-go places outright (e.g. government squares,
  // parking, banks) — they are never good date stops.
  const catStr = cats.join(' ')
  if (BLOCKED_CATEGORY_FRAGMENTS.some((frag) => catStr.includes(frag))) return null

  // A named place with no meaningful category is usually a generic map point;
  // skip it rather than risk suggesting something random.
  if (cats.length === 0) return null

  const indoor = deriveIndoor(fam, cats)
  const { vibes, quality } = deriveVibesAndQuality(fam, cats)

  return {
    id: `geoapify:${p.place_id}`, // stable synthetic id for dedupe pre-persist
    name: p.name,
    neighborhood,
    categories: cats.slice(0, 8),
    address: p.address_line2 ?? p.formatted ?? null,
    lat,
    lng,
    price_bucket: defaultPriceBucket(fam),
    est_cost_total: null, // unknown → conservative estimate + labeled in UI
    rating: null,
    opening_hours: null, // Geoapify free hours are unreliable; leave null
    booking_url: null,
    website_url: p.website ?? null,
    indoor,
    outdoor: indoor === false ? true : null,
    experience_families: [fam],
    vibe_tags: vibes,
    pax_min: null,
    pax_max: null,
    price_confidence: 35,
    hours_confidence: 30, // discovered: hours unverified but plausibly open
    data_quality: quality,
  }
}

/**
 * Derive soft vibe tags + a quality baseline from Geoapify categories so the
 * planner can prefer genuinely date-appropriate venues over generic points.
 */
function deriveVibesAndQuality(
  fam: ExperienceFamily,
  cats: string[],
): { vibes: string[]; quality: number } {
  const c = cats.join(' ')
  const vibes = new Set<string>()
  let quality = 50

  if (c.includes('restaurant')) {
    vibes.add('conversation_friendly')
    quality += 8
  }
  if (c.includes('cafe') || c.includes('coffee') || c.includes('tea')) {
    vibes.add('conversation_friendly')
    vibes.add('cozy')
    quality += 8
  }
  if (c.includes('bar') || c.includes('pub') || c.includes('rooftop') || c.includes('lounge')) {
    vibes.add('lively')
    quality += 5
  }
  if (c.includes('museum') || c.includes('gallery') || c.includes('theatre') || c.includes('culture')) {
    vibes.add('conversation_friendly')
    vibes.add('unusual')
    quality += 8
  }
  if (c.includes('park') || c.includes('garden') || c.includes('viewpoint') || c.includes('natural')) {
    vibes.add('photogenic')
    quality += 4
  }
  if (c.includes('spa') || c.includes('wine') || c.includes('fine')) {
    vibes.add('romantic')
    quality += 6
  }
  if (c.includes('cinema') || c.includes('arcade') || c.includes('karaoke') || c.includes('bowling')) {
    vibes.add('group_friendly')
    quality += 4
  }
  // Higher-signal categories (specific real venues) beat generic "attraction".
  if (c.includes('attraction') && cats.length <= 1) quality -= 8

  void fam
  return { vibes: Array.from(vibes), quality: Math.max(30, Math.min(75, quality)) }
}

function deriveIndoor(fam: ExperienceFamily, cats: string[]): boolean | null {
  if (fam === 'outdoor') return false
  if (cats.some((c) => c.startsWith('natural') || c.includes('park'))) return false
  if (fam === 'food' || fam === 'drinks' || fam === 'culture' || fam === 'shopping') return true
  return null
}

function defaultPriceBucket(fam: ExperienceFamily): number {
  if (fam === 'nightlife') return 3
  if (fam === 'food') return 2
  if (fam === 'outdoor' || fam === 'explore' || fam === 'culture') return 1
  return 2
}

/** Returns true if the credit was successfully consumed (budget available). */
async function consume(
  service: SupabaseClient,
  credits: number,
  dailyBudget: number,
): Promise<boolean> {
  try {
    const { error } = await service.rpc('consume_geoapify_credits', {
      p_credits: credits,
      p_daily_limit: dailyBudget,
    })
    return !error
  } catch {
    return false
  }
}

async function withTimeout(p: Promise<Response>, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), ms)
  try {
    return await p
  } finally {
    clearTimeout(id)
  }
}

/** Build a concise semantic profile for a discovered venue (for later embedding). */
export function discoveredProfile(v: Venue): string {
  const fam = v.experience_families[0] ?? 'place'
  const io = v.indoor === true ? 'Indoor' : v.indoor === false ? 'Outdoor' : ''
  return [
    `${v.name} in ${v.neighborhood}.`,
    io && `${io} venue.`,
    `Category: ${fam}.`,
    'Discovered via structured place data; details are estimates.',
  ]
    .filter(Boolean)
    .join(' ')
}
