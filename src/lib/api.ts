// ============================================================
// Flow v7.1 — Frontend data access layer.
// ============================================================
import { ensureSession, supabase } from './supabase'
import type {
  CreateInput,
  DatePass,
  GenerateError,
  GenerateResponse,
  SavedPassRow,
} from './types'

/** Call generate-flow. Requires an (anonymous) session. */
export async function generateFlow(
  input: CreateInput,
): Promise<{ ok: true; data: GenerateResponse } | { ok: false; error: GenerateError }> {
  await ensureSession()

  const payload = {
    neighborhood: input.neighborhood,
    occasion: input.occasion,
    pax: input.pax,
    time_window: input.time_window,
    budget: { mode: input.budget_mode, amount_myr: input.budget_myr },
    travel_preference: input.travel_preference,
    experience_preference: input.experience_preference,
    preferences: input.preferences,
    free_text: input.free_text ?? '',
  }

  const { data, error } = await supabase.functions.invoke('generate-flow', {
    body: payload,
  })

  if (error) {
    // functions.invoke surfaces non-2xx as an error with a context response.
    let parsed: GenerateError = { error: 'unknown' }
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx) parsed = (await ctx.json()) as GenerateError
    } catch {
      /* ignore */
    }
    return { ok: false, error: parsed }
  }

  const resp = data as GenerateResponse | GenerateError
  if ('error' in resp) return { ok: false, error: resp }
  return { ok: true, data: resp }
}

/** Fetch a public Date Pass by share hash (no account required). */
export async function fetchDatePass(shareHash: string): Promise<DatePass | null> {
  const { data, error } = await supabase.rpc('get_date_pass', {
    p_share_hash: shareHash,
  })
  if (error || !data) return null
  return data as DatePass
}

/** List the current user's saved passes (RLS: own rows only). */
export async function listSavedPasses(): Promise<SavedPassRow[]> {
  await ensureSession()
  const { data, error } = await supabase
    .from('itineraries')
    .select(
      'id, share_hash, title, neighborhood, pax, total_budget_estimate, overall_confidence, created_at',
    )
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data as SavedPassRow[]
}

/** Fire-and-forget outbound click tracking. Never blocks navigation. */
export function recordStopClick(stopId: string, destination: string): void {
  supabase
    .rpc('record_stop_click', { p_stop_id: stopId, p_destination: destination })
    .then(
      () => {},
      () => {},
    )
}
