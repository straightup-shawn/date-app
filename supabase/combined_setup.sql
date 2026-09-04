-- Flow v7.1 � combined setup for Supabase SQL Editor.
-- Paste this ENTIRE file into Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run once on a fresh project.


-- ==== FILE: 20260904000100_extensions_and_schema.sql ====

-- ============================================================
-- Flow v7.1 — Migration 1: Extensions + Schema (Section 6)
-- ============================================================

create extension if not exists postgis;
create extension if not exists vector;
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ============================================================
-- VENUES
-- Persisted catalog. Geoapify-sourced data may be cached/stored,
-- making it suitable as the primary runtime data source.
-- ============================================================
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  external_id text,
  source text not null check (source in ('geoapify', 'manual', 'partner')),
  name text not null,
  neighborhood text not null,
  categories text[] not null default '{}',
  address text,
  coordinates geography(point, 4326) not null,
  price_bucket smallint,
  est_cost_total integer,
  rating numeric,
  opening_hours jsonb,
  booking_url text,
  website_url text,
  indoor boolean,
  outdoor boolean,
  experience_families text[] not null default '{}',
  vibe_tags text[] not null default '{}',
  semantic_profile text,
  semantic_embedding vector(2048),
  embedding_model text,
  embedding_updated_at timestamptz,
  pax_min smallint,
  pax_max smallint,
  price_confidence smallint not null default 30,
  hours_confidence smallint not null default 30,
  data_quality smallint not null default 50,
  is_active boolean not null default true,
  source_attribution text,
  source_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

create index venues_coordinates_gix
  on public.venues using gist (coordinates);

create index venues_neighborhood_idx
  on public.venues (neighborhood);

-- At MVP scale, exact pgvector search is acceptable.
-- Add HNSW/IVFFlat only after measuring a real need.

-- ============================================================
-- CURATED EVENTS
-- ============================================================
create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  venue_id uuid references public.venues(id),
  neighborhood text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  est_cost_total integer,
  booking_url text,
  indoor boolean,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- WEATHER CACHE
-- ============================================================
create table public.weather_cache (
  cache_key text primary key,
  neighborhood text,
  forecast_for timestamptz,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- ============================================================
-- DATE PASSES
-- creator_id is Supabase auth.users.id, including anonymous users.
-- ============================================================
create table public.itineraries (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  share_hash text unique not null,
  title text,
  neighborhood text not null,
  occasion text,
  time_window text,
  travel_preference text,
  experience_preference text,
  pax smallint not null default 2 check (pax between 1 and 20),
  budget_mode text not null default 'total' check (budget_mode in ('total','per_person')),
  budget_myr integer,
  total_budget_estimate integer,
  per_person_budget_estimate integer,
  constraints_snapshot jsonb,
  scheduled_for timestamptz,
  end_by timestamptz,
  weather_snapshot jsonb,
  overall_confidence smallint check (overall_confidence between 0 and 100),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index itineraries_creator_idx
  on public.itineraries (creator_id);

create index itineraries_share_hash_idx
  on public.itineraries (share_hash);

-- ============================================================
-- SNAPSHOT STOPS
-- Name/address/coordinates are snapshotted so old passes remain stable
-- even if the venue catalog changes.
-- ============================================================
create table public.itinerary_stops (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries(id) on delete cascade,
  venue_id uuid references public.venues(id),
  stop_order smallint not null,
  venue_name text not null,
  venue_address text,
  coordinates geography(point, 4326) not null,
  category text,
  fit_reason text not null,
  fact_confidence smallint,
  community_confidence smallint,
  scheduled_time time,
  duration_minutes integer,
  est_cost_total integer,
  transit_mode text,
  transit_time_mins integer,
  transit_distance_meters integer,
  route_geojson jsonb,
  booking_url text,
  created_at timestamptz not null default now(),
  unique (itinerary_id, stop_order)
);

-- ============================================================
-- CLICK EVENTS
-- ============================================================
create table public.stop_click_events (
  id bigint generated always as identity primary key,
  stop_id uuid not null references public.itinerary_stops(id) on delete cascade,
  destination text,
  clicked_at timestamptz not null default now()
);

-- ============================================================
-- RESEARCH EVIDENCE
-- Short-lived normalized evidence. Never store full articles/reviews.
-- ============================================================
create table public.research_evidence (
  id bigint generated always as identity primary key,
  venue_id uuid references public.venues(id) on delete cascade,
  source_url text not null,
  source_domain text,
  signal_type text not null,
  signal_strength smallint not null default 50,
  query_fingerprint text not null,
  observed_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index research_evidence_venue_idx
  on public.research_evidence (venue_id);

create index research_evidence_expiry_idx
  on public.research_evidence (expires_at);

-- ============================================================
-- RESEARCH QUERY CACHE
-- Normalized derived signals only; no raw article/review bodies.
-- ============================================================
create table public.research_query_cache (
  query_fingerprint text primary key,
  normalized_signals jsonb not null,
  source_urls jsonb not null default '[]'::jsonb,
  credits_used smallint not null default 0,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- ============================================================
-- RESEARCH CREDIT USAGE
-- Internal free-search budget guard.
-- ============================================================
create table public.research_credit_usage (
  month_start date primary key,
  credits_used integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- GEOAPIFY CREDIT USAGE
-- Conservative internal daily guard below the provider allowance.
-- ============================================================
create table public.geoapify_credit_usage (
  usage_date date primary key,
  credits_used integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- PRODUCT SIGNAL EVENTS
-- Privacy-minimized aggregate learning hooks.
-- ============================================================
create table public.pass_signal_events (
  id bigint generated always as identity primary key,
  itinerary_id uuid references public.itineraries(id) on delete cascade,
  stop_id uuid references public.itinerary_stops(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'generated',
      'regenerated',
      'stop_swapped',
      'saved',
      'shared',
      'outbound_clicked'
    )
  ),
  created_at timestamptz not null default now()
);

-- ============================================================
-- GENERATION RATE BUCKETS
-- Internal server-side counters. Never expose this table directly
-- to the browser.
-- ============================================================
create table public.generation_rate_buckets (
  scope text not null check (scope in ('user_hour', 'global_minute')),
  bucket_start timestamptz not null,
  bucket_key text not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (scope, bucket_start, bucket_key)
);

create index generation_rate_buckets_updated_idx
  on public.generation_rate_buckets (updated_at);

-- ============================================================
-- APP CONFIG (Section 12) — quota protection / kill switches
-- ============================================================
create table public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);


-- ==== FILE: 20260904000200_rls_and_privileges.sql ====

-- ============================================================
-- Flow v7.1 — Migration 2: RLS + Privilege Model (Section 6.1)
-- ============================================================
-- The browser uses the public anon key. Security comes from RLS,
-- narrow grants, and server-side (security definer) functions.

alter table public.venues enable row level security;
alter table public.events enable row level security;
alter table public.weather_cache enable row level security;
alter table public.itineraries enable row level security;
alter table public.itinerary_stops enable row level security;
alter table public.stop_click_events enable row level security;
alter table public.research_evidence enable row level security;
alter table public.research_query_cache enable row level security;
alter table public.research_credit_usage enable row level security;
alter table public.geoapify_credit_usage enable row level security;
alter table public.pass_signal_events enable row level security;
alter table public.generation_rate_buckets enable row level security;
alter table public.app_config enable row level security;

-- ------------------------------------------------------------
-- 6.1.1 Browser-readable owner data
-- Authenticated users (incl. anonymous) read only their own passes.
-- ------------------------------------------------------------
create policy "creator can select own itineraries"
on public.itineraries
for select
to authenticated
using (creator_id = auth.uid());

create policy "creator can select own stops"
on public.itinerary_stops
for select
to authenticated
using (
  exists (
    select 1
    from public.itineraries i
    where i.id = itinerary_stops.itinerary_id
      and i.creator_id = auth.uid()
  )
);

-- ------------------------------------------------------------
-- 6.1.2 Revoke broad client privileges, grant back only what is needed.
-- Writes go through server-controlled paths (Edge Functions / RPCs).
-- ------------------------------------------------------------
revoke all on table public.venues from anon, authenticated;
revoke all on table public.events from anon, authenticated;
revoke all on table public.weather_cache from anon, authenticated;
revoke all on table public.stop_click_events from anon, authenticated;
revoke all on table public.research_evidence from anon, authenticated;
revoke all on table public.research_query_cache from anon, authenticated;
revoke all on table public.research_credit_usage from anon, authenticated;
revoke all on table public.geoapify_credit_usage from anon, authenticated;
revoke all on table public.pass_signal_events from anon, authenticated;
revoke all on table public.generation_rate_buckets from anon, authenticated;
revoke all on table public.app_config from anon, authenticated;

revoke insert, update, delete on table public.itineraries from anon, authenticated;
revoke insert, update, delete on table public.itinerary_stops from anon, authenticated;

grant select on table public.itineraries to authenticated;
grant select on table public.itinerary_stops to authenticated;

-- Do not solve a permission error by granting anon full table access.


-- ==== FILE: 20260904000300_functions_rpcs.sql ====

-- ============================================================
-- Flow v7.1 — Migration 3: RPCs / SECURITY DEFINER functions
-- Sections 6.2–6.9 + keep-alive health_ping (Rule 11)
-- ============================================================

-- ------------------------------------------------------------
-- 6.2 Semantic Venue Match RPC
-- Browser never queries raw vectors directly. Candidates only;
-- hard filters run afterwards in the Edge Function.
-- ------------------------------------------------------------
create or replace function public.match_venues_semantic(
  p_query_embedding vector(2048),
  p_neighborhood text,
  p_match_count integer default 20
)
returns table (
  venue_id uuid,
  similarity double precision
)
language sql
security definer
set search_path = public
stable
as $$
  select
    v.id,
    1 - (v.semantic_embedding <=> p_query_embedding) as similarity
  from public.venues v
  where v.is_active = true
    and v.semantic_embedding is not null
    and (p_neighborhood is null or v.neighborhood = p_neighborhood)
  order by v.semantic_embedding <=> p_query_embedding
  limit greatest(1, least(p_match_count, 50));
$$;

revoke all on function public.match_venues_semantic(vector, text, integer) from public;
grant execute on function public.match_venues_semantic(vector, text, integer) to service_role;

-- ------------------------------------------------------------
-- 6.3 Public Share RPC — complete Date Pass payload
-- Returns only the pass matching a high-entropy share hash.
-- Returns null for unknown hash (no existence leak).
-- ------------------------------------------------------------
create or replace function public.get_date_pass(p_share_hash text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'id', i.id,
    'title', i.title,
    'neighborhood', i.neighborhood,
    'occasion', i.occasion,
    'time_window', i.time_window,
    'travel_preference', i.travel_preference,
    'experience_preference', i.experience_preference,
    'pax', i.pax,
    'budget_mode', i.budget_mode,
    'budget_myr', i.budget_myr,
    'scheduled_for', i.scheduled_for,
    'end_by', i.end_by,
    'total_budget_estimate', i.total_budget_estimate,
    'per_person_budget_estimate', i.per_person_budget_estimate,
    'overall_confidence', i.overall_confidence,
    'weather_snapshot', i.weather_snapshot,
    'stops', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'stop_order', s.stop_order,
          'venue_name', s.venue_name,
          'venue_address', s.venue_address,
          'category', s.category,
          'fit_reason', s.fit_reason,
          'fact_confidence', s.fact_confidence,
          'community_confidence', s.community_confidence,
          'scheduled_time', s.scheduled_time,
          'duration_minutes', s.duration_minutes,
          'est_cost_total', s.est_cost_total,
          'transit_mode', s.transit_mode,
          'transit_time_mins', s.transit_time_mins,
          'transit_distance_meters', s.transit_distance_meters,
          'coordinates', jsonb_build_object(
            'lat', st_y(s.coordinates::geometry),
            'lng', st_x(s.coordinates::geometry)
          ),
          'route_geojson',
            case
              when s.route_geojson is null then null
              else s.route_geojson
            end,
          'booking_url', s.booking_url
        )
        order by s.stop_order
      )
      from public.itinerary_stops s
      where s.itinerary_id = i.id
    ), '[]'::jsonb)
  )
  from public.itineraries i
  where i.share_hash = p_share_hash
  limit 1;
$$;

revoke all on function public.get_date_pass(text) from public;
grant execute on function public.get_date_pass(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 6.5 Atomic Generation Rate Limiter
-- ------------------------------------------------------------
create or replace function public.consume_generation_quota(
  p_user_id uuid,
  p_user_hour_limit integer,
  p_global_minute_limit integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_count integer;
  v_global_count integer;
  v_hour timestamptz := date_trunc('hour', now());
  v_minute timestamptz := date_trunc('minute', now());
begin
  insert into public.generation_rate_buckets
    (scope, bucket_start, bucket_key, request_count, updated_at)
  values
    ('user_hour', v_hour, p_user_id::text, 1, now())
  on conflict (scope, bucket_start, bucket_key)
  do update
    set request_count = generation_rate_buckets.request_count + 1,
        updated_at = now()
  returning request_count into v_user_count;

  if v_user_count > p_user_hour_limit then
    raise exception 'FLOW_RATE_LIMIT_USER';
  end if;

  insert into public.generation_rate_buckets
    (scope, bucket_start, bucket_key, request_count, updated_at)
  values
    ('global_minute', v_minute, '*', 1, now())
  on conflict (scope, bucket_start, bucket_key)
  do update
    set request_count = generation_rate_buckets.request_count + 1,
        updated_at = now()
  returning request_count into v_global_count;

  if v_global_count > p_global_minute_limit then
    raise exception 'FLOW_RATE_LIMIT_GLOBAL';
  end if;
end;
$$;

revoke all on function public.consume_generation_quota(uuid, integer, integer) from public;
grant execute on function public.consume_generation_quota(uuid, integer, integer) to service_role;

-- ------------------------------------------------------------
-- 6.6 Atomic Research Credit Guard
-- ------------------------------------------------------------
create or replace function public.consume_research_credits(
  p_credits integer,
  p_monthly_limit integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', now())::date;
  v_used integer;
begin
  if p_credits < 1 or p_credits > 2 then
    raise exception 'FLOW_RESEARCH_INVALID_CREDIT_COST';
  end if;

  insert into public.research_credit_usage (
    month_start, credits_used, updated_at
  )
  values (v_month, p_credits, now())
  on conflict (month_start)
  do update
    set credits_used = research_credit_usage.credits_used + p_credits,
        updated_at = now()
  returning credits_used into v_used;

  if v_used > p_monthly_limit then
    raise exception 'FLOW_RESEARCH_BUDGET_EXHAUSTED';
  end if;
end;
$$;

revoke all on function public.consume_research_credits(integer, integer) from public;
grant execute on function public.consume_research_credits(integer, integer) to service_role;

-- ------------------------------------------------------------
-- 6.7 Atomic Geoapify Daily Credit Guard
-- ------------------------------------------------------------
create or replace function public.consume_geoapify_credits(
  p_credits integer,
  p_daily_limit integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := current_date;
  v_used integer;
begin
  if p_credits < 1 or p_credits > 100 then
    raise exception 'FLOW_GEOAPIFY_INVALID_CREDIT_COST';
  end if;

  insert into public.geoapify_credit_usage (
    usage_date, credits_used, updated_at
  )
  values (v_day, p_credits, now())
  on conflict (usage_date)
  do update
    set credits_used = geoapify_credit_usage.credits_used + p_credits,
        updated_at = now()
  returning credits_used into v_used;

  if v_used > p_daily_limit then
    raise exception 'FLOW_GEOAPIFY_BUDGET_EXHAUSTED';
  end if;
end;
$$;

revoke all on function public.consume_geoapify_credits(integer, integer) from public;
grant execute on function public.consume_geoapify_credits(integer, integer) to service_role;

-- ------------------------------------------------------------
-- 6.8 Transactional Date Pass Persistence
-- Persist itinerary + all snapshot stops in ONE call (atomic).
-- ------------------------------------------------------------
create or replace function public.persist_generated_pass(
  p_creator_id uuid,
  p_share_hash text,
  p_title text,
  p_neighborhood text,
  p_occasion text,
  p_time_window text,
  p_travel_preference text,
  p_experience_preference text,
  p_pax smallint,
  p_budget_mode text,
  p_budget_myr integer,
  p_total_budget_estimate integer,
  p_per_person_budget_estimate integer,
  p_constraints_snapshot jsonb,
  p_scheduled_for timestamptz,
  p_end_by timestamptz,
  p_weather_snapshot jsonb,
  p_overall_confidence smallint,
  p_stops jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_itinerary_id uuid;
  v_stop jsonb;
  v_stop_count integer;
begin
  if p_creator_id is null then
    raise exception 'missing creator';
  end if;

  if not exists (
    select 1 from auth.users where id = p_creator_id
  ) then
    raise exception 'unknown creator';
  end if;

  if p_pax < 1 or p_pax > 20 then
    raise exception 'invalid pax';
  end if;

  if p_budget_mode not in ('total', 'per_person') then
    raise exception 'invalid budget mode';
  end if;

  if jsonb_typeof(p_stops) <> 'array' then
    raise exception 'stops must be an array';
  end if;

  v_stop_count := jsonb_array_length(p_stops);

  if v_stop_count < 2 or v_stop_count > 4 then
    raise exception 'invalid stop count';
  end if;

  insert into public.itineraries (
    creator_id, share_hash, title, neighborhood, occasion,
    time_window, travel_preference, experience_preference, pax,
    budget_mode, budget_myr, total_budget_estimate,
    per_person_budget_estimate, constraints_snapshot, scheduled_for,
    end_by, weather_snapshot, overall_confidence
  )
  values (
    p_creator_id, p_share_hash, p_title, p_neighborhood, p_occasion,
    p_time_window, p_travel_preference, p_experience_preference, p_pax,
    p_budget_mode, p_budget_myr, p_total_budget_estimate,
    p_per_person_budget_estimate, p_constraints_snapshot, p_scheduled_for,
    p_end_by, p_weather_snapshot, p_overall_confidence
  )
  returning id into v_itinerary_id;

  for v_stop in
    select value from jsonb_array_elements(p_stops)
  loop
    insert into public.itinerary_stops (
      itinerary_id, venue_id, stop_order, venue_name, venue_address,
      coordinates, category, fit_reason, fact_confidence,
      community_confidence, scheduled_time, duration_minutes,
      est_cost_total, transit_mode, transit_time_mins,
      transit_distance_meters, route_geojson, booking_url
    )
    values (
      v_itinerary_id,
      nullif(v_stop->>'venue_id', '')::uuid,
      (v_stop->>'stop_order')::smallint,
      v_stop->>'venue_name',
      nullif(v_stop->>'venue_address', ''),
      st_setsrid(
        st_makepoint(
          (v_stop->'coordinates'->>'lng')::double precision,
          (v_stop->'coordinates'->>'lat')::double precision
        ),
        4326
      )::geography,
      nullif(v_stop->>'category', ''),
      v_stop->>'fit_reason',
      nullif(v_stop->>'fact_confidence', '')::smallint,
      nullif(v_stop->>'community_confidence', '')::smallint,
      nullif(v_stop->>'scheduled_time', '')::time,
      nullif(v_stop->>'duration_minutes', '')::integer,
      nullif(v_stop->>'est_cost_total', '')::integer,
      nullif(v_stop->>'transit_mode', ''),
      nullif(v_stop->>'transit_time_mins', '')::integer,
      nullif(v_stop->>'transit_distance_meters', '')::integer,
      v_stop->'route_geojson',
      nullif(v_stop->>'booking_url', '')
    );
  end loop;

  return v_itinerary_id;
end;
$$;

revoke all on function public.persist_generated_pass(
  uuid, text, text, text, text, text, text, text, smallint, text,
  integer, integer, integer, jsonb, timestamptz, timestamptz,
  jsonb, smallint, jsonb
) from public;

grant execute on function public.persist_generated_pass(
  uuid, text, text, text, text, text, text, text, smallint, text,
  integer, integer, integer, jsonb, timestamptz, timestamptz,
  jsonb, smallint, jsonb
) to service_role;

-- ------------------------------------------------------------
-- 6.9 Click Tracking RPC (analytics, never blocks navigation)
-- ------------------------------------------------------------
create or replace function public.record_stop_click(
  p_stop_id uuid,
  p_destination text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_destination is null
     or char_length(p_destination) < 1
     or char_length(p_destination) > 80 then
    raise exception 'invalid destination';
  end if;

  if not exists (
    select 1
    from public.itinerary_stops
    where id = p_stop_id
  ) then
    raise exception 'unknown stop';
  end if;

  insert into public.stop_click_events (stop_id, destination)
  values (p_stop_id, p_destination);
end;
$$;

revoke all on function public.record_stop_click(uuid, text) from public;
grant execute on function public.record_stop_click(uuid, text) to anon, authenticated;

-- ------------------------------------------------------------
-- Keep-alive health RPC (Section 3A Rule 11)
-- Executes a real lightweight query so the project is not paused.
-- ------------------------------------------------------------
create or replace function public.health_ping()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object('ok', true, 'now', now());
$$;

revoke all on function public.health_ping() from public;
grant execute on function public.health_ping() to anon, authenticated;


-- ==== FILE: 20260904000500_venue_read_helpers.sql ====

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


-- ==== FILE: 20260904000600_embedding_helpers.sql ====

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


-- ==== FILE: 20260904000400 (config only) ====



-- ============================================================
-- Cron jobs — wrapped so setup does not hard-fail if pg_cron is
-- not yet enabled on the project. If this block is skipped, enable
-- pg_cron in Dashboard → Database → Extensions and re-run just this file.
-- ============================================================
do $$
begin
  perform cron.schedule(
    'delete-expired-weather-cache', '23 4 * * *',
    $job$ delete from public.weather_cache where expires_at < now() - interval '1 day'; $job$
  );
  perform cron.schedule(
    'disable-old-events', '37 4 * * *',
    $job$ update public.events set is_active = false where ends_at < now(); $job$
  );
  perform cron.schedule(
    'delete-expired-research-evidence', '13 5 * * *',
    $job$ delete from public.research_evidence where expires_at < now(); delete from public.research_query_cache where expires_at < now(); $job$
  );
  perform cron.schedule(
    'delete-old-generation-rate-buckets', '41 * * * *',
    $job$ delete from public.generation_rate_buckets where bucket_start < now() - interval '2 days'; $job$
  );
exception when others then
  raise notice 'Skipped cron scheduling (pg_cron not available yet): %', sqlerrm;
end $$;

