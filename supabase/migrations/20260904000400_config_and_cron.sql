-- ============================================================
-- Flow v7.1 — Migration 4: app_config defaults + Cron jobs
-- Sections 12 + 8
-- ============================================================

-- ------------------------------------------------------------
-- Section 12 — default config / kill switches.
-- The generation function reads these server-side before optional API calls.
-- ------------------------------------------------------------
insert into public.app_config (key, value) values
  ('routing_enabled', 'true'::jsonb),
  ('weather_live_enabled', 'true'::jsonb),
  ('research_enabled', 'true'::jsonb),
  ('research_provider', '"tavily"'::jsonb),
  ('research_monthly_credit_budget', '850'::jsonb),
  ('research_max_credits_per_generation', '2'::jsonb),
  ('research_trigger_confidence', '82'::jsonb),
  ('research_deep_trigger_confidence', '65'::jsonb),
  ('nim_enabled', 'true'::jsonb),
  ('nim_semantic_enabled', 'true'::jsonb),
  ('nim_reasoning_enabled', 'true'::jsonb),
  ('nim_embed_model', '"nvidia/nemotron-3-embed-1b"'::jsonb),
  ('nim_reasoning_model', '"nvidia/nemotron-3.5-lightning-30b-a3b"'::jsonb),
  ('nim_semantic_min_similarity', '0.55'::jsonb),
  ('nim_reasoning_trigger_confidence', '70'::jsonb),
  ('nim_soft_requests_per_minute', '20'::jsonb),
  ('geoapify_daily_credit_budget', '2500'::jsonb),
  ('weather_soft_calls_per_minute', '40'::jsonb),
  ('max_generations_per_user_per_hour', '10'::jsonb),
  ('max_generations_global_per_minute', '30'::jsonb),
  ('supported_neighborhoods', '["Bukit Bintang"]'::jsonb)
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- Section 8 — Scheduled Jobs (Supabase Cron / pg_cron)
-- ------------------------------------------------------------

-- Expired weather cache cleanup
select cron.schedule(
  'delete-expired-weather-cache',
  '23 4 * * *',
  $$
    delete from public.weather_cache
    where expires_at < now() - interval '1 day';
  $$
);

-- Event cleanup
select cron.schedule(
  'disable-old-events',
  '37 4 * * *',
  $$
    update public.events
    set is_active = false
    where ends_at < now();
  $$
);

-- Research evidence / cache cleanup
select cron.schedule(
  'delete-expired-research-evidence',
  '13 5 * * *',
  $$
    delete from public.research_evidence
    where expires_at < now();

    delete from public.research_query_cache
    where expires_at < now();
  $$
);

-- Rate-bucket cleanup — keep only recent counters
select cron.schedule(
  'delete-old-generation-rate-buckets',
  '41 * * * *',
  $$
    delete from public.generation_rate_buckets
    where bucket_start < now() - interval '2 days';
  $$
);
