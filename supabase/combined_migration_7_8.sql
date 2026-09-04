-- Flow v7.1 � migrations 7 & 8. Paste into Supabase SQL Editor and Run.


-- ==== 20260904000700_discovery_upsert.sql ====

-- ============================================================
-- Flow v7.1 — Migration 7: self-expanding catalog (Section 4.10)
-- Upsert a Geoapify-discovered venue. Idempotent on (source, external_id).
-- service_role only (called from the Edge Function runtime).
-- Returns the canonical venue id so the planner can reference it.
-- ============================================================

create or replace function public.upsert_discovered_venue(
  p_external_id text,
  p_name text,
  p_neighborhood text,
  p_categories text[],
  p_address text,
  p_lat double precision,
  p_lng double precision,
  p_price_bucket smallint,
  p_website_url text,
  p_indoor boolean,
  p_outdoor boolean,
  p_experience_families text[],
  p_semantic_profile text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_name is null or p_external_id is null then
    raise exception 'missing venue identity';
  end if;

  insert into public.venues (
    source, external_id, name, neighborhood, categories, address,
    coordinates, price_bucket, website_url, indoor, outdoor,
    experience_families, semantic_profile,
    price_confidence, hours_confidence, data_quality,
    source_attribution, source_fetched_at, is_active, updated_at
  )
  values (
    'geoapify', p_external_id, p_name, p_neighborhood,
    coalesce(p_categories, '{}'), p_address,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    p_price_bucket, p_website_url, p_indoor, p_outdoor,
    coalesce(p_experience_families, '{}'), p_semantic_profile,
    25, 15, 45,
    'Places data © Geoapify / OpenStreetMap contributors',
    now(), true, now()
  )
  on conflict (source, external_id)
  do update set
    name = excluded.name,
    neighborhood = excluded.neighborhood,
    categories = excluded.categories,
    address = coalesce(excluded.address, public.venues.address),
    coordinates = excluded.coordinates,
    website_url = coalesce(excluded.website_url, public.venues.website_url),
    indoor = excluded.indoor,
    outdoor = excluded.outdoor,
    experience_families = excluded.experience_families,
    semantic_profile = excluded.semantic_profile,
    source_fetched_at = now(),
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_discovered_venue(
  text, text, text, text[], text, double precision, double precision,
  smallint, text, boolean, boolean, text[], text
) from public;
grant execute on function public.upsert_discovered_venue(
  text, text, text, text[], text, double precision, double precision,
  smallint, text, boolean, boolean, text[], text
) to service_role;


-- ==== 20260904000800_worldwide_config.sql ====

-- ============================================================
-- Flow v7.1 — Migration 8: worldwide discovery config (Section 12)
-- Opens the app beyond seeded neighborhoods via live discovery.
-- ============================================================

insert into public.app_config (key, value) values
  -- Master switch for live Geoapify discovery (Layer B).
  ('discovery_enabled', 'true'::jsonb),
  -- When false, ANY geocodable area is allowed (worldwide).
  -- When true, only supported_neighborhoods are allowed (curated rollout).
  ('restrict_to_supported_neighborhoods', 'false'::jsonb),
  -- Discovery search radius (meters) around the geocoded area center.
  ('discovery_radius_meters', '2500'::jsonb),
  -- Max discovered venues fetched per experience family per generation.
  ('discovery_per_family_limit', '12'::jsonb),
  -- Minimum local catalog size before we bother calling discovery.
  ('discovery_min_local_venues', '8'::jsonb)
on conflict (key) do nothing;

