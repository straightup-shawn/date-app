// ============================================================
// Flow v7.1 — Browser Supabase client.
// Uses the PUBLIC anon key only. Security comes from RLS + narrow RPCs.
// ============================================================
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  // Surface a clear developer message rather than a cryptic runtime crash.
  console.warn(
    '[Flow] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill them in.',
  )
}

export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'public-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})

/**
 * Ensure an auth session exists (anonymous by default, Section 6.4).
 * Creates a real Supabase Auth user without asking for email/password.
 */
export async function ensureSession(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    const { error } = await supabase.auth.signInAnonymously()
    if (error) throw error
  }
}
