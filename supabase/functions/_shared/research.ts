// ============================================================
// Flow v7.1 — Selective web research (Section 3.9, 4.7, Step 7)
// Tavily behind a WebResearchProvider. Signals, not truth.
// Budget-guarded, cached, no raw-content persistence, fail-open.
// ============================================================
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { getEnv } from './env.ts'
import type { ResearchSignal } from './types.ts'

export interface ResearchResponse {
  cacheHit: boolean
  creditsUsed: number
  signals: ResearchSignal[]
}

const EVIDENCE_TTL_DAYS = 7

/**
 * Run selective research for an area. Enforces cache + budget guard.
 * Returns empty signals (never throws) when research is unavailable.
 */
export async function runResearch(
  service: SupabaseClient,
  opts: {
    area: string
    queryFingerprint: string
    query: string
    maxCredits: 1 | 2
    monthlyBudget: number
    researchEnabled: boolean
  },
): Promise<ResearchResponse> {
  if (!opts.researchEnabled) return { cacheHit: false, creditsUsed: 0, signals: [] }

  // 1) Query cache (no credit cost on hit).
  try {
    const { data } = await service
      .from('research_query_cache')
      .select('normalized_signals, expires_at')
      .eq('query_fingerprint', opts.queryFingerprint)
      .maybeSingle()
    if (data && new Date(data.expires_at as string) > new Date()) {
      return {
        cacheHit: true,
        creditsUsed: 0,
        signals: (data.normalized_signals as ResearchSignal[]) ?? [],
      }
    }
  } catch {
    // ignore
  }

  const apiKey = getEnv('TAVILY_API_KEY')
  if (!apiKey) return { cacheHit: false, creditsUsed: 0, signals: [] }

  // Basic search first (Step 7). Escalate to Advanced (2 credits) only when the
  // caller allows it because confidence is low.
  const useAdvanced = opts.maxCredits >= 2
  const credits = useAdvanced ? 2 : 1

  // 2) Atomic budget guard BEFORE the provider call (Section 6.6).
  try {
    const { error } = await service.rpc('consume_research_credits', {
      p_credits: credits,
      p_monthly_limit: opts.monthlyBudget,
    })
    if (error) {
      // Budget exhausted / invalid — research unavailable, continue.
      return { cacheHit: false, creditsUsed: 0, signals: [] }
    }
  } catch {
    return { cacheHit: false, creditsUsed: 0, signals: [] }
  }

  // 3) Provider call.
  try {
    const res = await withTimeout(
      fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: opts.query,
          search_depth: useAdvanced ? 'advanced' : 'basic',
          max_results: useAdvanced ? 8 : 6,
        }),
      }),
      10000,
    )
    if (!res.ok) return { cacheHit: false, creditsUsed: credits, signals: [] }
    const json = (await res.json()) as {
      results?: Array<{ url?: string; title?: string; content?: string }>
    }
    const signals = extractSignals(json.results ?? [])

    // 4) Persist ONLY normalized signals + URLs (never raw bodies).
    const expires = new Date(Date.now() + EVIDENCE_TTL_DAYS * 86400000).toISOString()
    await service.from('research_query_cache').upsert({
      query_fingerprint: opts.queryFingerprint,
      normalized_signals: signals,
      source_urls: signals.map((s) => s.sourceUrl),
      credits_used: credits,
      expires_at: expires,
    })

    return { cacheHit: false, creditsUsed: credits, signals }
  } catch {
    return { cacheHit: false, creditsUsed: credits, signals: [] }
  }
}

const SIGNAL_KEYWORDS: Array<{ re: RegExp; type: string }> = [
  { re: /romantic|intimate|date night/i, type: 'romantic' },
  { re: /group|friends|hang ?out/i, type: 'group_friendly' },
  { re: /quiet|chill|relax/i, type: 'quiet' },
  { re: /hidden gem|underrated|tucked away/i, type: 'hidden_gem' },
  { re: /popular|famous|must[- ]?visit/i, type: 'popular' },
  { re: /cozy|atmospher/i, type: 'good_atmosphere' },
  { re: /unique|unusual|one[- ]of[- ]a[- ]kind/i, type: 'unusual' },
]

/**
 * Extract only short recommendation SIGNALS (never store copied bodies).
 * We look at title + a short window of content for keyword presence.
 */
function extractSignals(
  results: Array<{ url?: string; title?: string; content?: string }>,
): ResearchSignal[] {
  const signals: ResearchSignal[] = []
  const seenDomains = new Set<string>()

  for (const r of results) {
    if (!r.url) continue
    let domain = ''
    try {
      domain = new URL(r.url).hostname.replace(/^www\./, '')
    } catch {
      continue
    }
    // Dedupe syndicated/duplicate sources by domain.
    if (seenDomains.has(domain)) continue
    seenDomains.add(domain)

    const text = `${r.title ?? ''} ${(r.content ?? '').slice(0, 240)}`
    for (const { re, type } of SIGNAL_KEYWORDS) {
      if (re.test(text)) {
        signals.push({
          sourceUrl: r.url,
          sourceDomain: domain,
          mentionedName: extractName(r.title ?? ''),
          signalType: type,
          signalStrength: 55,
        })
      }
    }
  }
  return signals
}

function extractName(title: string): string | undefined {
  const t = title.split(/[|\-–—:]/)[0].trim()
  return t.length > 2 && t.length < 60 ? t : undefined
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

// ============================================================
// Curated venue extraction — pull named venues from "top 10 / best" listicles
// (foodie blogs, date-idea roundups). These are human-curated, so they produce
// much higher-quality candidates than raw map data. Names are then entity-
// resolved to real places before ever being recommended (Section 4.9).
// We persist ONLY normalized signals + source URLs — never article bodies.
// ============================================================

export interface CuratedName {
  name: string
  sourceUrl: string
  sourceDomain?: string
  signalType: string // 'curated_food' | 'curated_activity' | 'curated_date'
  signalStrength: number
}

export interface CuratedResponse {
  cacheHit: boolean
  creditsUsed: number
  names: CuratedName[]
}

/**
 * Fetch curated venue names for an area + intent. Advanced Tavily search over
 * listicle-style pages, then parse venue names from titles/content.
 */
export async function researchCuratedVenues(
  service: SupabaseClient,
  opts: {
    area: string
    intent: 'food' | 'date' | 'activity'
    queryFingerprint: string
    monthlyBudget: number
    researchEnabled: boolean
  },
): Promise<CuratedResponse> {
  if (!opts.researchEnabled) return { cacheHit: false, creditsUsed: 0, names: [] }

  // Cache first (no credit cost on hit).
  try {
    const { data } = await service
      .from('research_query_cache')
      .select('normalized_signals, expires_at')
      .eq('query_fingerprint', opts.queryFingerprint)
      .maybeSingle()
    if (data && new Date(data.expires_at as string) > new Date()) {
      return { cacheHit: true, creditsUsed: 0, names: (data.normalized_signals as CuratedName[]) ?? [] }
    }
  } catch {
    /* ignore */
  }

  const apiKey = getEnv('TAVILY_API_KEY')
  if (!apiKey) return { cacheHit: false, creditsUsed: 0, names: [] }

  // Advanced search (2 credits) — worth it for curated lists.
  const credits = 2
  try {
    const { error } = await service.rpc('consume_research_credits', {
      p_credits: credits,
      p_monthly_limit: opts.monthlyBudget,
    })
    if (error) return { cacheHit: false, creditsUsed: 0, names: [] }
  } catch {
    return { cacheHit: false, creditsUsed: 0, names: [] }
  }

  const query = buildCuratedQuery(opts.area, opts.intent)
  try {
    const res = await withTimeout(
      fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: 'advanced',
          max_results: 8,
          include_raw_content: false,
        }),
      }),
      12000,
    )
    if (!res.ok) return { cacheHit: false, creditsUsed: credits, names: [] }
    const json = (await res.json()) as {
      results?: Array<{ url?: string; title?: string; content?: string }>
    }
    const names = extractVenueNames(json.results ?? [], opts.intent)

    // Persist normalized names + URLs only (never article bodies).
    const expires = new Date(Date.now() + EVIDENCE_TTL_DAYS * 86400000).toISOString()
    await service.from('research_query_cache').upsert({
      query_fingerprint: opts.queryFingerprint,
      normalized_signals: names,
      source_urls: [...new Set(names.map((n) => n.sourceUrl))],
      credits_used: credits,
      expires_at: expires,
    })

    return { cacheHit: false, creditsUsed: credits, names }
  } catch {
    return { cacheHit: false, creditsUsed: credits, names: [] }
  }
}

function buildCuratedQuery(area: string, intent: 'food' | 'date' | 'activity'): string {
  if (intent === 'food') return `best restaurants ${area} date night recommendations`
  if (intent === 'activity') return `best things to do ${area} couples fun activities`
  return `most romantic date spots ${area} top recommendations`
}

const SIGNAL_TYPE: Record<'food' | 'date' | 'activity', string> = {
  food: 'curated_food',
  date: 'curated_date',
  activity: 'curated_activity',
}

/**
 * Parse venue names from listicle results. Blog roundups format venues as
 * numbered/bulleted headings ("1. Marini's on 57", "**Nadodi**"). We extract
 * short proper-noun-looking phrases from titles and the leading content window.
 * This is heuristic; every name is entity-resolved before being recommended.
 */
function extractVenueNames(
  results: Array<{ url?: string; title?: string; content?: string }>,
  intent: 'food' | 'date' | 'activity',
): CuratedName[] {
  const out: CuratedName[] = []
  const seen = new Set<string>()
  const signalType = SIGNAL_TYPE[intent]

  for (const r of results) {
    if (!r.url) continue
    let domain = ''
    try {
      domain = new URL(r.url).hostname.replace(/^www\./, '')
    } catch {
      continue
    }
    // Only trust list/roundup style pages.
    const title = r.title ?? ''
    const looksCurated = /best|top|\d+\s|guide|romantic|must|favourite|favorite/i.test(title)
    if (!looksCurated) continue

    const text = (r.content ?? '').slice(0, 1500)
    for (const name of parseCandidateNames(text)) {
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ name, sourceUrl: r.url, sourceDomain: domain, signalType, signalStrength: 70 })
      if (out.length >= 25) return out
    }
  }
  return out
}

/**
 * Extract candidate venue names from a text window. Matches:
 *  - numbered list items: "1. Name" / "1) Name"
 *  - names before common separators in listicles
 * Filters out generic words and overly long phrases.
 */
function parseCandidateNames(text: string): string[] {
  const names: string[] = []

  // Numbered list patterns: "1. Marini's on 57", "12) Nadodi"
  const numbered = text.matchAll(/(?:^|\n|\s)(\d{1,2})[.)]\s+([A-Z][A-Za-z0-9'&.\- ]{2,40})/g)
  for (const m of numbered) {
    const candidate = cleanName(m[2])
    if (candidate) names.push(candidate)
  }

  // Bolded/heading-like proper nouns (Title Case runs of 1-4 words).
  if (names.length < 3) {
    const caps = text.matchAll(/\b([A-Z][a-z0-9'&.]+(?:\s[A-Z0-9][A-Za-z0-9'&.]+){0,3})\b/g)
    for (const m of caps) {
      const candidate = cleanName(m[1])
      if (candidate && !names.includes(candidate)) names.push(candidate)
      if (names.length >= 12) break
    }
  }

  return names.slice(0, 12)
}

const NAME_STOPWORDS = new Set([
  'the',
  'best',
  'top',
  'kuala',
  'lumpur',
  'this',
  'here',
  'these',
  'read',
  'more',
  'photo',
  'image',
  'source',
  'address',
  'price',
  'menu',
  'open',
  'closed',
  'restaurant',
  'restaurants',
  'guide',
  'places',
])

function cleanName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (name.length < 3 || name.length > 40) return null
  const words = name.split(' ')
  // Reject if it's a single generic stopword or looks like a sentence fragment.
  if (words.length === 1 && NAME_STOPWORDS.has(words[0].toLowerCase())) return null
  if (words.length > 5) return null
  return name
}
