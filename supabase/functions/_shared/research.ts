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
