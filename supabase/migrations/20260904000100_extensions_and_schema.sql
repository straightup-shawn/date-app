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
