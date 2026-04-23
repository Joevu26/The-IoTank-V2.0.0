-- Schedule the Unified Alert Engine via pg_cron
-- Every minute background monitoring for level breaches, telemetry gaps, and theft signatures.

-- 1. Ensure the system_settings table exists to bypass restricted global PG settings
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Logic to schedule the job using settings table or global context fallback
DO $$
DECLARE
  v_has_pg_cron BOOLEAN;
  v_has_pg_net BOOLEAN;
  v_project_url TEXT;
  v_anon_key TEXT;
  v_cron_secret TEXT;
  v_sql TEXT;
BEGIN
  -- Extension Check
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') INTO v_has_pg_cron;
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') INTO v_has_pg_net;

  IF NOT v_has_pg_cron THEN
    RAISE NOTICE 'pg_cron extension is not enabled. Skipping schedule creation.';
    RETURN;
  END IF;

  IF NOT v_has_pg_net THEN
    RAISE NOTICE 'pg_net extension is not enabled. Skipping schedule creation.';
    RETURN;
  END IF;

  -- Attempt to get settings from global config (fallback) or system_settings table (primary)
  SELECT value INTO v_project_url FROM public.system_settings WHERE key = 'project_url';
  IF v_project_url IS NULL THEN 
    v_project_url := current_setting('app.settings.project_url', true);
  END IF;

  SELECT value INTO v_anon_key FROM public.system_settings WHERE key = 'anon_key';
  IF v_anon_key IS NULL THEN
    v_anon_key := current_setting('app.settings.anon_key', true);
  END IF;

  SELECT value INTO v_cron_secret FROM public.system_settings WHERE key = 'security_alerts_cron_secret';
  IF v_cron_secret IS NULL THEN
    v_cron_secret := current_setting('app.settings.security_alerts_cron_secret', true);
  END IF;

  -- Validation
  IF v_project_url IS NULL OR btrim(v_project_url) = '' THEN
    RAISE NOTICE 'Project URL not found in system_settings or global config. Skipping schedule.';
    RETURN;
  END IF;

  IF v_anon_key IS NULL OR btrim(v_anon_key) = '' THEN
    RAISE NOTICE 'Anon Key not found in system_settings or global config. Skipping schedule.';
    RETURN;
  END IF;

  -- Idempotency: remove existing job if present
  PERFORM cron.unschedule('alert-engine-every-minute');

  v_sql := format($f$
    select
      net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L,
          'apikey', %L
        ),
        body := '{}'::jsonb
      );
  $f$,
    v_project_url || '/functions/v1/alert-engine',
    COALESCE(v_cron_secret, v_anon_key), 
    v_anon_key
  );

  -- Every 1 minute for high-fidelity monitoring
  PERFORM cron.schedule(
    'alert-engine-every-minute',
    '* * * * *',
    v_sql
  );

  RAISE NOTICE 'Scheduled alert-engine job via pg_cron.';
END $$;
