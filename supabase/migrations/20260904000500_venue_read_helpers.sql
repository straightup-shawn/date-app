-- ============================================================
-- Flow v7.1 — Migration 5: venue read helpers for Edge Functions
-- Expose lat/lng from the geography column so the service-role
-- Edge Function can load candidates without raw PostGIS in JS.
-- These are service_role-only (internal tables, Section 6.10).
-- ============================================================

create or replace function public.venues_in_area(p_neighborhood text)
returns table (
  id uuid,
  name text,
  neighborhood text,
  categories text[],
  address text,
  lat double precision,
  lng double precision,
  price_bucket smallint,
  est_cost_total integer,
  rating numeric,
  opening_hours jsonb,
  booking_url text,
  website_url text,
  indoor boolean,
  outdoor boolean,
  experience_families text[],
  vibe_tags text[],
  pax_min smallint,
  pax_max smallint,
  price_confidence smallint,
  hours_confidence smallint,
  data_quality smallint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    v.id, v.name, v.neighborhood, v.categories, v.address,
    st_y(v.coordinates::geometry) as lat,
    st_x(v.coordinates::geometry) as lng,
    v.price_bucket, v.est_cost_total, v.rating, v.opening_hours,
    v.booking_url, v.website_url, v.indoor, v.outdoor,
    v.experience_families, v.vibe_tags, v.pax_min, v.pax_max,
    v.price_confidence, v.hours_confidence, v.data_quality
  from public.venues v
  where v.is_active = true
    and v.neighborhood = p_neighborhood;
$$;

revoke all on function public.venues_in_area(text) from public;
grant execute on function public.venues_in_area(text) to service_role;

create or replace function public.venues_by_ids(p_ids uuid[])
returns table (
  id uuid,
  name text,
  neighborhood text,
  categories text[],
  address text,
  lat double precision,
  lng double precision,
  price_bucket smallint,
  est_cost_total integer,
  rating numeric,
  opening_hours jsonb,
  booking_url text,
  website_url text,
  indoor boolean,
  outdoor boolean,
  experience_families text[],
  vibe_tags text[],
  pax_min smallint,
  pax_max smallint,
  price_confidence smallint,
  hours_confidence smallint,
  data_quality smallint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    v.id, v.name, v.neighborhood, v.categories, v.address,
    st_y(v.coordinates::geometry) as lat,
    st_x(v.coordinates::geometry) as lng,
    v.price_bucket, v.est_cost_total, v.rating, v.opening_hours,
    v.booking_url, v.website_url, v.indoor, v.outdoor,
    v.experience_families, v.vibe_tags, v.pax_min, v.pax_max,
    v.price_confidence, v.hours_confidence, v.data_quality
  from public.venues v
  where v.is_active = true
    and v.id = any(p_ids);
$$;

revoke all on function public.venues_by_ids(uuid[]) from public;
grant execute on function public.venues_by_ids(uuid[]) to service_role;
