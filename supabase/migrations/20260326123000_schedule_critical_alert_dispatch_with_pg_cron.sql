-- Schedule automated dispatch of critical security alerts via pg_cron where available.
-- Safe behavior:
-- - If pg_cron is unavailable, this migration exits without failing.
-- - If pg_net is unavailable, this migration exits without failing.

DO $$
DECLARE
  v_has_pg_cron BOOLEAN;
  v_has_pg_net BOOLEAN;
  v_project_url TEXT;
  v_anon_key TEXT;
  v_cron_secret TEXT;
  v_sql TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) INTO v_has_pg_cron;

  SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
  ) INTO v_has_pg_net;

  IF NOT v_has_pg_cron THEN
    RAISE NOTICE 'pg_cron extension is not enabled. Skipping schedule creation.';
    RETURN;
  END IF;

  IF NOT v_has_pg_net THEN
    RAISE NOTICE 'pg_net extension is not enabled. Skipping schedule creation.';
    RETURN;
  END IF;

  v_project_url := current_setting('app.settings.project_url', true);
  v_anon_key := current_setting('app.settings.anon_key', true);
  v_cron_secret := current_setting('app.settings.security_alerts_cron_secret', true);

  IF v_project_url IS NULL OR btrim(v_project_url) = '' THEN
    RAISE NOTICE 'app.settings.project_url is missing. Skipping schedule creation.';
    RETURN;
  END IF;

  IF v_anon_key IS NULL OR btrim(v_anon_key) = '' THEN
    RAISE NOTICE 'app.settings.anon_key is missing. Skipping schedule creation.';
    RETURN;
  END IF;

  IF v_cron_secret IS NULL OR btrim(v_cron_secret) = '' THEN
    RAISE NOTICE 'app.settings.security_alerts_cron_secret is missing. Skipping schedule creation.';
    RETURN;
  END IF;

  -- Idempotency: remove existing job with same name if present.
  PERFORM cron.unschedule('dispatch-critical-alerts-every-2-minutes');

  v_sql := format($f$
    select
      net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L,
          'apikey', %L
        ),
        body := '{"limit":20}'::jsonb
      );
  $f$,
    v_project_url || '/functions/v1/dispatch-critical-alerts',
    v_cron_secret,
    v_anon_key
  );

  -- Every 2 minutes for near-real-time critical alerting.
  PERFORM cron.schedule(
    'dispatch-critical-alerts-every-2-minutes',
    '*/2 * * * *',
    v_sql
  );

  RAISE NOTICE 'Scheduled dispatch-critical-alerts job via pg_cron.';
END $$;
