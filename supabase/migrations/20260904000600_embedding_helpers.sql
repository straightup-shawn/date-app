-- ============================================================
-- Flow v7.1 — Migration 6: embedding batch helpers (Section 7)
-- Only re-embed changed venues (Rule 22). service_role only.
-- ============================================================

create or replace function public.venues_needing_embedding(
  p_model text,
  p_limit integer default 64
)
returns table (id uuid, semantic_profile text)
language sql
security definer
set search_path = public
stable
as $$
  select v.id, v.semantic_profile
  from public.venues v
  where v.semantic_profile is not null
    and v.is_active = true
    and (
      v.semantic_embedding is null
      or v.embedding_model is distinct from p_model
      or v.embedding_updated_at is null
      or v.embedding_updated_at < v.updated_at
    )
  limit greatest(1, least(p_limit, 256));
$$;

revoke all on function public.venues_needing_embedding(text, integer) from public;
grant execute on function public.venues_needing_embedding(text, integer) to service_role;

create or replace function public.set_venue_embedding(
  p_venue_id uuid,
  p_embedding vector(2048),
  p_model text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.venues
  set semantic_embedding = p_embedding,
      embedding_model = p_model,
      embedding_updated_at = now()
  where id = p_venue_id;
$$;

revoke all on function public.set_venue_embedding(uuid, vector, text) from public;
grant execute on function public.set_venue_embedding(uuid, vector, text) to service_role;
