-- ============================================================
-- Flow v7.1 — Migration 10: persist vibe_tags on discovered venues
-- so occasion/vibe scoring works for worldwide (Geoapify) results.
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
  p_semantic_profile text,
  p_vibe_tags text[] default '{}',
  p_data_quality smallint default 55
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
    experience_families, semantic_profile, vibe_tags,
    price_confidence, hours_confidence, data_quality,
    source_attribution, source_fetched_at, is_active, updated_at
  )
  values (
    'geoapify', p_external_id, p_name, p_neighborhood,
    coalesce(p_categories, '{}'), p_address,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    p_price_bucket, p_website_url, p_indoor, p_outdoor,
    coalesce(p_experience_families, '{}'), p_semantic_profile,
    coalesce(p_vibe_tags, '{}'),
    35, 30, coalesce(p_data_quality, 55),
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
    vibe_tags = excluded.vibe_tags,
    data_quality = excluded.data_quality,
    source_fetched_at = now(),
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_discovered_venue(
  text, text, text, text[], text, double precision, double precision,
  smallint, text, boolean, boolean, text[], text, text[], smallint
) from public;
grant execute on function public.upsert_discovered_venue(
  text, text, text, text[], text, double precision, double precision,
  smallint, text, boolean, boolean, text[], text, text[], smallint
) to service_role;
