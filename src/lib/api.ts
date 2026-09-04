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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string

/**
 * Call generate-flow with a plain fetch (not supabase.functions.invoke).
 * A direct fetch gives us a real AbortController timeout and predictable
 * response handling — invoke has been unreliable about surfacing the body.
 * Requires an (anonymous) session for the bearer token.
 */
export async function generateFlow(
  input: CreateInput,
): Promise<{ ok: true; data: GenerateResponse } | { ok: false; error: GenerateError }> {
  await ensureSession()

  // Get the current access token for the Authorization header.
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) {
    return { ok: false, error: { error: 'no_session', message: 'Please refresh and try again.' } }
  }

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

  // Hard timeout so the UI can never spin forever.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45000)

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-flow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timer)

    // Parse the body regardless of status; the function returns JSON either way.
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      /* non-JSON body */
    }

    if (!res.ok) {
      const err = (body as GenerateError) ?? { error: 'http_' + res.status }
      return { ok: false, error: err.error ? err : { error: 'http_' + res.status } }
    }

    const resp = body as GenerateResponse | GenerateError
    if (!resp || typeof resp !== 'object') {
      return { ok: false, error: { error: 'bad_response', message: 'Unexpected response. Please try again.' } }
    }
    if ('error' in resp) return { ok: false, error: resp as GenerateError }
    if (!('share_hash' in resp) || !resp.share_hash) {
      return { ok: false, error: { error: 'bad_response', message: 'No plan returned. Please try again.' } }
    }
    return { ok: true, data: resp as GenerateResponse }
  } catch (e) {
    clearTimeout(timer)
    const aborted = e instanceof DOMException && e.name === 'AbortError'
    return {
      ok: false,
      error: {
        error: aborted ? 'timeout' : 'network',
        message: aborted
          ? "This took too long. Please try again."
          : 'Network problem reaching the planner. Please try again.',
      },
    }
  }
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
