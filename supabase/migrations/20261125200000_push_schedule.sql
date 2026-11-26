-- LIVE ONLY (needs pg_cron and pg_net, which the plain Postgres used in CI does not have).
-- Runs the Coach every 10 minutes and keeps the log small. The secret is read from the private
-- table at run time, so it is never written into the schedule text.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('learivo-push-tick') where exists (select 1 from cron.job where jobname = 'learivo-push-tick');
select cron.schedule(
  'learivo-push-tick',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://vmtbqoqyplsfmxyjcoiy.supabase.co/functions/v1/push/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', (select value from private.push_secrets where name = 'cron')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

select cron.unschedule('learivo-push-cleanup') where exists (select 1 from cron.job where jobname = 'learivo-push-cleanup');
select cron.schedule(
  'learivo-push-cleanup',
  '17 3 * * *',
  $$ delete from public.push_log where sent_at < now() - interval '60 days' $$
);
