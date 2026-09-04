// ============================================================
// Flow v7.1 — refresh-venue-embeddings (Section 7, admin/batch)
// Embeds venue semantic_profile passages and stores in pgvector.
// Only re-embeds venues that changed (Rule 22). Admin-only.
// If NIM is disabled, this is a no-op and deterministic ranking is used.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders, isAdmin } from '../_shared/env.ts'
import { loadConfig } from '../_shared/config.ts'
import { createSemanticProvider } from '../_shared/semantic.ts'

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: userData } = await userClient.auth.getUser()
  if (!userData?.user || !isAdmin(userData.user.id)) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const service = createClient(SUPABASE_URL, SERVICE_KEY)
  const cfg = await loadConfig(service)
  if (!cfg.nim_enabled || !cfg.nim_semantic_enabled) {
    return new Response(JSON.stringify({ ok: true, skipped: 'nim_disabled', embedded: 0 }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // Find venues needing (re)embedding: profile exists AND
  // (embedding missing OR model changed OR profile updated after embedding).
  const { data: rows, error } = await service.rpc('venues_needing_embedding', {
    p_model: cfg.nim_embed_model,
    p_limit: 64,
  })
  if (error) {
    return new Response(JSON.stringify({ error: 'query_failed' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const list = (rows as Array<{ id: string; semantic_profile: string }>) ?? []
  if (list.length === 0) {
    return new Response(JSON.stringify({ ok: true, embedded: 0 }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const provider = createSemanticProvider(cfg.nim_embed_model)
  const vectors = await provider.embedPassages(list.map((v) => v.semantic_profile))
  if (!vectors) {
    // Fail open: leave embeddings stale, deterministic ranking still works.
    return new Response(JSON.stringify({ ok: true, embedded: 0, note: 'nim_unavailable' }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  let embedded = 0
  for (let i = 0; i < list.length; i++) {
    const { error: upErr } = await service.rpc('set_venue_embedding', {
      p_venue_id: list[i].id,
      p_embedding: vectors[i],
      p_model: cfg.nim_embed_model,
    })
    if (!upErr) embedded++
  }

  return new Response(JSON.stringify({ ok: true, embedded }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
