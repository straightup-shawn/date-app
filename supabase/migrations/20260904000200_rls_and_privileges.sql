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
