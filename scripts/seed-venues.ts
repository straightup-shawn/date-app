// ============================================================
// Flow v7.1 — Reproducible venue seeding tool (Phase 0.5)
// Idempotent upsert into public.venues keyed by (source, external_id):
// re-running does NOT create duplicate rows.
//
// Uses the SERVICE ROLE key (server-side only, run locally). Never ship this
// key to the browser. Reads env from process.env (dotenv-free; use your shell
// or `node --env-file=.env`).
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed
//
// This seeds from the local catalog in seed-data.ts. To refresh/expand from
// Geoapify, add a fetch+normalize step here and pass results to upsertVenue()
// (respecting the geoapify_daily_credit_budget guard).
// ============================================================
import { createClient } from '@supabase/supabase-js'
import { BUKIT_BINTANG, dailyHours, type SeedVenue } from './seed-data'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. ' +
      'Set them in your environment before running the seed.',
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

/**
 * Upsert one venue. coordinates uses WKT so PostGIS parses it directly.
 * on_conflict (source, external_id) makes re-runs idempotent.
 */
async function upsertVenue(v: SeedVenue): Promise<void> {
  const row = {
    source: 'manual' as const,
    external_id: v.external_id,
    name: v.name,
    neighborhood: 'Bukit Bintang',
    categories: v.categories,
    address: v.address,
    // PostgREST accepts WKT for geography columns.
    coordinates: `SRID=4326;POINT(${v.lng} ${v.lat})`,
    price_bucket: v.price_bucket,
    est_cost_total: v.est_cost_total,
    rating: v.rating,
    opening_hours: dailyHours(v.open, v.close),
    booking_url: v.booking_url ?? null,
    website_url: v.website_url ?? null,
    indoor: v.indoor,
    outdoor: v.outdoor,
    experience_families: v.experience_families,
    vibe_tags: v.vibe_tags,
    semantic_profile: v.semantic_profile,
    pax_min: v.pax_min,
    pax_max: v.pax_max,
    price_confidence: 55,
    hours_confidence: 60,
    data_quality: 70,
    is_active: true,
    source_attribution: 'Manually curated seed catalog',
    source_fetched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('venues')
    .upsert(row, { onConflict: 'source,external_id' })

  if (error) throw new Error(`${v.name}: ${error.message}`)
}

async function main() {
  console.log(`Seeding ${BUKIT_BINTANG.length} Bukit Bintang venues…`)
  let ok = 0
  for (const v of BUKIT_BINTANG) {
    try {
      await upsertVenue(v)
      ok++
      console.log(`  ✓ ${v.name}`)
    } catch (e) {
      console.error(`  ✗ ${(e as Error).message}`)
    }
  }
  console.log(`Done. ${ok}/${BUKIT_BINTANG.length} venues upserted (idempotent).`)
  console.log(
    'Note: run the refresh-venue-embeddings function afterward to enable ' +
      'semantic recall (optional; deterministic ranking works without it).',
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
