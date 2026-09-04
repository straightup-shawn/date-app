-- ============================================================
-- Flow v7.1 — Migration 9: tune discovered-venue confidence baselines
-- Discovered places are still clearly "estimated" but less punitive so
-- worldwide plans feel less tentative. Also refreshes existing rows.
-- ============================================================

-- Redefine the upsert RPC with the new baselines (35 / 30 / 55).
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
    35, 30, 55,
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

-- Refresh already-discovered rows to the new baselines.
update public.venues
set price_confidence = 35, hours_confidence = 30, data_quality = 55
where source = 'geoapify'
  and (data_quality < 55 or hours_confidence < 30);
