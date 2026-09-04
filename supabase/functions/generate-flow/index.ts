// ============================================================
// Flow v7.1 — generate-flow Edge Function (Section 7)
// Deterministic constraint planner with OPTIONAL NIM + research.
// Turn NIM off and Flow still works. Never expose secrets.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/env.ts'
import { loadConfig } from '../_shared/config.ts'
import { normalizeRequest, totalBudget } from '../_shared/normalize.ts'
import { loadVenues } from '../_shared/venues.ts'
import { getWeatherContext } from '../_shared/weather.ts'
import { runResearch } from '../_shared/research.ts'
import { geocodeArea, discoverVenues, discoveredProfile } from '../_shared/geoapify.ts'
import type { ExperienceFamily } from '../_shared/taxonomy.ts'
import { createReasoningProvider, createSemanticProvider } from '../_shared/semantic.ts'
import {
  buildCandidates,
  planSequences,
  relaxationSuggestion,
  type SoftSignals,
} from '../_shared/planner.ts'
import { generateShareHash, queryFingerprint } from '../_shared/hash.ts'
import type { GenerateRequest, GenerateResult, Venue } from '../_shared/types.ts'

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const cors = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, cors)
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

  // Two clients (Section 7): user-scoped (auth.uid) + service-role (internal).
  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const service = createClient(SUPABASE_URL, SERVICE_KEY)

  // 1) Authenticate caller.
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) {
    return json({ error: 'unauthorized' }, 401, cors)
  }
  const userId = userData.user.id

  let body: GenerateRequest
  try {
    body = (await req.json()) as GenerateRequest
  } catch {
    return json({ error: 'bad_request' }, 400, cors)
  }

  const cfg = await loadConfig(service)

  // 2) Normalize (deterministic).
  const norm = normalizeRequest(body)
  if (!norm.neighborhood) {
    return json({ error: 'missing_neighborhood' }, 400, cors)
  }
  // Area gating (Section 12). By default Flow works worldwide via live
  // discovery. A curated rollout mode can be re-enabled with
  // restrict_to_supported_neighborhoods = true.
  if (
    cfg.restrict_to_supported_neighborhoods &&
    !cfg.supported_neighborhoods.includes(norm.neighborhood)
  ) {
    return json(
      {
        error: 'unsupported_area',
        message: `Flow doesn't cover ${norm.neighborhood} yet. Try ${cfg.supported_neighborhoods[0]}.`,
      },
      422,
      cors,
    )
  }

  // 3) Enforce rate limit BEFORE any external work (Section 6.5).
  try {
    const { error } = await service.rpc('consume_generation_quota', {
      p_user_id: userId,
      p_user_hour_limit: cfg.max_generations_per_user_per_hour,
      p_global_minute_limit: cfg.max_generations_global_per_minute,
    })
    if (error) {
      const msg = String(error.message ?? '')
      if (msg.includes('FLOW_RATE_LIMIT_USER')) {
        return json(
          { error: 'rate_limited', message: "You've generated several plans recently. Try again a little later." },
          429,
          cors,
        )
      }
      if (msg.includes('FLOW_RATE_LIMIT_GLOBAL')) {
        return json({ error: 'busy', message: 'Flow is busy right now. Try again shortly.' }, 503, cors)
      }
      return json({ error: 'rate_check_failed' }, 500, cors)
    }
  } catch {
    return json({ error: 'rate_check_failed' }, 500, cors)
  }

  // 4) Optional NIM reasoning to structure SOFT intent (fails open).
  const softExtra: string[] = []
  if (cfg.nim_enabled && cfg.nim_reasoning_enabled && norm.free_text.trim()) {
    const reasoner = createReasoningProvider(cfg.nim_reasoning_model)
    const intent = await reasoner.structureIntent(norm.free_text)
    if (intent?.vibes) softExtra.push(...intent.vibes)
    if (intent?.wants_indoor) norm.preferences.push('mostly_indoor')
  }

  // 5) Load existing knowledge.
  let venues = await loadVenues(service, norm.neighborhood)

  // 5b) Structured discovery (Layer B) — makes Flow work worldwide.
  // If the local catalog for this area is thin, geocode the area and discover
  // real places via Geoapify, persist them (self-expanding knowledge), reload.
  // Fails open: if Geoapify is unavailable/exhausted we continue with what we have.
  let discoveredCenter: { lat: number; lng: number } | null = null
  if (cfg.discovery_enabled && venues.length < cfg.discovery_min_local_venues) {
    const geo = await geocodeArea(service, norm.neighborhood, cfg.geoapify_daily_credit_budget)
    if (geo) {
      discoveredCenter = { lat: geo.lat, lng: geo.lng }
      // Discover across the families we plan for.
      const families: ExperienceFamily[] = [
        'food',
        'drinks',
        'activity',
        'culture',
        'outdoor',
        'explore',
        'nightlife',
      ]
      const discovered = await discoverVenues(service, {
        center: discoveredCenter,
        neighborhood: norm.neighborhood,
        families,
        radiusMeters: cfg.discovery_radius_meters,
        perFamilyLimit: cfg.discovery_per_family_limit,
        dailyBudget: cfg.geoapify_daily_credit_budget,
      })

      // Persist discovered venues (idempotent) so future requests are instant.
      for (const dv of discovered) {
        const externalId = dv.id.replace(/^geoapify:/, '')
        await service
          .rpc('upsert_discovered_venue', {
            p_external_id: externalId,
            p_name: dv.name,
            p_neighborhood: norm.neighborhood,
            p_categories: dv.categories,
            p_address: dv.address,
            p_lat: dv.lat,
            p_lng: dv.lng,
            p_price_bucket: dv.price_bucket,
            p_website_url: dv.website_url,
            p_indoor: dv.indoor,
            p_outdoor: dv.outdoor,
            p_experience_families: dv.experience_families,
            p_semantic_profile: discoveredProfile(dv),
          })
          .then(() => {}, () => {})
      }

      // Reload from the catalog so we plan against canonical persisted rows.
      venues = await loadVenues(service, norm.neighborhood)
    }
  }

  // Soft signal map (semantic recall + research boosts).
  const soft: SoftSignals = new Map()

  // Step 3: optional semantic recall.
  if (cfg.nim_enabled && cfg.nim_semantic_enabled) {
    const intentText = buildSoftIntentText(norm, softExtra)
    const provider = createSemanticProvider(cfg.nim_embed_model)
    const qvec = await provider.embedQuery(intentText)
    if (qvec) {
      const { data } = await service.rpc('match_venues_semantic', {
        p_query_embedding: qvec,
        p_neighborhood: norm.neighborhood,
        p_match_count: 20,
      })
      if (Array.isArray(data)) {
        for (const row of data as Array<{ venue_id: string; similarity: number }>) {
          if (row.similarity >= cfg.nim_semantic_min_similarity) {
            soft.set(row.venue_id, Math.max(soft.get(row.venue_id) ?? 0, row.similarity))
          }
        }
      }
    }
  }

  // 6) Initial knowledge confidence → decide research.
  const knowledgeConfidence = estimateKnowledgeConfidence(venues, norm)

  // 7) Weather context (Step 9). Prefer catalog centroid, then the geocoded
  // area center, then a KL fallback.
  const centroid = venues.length
    ? { lat: avg(venues.map((v) => v.lat)), lng: avg(venues.map((v) => v.lng)) }
    : discoveredCenter ?? { lat: 3.1478, lng: 101.7108 }
  const weather = await getWeatherContext(
    service,
    centroid,
    norm.neighborhood,
    norm.scheduled_for,
    cfg.weather_live_enabled,
  )

  // 8) Selective web research (Steps 6-7). Triggered by confidence/risk.
  if (cfg.research_enabled && knowledgeConfidence < cfg.research_trigger_confidence) {
    const fp = await queryFingerprint({
      area: norm.neighborhood,
      exp: norm.experience_preference,
      occ: norm.occasion,
      dp: norm.daypart,
    })
    const research = await runResearch(service, {
      area: norm.neighborhood,
      queryFingerprint: fp,
      query: `${norm.neighborhood} date ideas ${norm.experience_preference.replace('_', ' ')} evening`,
      maxCredits: knowledgeConfidence < cfg.research_deep_trigger_confidence ? 2 : 1,
      monthlyBudget: cfg.research_monthly_credit_budget,
      researchEnabled: cfg.research_enabled,
    })
    // Apply research signals as SOFT boosts to matching venues by name.
    applyResearchSignals(research.signals, venues, soft)
  }

  // 9-16) Build candidates + plan feasible, scored sequences.
  const candidates = buildCandidates(venues, norm, weather, soft)
  const sequences = planSequences(candidates, norm, weather)

  const feasible = sequences.filter((s) => s.scheduleOk && s.budgetOk)
  const best = feasible[0] ?? null

  if (!best) {
    // Low-confidence: return the smallest useful relaxation instead of faking it.
    const bestInfeasible = sequences[0] ?? null
    return json(
      {
        error: 'no_feasible_plan',
        message: "Couldn't build a good route in this area with these constraints.",
        relaxation_suggestion: relaxationSuggestion(norm, bestInfeasible),
      },
      200,
      cors,
    )
  }

  // 17) Persist atomically, retrying only the persistence call on hash collision.
  const shareHash = await persistWithRetry(service, userId, norm, best, weather)
  if (!shareHash) {
    return json({ error: 'persist_failed' }, 500, cors)
  }

  // 18) First-party signal: generated.
  await service.from('pass_signal_events').insert({
    itinerary_id: null,
    event_type: 'generated',
  }).then(() => {}, () => {})

  const result: GenerateResult = {
    share_hash: shareHash,
    overall_confidence: best.confidence.overall_confidence,
    confidence: best.confidence,
    stops: best.stops,
    total_budget_estimate: best.totalCost,
    per_person_budget_estimate: best.perPerson,
    relaxation_suggestion:
      best.confidence.overall_confidence < 65 ? relaxationSuggestion(norm, best) : null,
    degraded: best.stops.length < 3,
  }
  return json(result, 200, cors)
})

// ---------------- orchestration helpers ----------------

async function persistWithRetry(
  service: ReturnType<typeof createClient>,
  userId: string,
  norm: ReturnType<typeof normalizeRequest>,
  best: NonNullable<ReturnType<typeof planSequences>[number]>,
  weather: Awaited<ReturnType<typeof getWeatherContext>>,
): Promise<string | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const shareHash = generateShareHash()
    const { error } = await service.rpc('persist_generated_pass', {
      p_creator_id: userId,
      p_share_hash: shareHash,
      p_title: `${norm.neighborhood} ${labelDaypart(norm.daypart)}`,
      p_neighborhood: norm.neighborhood,
      p_occasion: norm.occasion,
      p_time_window: norm.time_window,
      p_travel_preference: norm.travel_preference,
      p_experience_preference: norm.experience_preference,
      p_pax: norm.pax,
      p_budget_mode: norm.budget_mode,
      p_budget_myr: norm.budget_myr,
      p_total_budget_estimate: best.totalCost,
      p_per_person_budget_estimate: best.perPerson,
      p_constraints_snapshot: {
        preferences: norm.preferences,
        exclusions: norm.exclusions,
        available_minutes: norm.available_minutes,
        budget_total: totalBudget(norm),
      },
      p_scheduled_for: norm.scheduled_for,
      p_end_by: norm.end_by,
      p_weather_snapshot: weather,
      p_overall_confidence: best.confidence.overall_confidence,
      p_stops: best.stops,
    })
    if (!error) return shareHash
    const msg = String(error.message ?? '')
    // Only retry on unique share_hash collision; otherwise fail.
    if (!msg.includes('duplicate key') && !msg.includes('unique')) return null
  }
  return null
}

function buildSoftIntentText(norm: ReturnType<typeof normalizeRequest>, extra: string[]): string {
  return [
    norm.occasion.replace('_', ' '),
    norm.experience_preference.replace('_', ' '),
    norm.daypart,
    ...norm.preferences,
    ...extra,
    norm.free_text,
  ]
    .filter(Boolean)
    .join('. ')
    .slice(0, 400)
}

function estimateKnowledgeConfidence(venues: Venue[], norm: ReturnType<typeof normalizeRequest>): number {
  // Cheap heuristic (Step 6). Weight catalog DATA QUALITY heavily so that
  // areas made only of freshly-discovered venues (low fact confidence) fall
  // below the research trigger and get recommendation signals, while curated
  // seeded areas stay high and spend zero research credits.
  if (venues.length === 0) return 20
  const families = new Set<string>()
  for (const v of venues) v.experience_families.forEach((f) => families.add(f))
  const quality = avg(venues.map((v) => v.data_quality)) // 0..100
  const hoursKnown = venues.filter((v) => v.opening_hours).length / venues.length // 0..1
  const diversityScore = Math.min(1, families.size / 5) * 100
  const volumeScore = Math.min(1, venues.length / 15) * 100
  void norm
  return Math.round(
    0.45 * quality + 0.2 * (hoursKnown * 100) + 0.2 * diversityScore + 0.15 * volumeScore,
  )
}

function applyResearchSignals(
  signals: Array<{ mentionedName?: string; signalStrength: number }>,
  venues: Venue[],
  soft: SoftSignals,
): void {
  for (const sig of signals) {
    if (!sig.mentionedName) continue
    const name = sig.mentionedName.toLowerCase()
    // Entity resolution (MVP): match to an existing catalog venue by name.
    // Unresolved mentions are NOT recommended (Section 4.9) — we simply skip.
    const match = venues.find(
      (v) => v.name.toLowerCase().includes(name) || name.includes(v.name.toLowerCase()),
    )
    if (match) {
      const boost = Math.min(0.4, sig.signalStrength / 200)
      soft.set(match.id, Math.max(soft.get(match.id) ?? 0, boost))
    }
  }
}

function labelDaypart(dp: string): string {
  if (dp === 'afternoon') return 'Afternoon'
  if (dp === 'late_night') return 'Late Night'
  return 'Tonight'
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
