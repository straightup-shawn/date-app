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
