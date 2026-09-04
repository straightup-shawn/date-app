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
