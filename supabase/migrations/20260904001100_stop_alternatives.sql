-- ============================================================
-- Flow v7.1 — Migration 11: per-stop alternatives (carousel)
-- Snapshot alternative options as JSONB on each stop, persisted atomically
-- with the pass and returned by get_date_pass.
-- ============================================================

alter table public.itinerary_stops
  add column if not exists alternatives jsonb not null default '[]'::jsonb;

-- Update persistence to include alternatives from the stop payload.
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
  if p_creator_id is null then raise exception 'missing creator'; end if;
  if not exists (select 1 from auth.users where id = p_creator_id) then
    raise exception 'unknown creator';
  end if;
  if p_pax < 1 or p_pax > 20 then raise exception 'invalid pax'; end if;
  if p_budget_mode not in ('total', 'per_person') then raise exception 'invalid budget mode'; end if;
  if jsonb_typeof(p_stops) <> 'array' then raise exception 'stops must be an array'; end if;
  v_stop_count := jsonb_array_length(p_stops);
  if v_stop_count < 2 or v_stop_count > 4 then raise exception 'invalid stop count'; end if;

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

  for v_stop in select value from jsonb_array_elements(p_stops)
  loop
    insert into public.itinerary_stops (
      itinerary_id, venue_id, stop_order, venue_name, venue_address,
      coordinates, category, fit_reason, fact_confidence,
      community_confidence, scheduled_time, duration_minutes,
      est_cost_total, transit_mode, transit_time_mins,
      transit_distance_meters, route_geojson, booking_url, alternatives
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
        ), 4326
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
      nullif(v_stop->>'booking_url', ''),
      coalesce(v_stop->'alternatives', '[]'::jsonb)
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

-- Update get_date_pass to return alternatives per stop.
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
          'route_geojson', case when s.route_geojson is null then null else s.route_geojson end,
          'booking_url', s.booking_url,
          'alternatives', coalesce(s.alternatives, '[]'::jsonb)
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
