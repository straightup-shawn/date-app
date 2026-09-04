// ============================================================
// Flow v7.1 — Deterministic fit_reason copy (Section 7)
// Assembled from validated facts/signals only. NEVER LLM text.
// Never fabricate facts not present in the venue/catalog/weather inputs.
// ============================================================
import type { Venue } from './types.ts'
import type { ExperienceFamily, StopRole } from './taxonomy.ts'

interface FitContext {
  role: StopRole
  family: ExperienceFamily | null
  withinBudget: boolean
  transitFromPrev?: { mode: 'walk' | 'ride'; minutes: number } | null
  weatherAdjusted?: boolean
  indoor?: boolean | null
}

export function buildFitReason(venue: Venue, ctx: FitContext): string {
  const parts: string[] = []

  // Lead by role.
  if (ctx.role === 'anchor') {
    parts.push('Solid anchor stop')
  } else if (ctx.role === 'activity') {
    parts.push('Adds something to do together')
  } else {
    parts.push('Easy way to wind down')
  }

  // Vibe / comfort from known tags (soft, but sourced from catalog).
  const vibe = pickVibe(venue.vibe_tags)
  if (vibe) parts.push(vibe)

  // Indoor/outdoor only when known.
  if (ctx.indoor === true) parts.push('indoors')
  else if (ctx.indoor === false) parts.push('outdoors')

  // Budget signal only from computed fact.
  if (ctx.withinBudget) parts.push('comfortably within budget')

  // Travel context from the deterministic estimate.
  if (ctx.transitFromPrev) {
    const t = ctx.transitFromPrev
    parts.push(
      t.mode === 'walk'
        ? `a ${t.minutes}-min walk from the last stop`
        : `a short ${t.minutes}-min ride away`,
    )
  }

  if (ctx.weatherAdjusted) {
    parts.push('picked as a weather-friendly alternative')
  }

  // Assemble into one calm sentence.
  const [lead, ...rest] = parts
  if (rest.length === 0) return `${lead}.`
  return `${lead}: ${rest.join(', ')}.`
}

const VIBE_COPY: Record<string, string> = {
  romantic: 'quietly romantic',
  casual: 'relaxed and casual',
  conversation_friendly: 'good for actually talking',
  group_friendly: 'works well for a group',
  quiet: 'on the quieter side',
  photogenic: 'nice to look at',
  local_favorite: 'a local favorite',
  unusual: 'a little different',
  cozy: 'cozy',
  lively: 'lively',
}

function pickVibe(tags: string[]): string | null {
  for (const t of tags) {
    const key = t.toLowerCase().replace(/[\s-]+/g, '_')
    if (VIBE_COPY[key]) return VIBE_COPY[key]
  }
  return null
}
