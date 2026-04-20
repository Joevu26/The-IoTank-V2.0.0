-- supabase/migrations/20260421190000_restore_audit_and_fix_crons.sql
-- ============================================================================
-- AUDIT & INTELLIGENCE REPAIR: Restore lost forensic triggers and fix CRON URLs
-- ============================================================================

-- 1. RE-ATTACH AUDIT TRIGGERS (Restores the Event Logs)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_trigger_handler()
RETURNS TRIGGER AS $$
DECLARE
    v_station_id UUID;
    v_actor_name TEXT;
    v_category TEXT := 'SYSTEM';
    v_should_audit BOOLEAN := TRUE;
BEGIN
    -- Resolve station_id
    v_station_id := COALESCE(NEW.station_id, OLD.station_id);

    -- ── TELEMETRY FILTERING ─────────────────
    IF TG_TABLE_NAME = 'tanks' AND TG_OP = 'UPDATE' THEN
        IF (OLD.* IS NOT DISTINCT FROM NEW.*) THEN v_should_audit := FALSE;
        ELSIF (OLD.current_volume IS DISTINCT FROM NEW.current_volume OR OLD.last_reading_at IS DISTINCT FROM NEW.last_reading_at)
              AND OLD.tank_name = NEW.tank_name AND OLD.tank_capacity = NEW.tank_capacity THEN
            v_should_audit := FALSE; -- Ignore routine telemetry
        END IF;
    END IF;

    IF NOT v_should_audit THEN RETURN NEW; END IF;

    -- ── CATEGORY ASSIGNMENT ──────────────────
    IF TG_TABLE_NAME IN ('fuel_transactions', 'deliveries') THEN v_category := 'DELIVERY';
    ELSIF TG_TABLE_NAME = 'shift_closures' THEN v_category := 'SHIFT';
    ELSIF TG_TABLE_NAME = 'alerts' THEN v_category := 'SECURITY';
    ELSIF TG_TABLE_NAME = 'billing' THEN v_category := 'FINANCE';
    END IF;

    -- Attempt to get actor name
    SELECT display_name INTO v_actor_name FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1;

    INSERT INTO public.unified_events (
        station_id, event_category, event_type, description, 
        actor_id, actor_email, actor_name, metadata
    )
    VALUES (
        v_station_id, v_category, TG_TABLE_NAME || '_' || TG_OP,
        'Forensic audit: ' || TG_OP || ' on ' || TG_TABLE_NAME,
        auth.uid(), auth.jwt()->>'email', COALESCE(v_actor_name, auth.jwt()->>'email', 'SYSTEM'),
        jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ 
BEGIN
    -- Attach to tanks
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_audit_tanks') THEN
        CREATE TRIGGER trigger_audit_tanks AFTER INSERT OR UPDATE OR DELETE ON public.tanks FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_handler();
    END IF;
    -- Attach to alerts
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_audit_alerts') THEN
        CREATE TRIGGER trigger_audit_alerts AFTER INSERT OR UPDATE OR DELETE ON public.alerts FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_handler();
    END IF;
    -- Attach to deliveries
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_audit_deliveries') THEN
        CREATE TRIGGER trigger_audit_deliveries AFTER INSERT OR UPDATE OR DELETE ON public.fuel_transactions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_handler();
    END IF;
    -- Attach to shifts
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_audit_shifts') THEN
        CREATE TRIGGER trigger_audit_shifts AFTER INSERT OR UPDATE OR DELETE ON public.shift_closures FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_handler();
    END IF;
END $$;

-- 2. REPAIR CRON JOBS (Fixes the hard-coded URL issue)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_project_url TEXT;
  v_anon_key TEXT;
BEGIN
  v_project_url := current_setting('app.settings.project_url', true);
  v_anon_key := current_setting('app.settings.anon_key', true);

  IF v_project_url IS NULL OR v_project_url = '' THEN
    RAISE NOTICE 'app.settings.project_url not set. Crons will remain pointing to default.';
    RETURN;
  END IF;

  -- Unschedules all to prevent duplicates/zombies
  PERFORM cron.unschedule('connectivity-watchdog-30m');
  PERFORM cron.unschedule('market-fetch-every-hour');
  PERFORM cron.unschedule('detect-leaks-every-4h');
  PERFORM cron.unschedule('daily-analytics-rollup-midnight');

  -- Re-schedule with DYNAMIC URLs
  PERFORM cron.schedule(
    'connectivity-watchdog-30m',
    '*/30 * * * *',
    format('select net.http_post(url := %L, headers := jsonb_build_object(%L, %L, %L, %L), body := %L)',
      v_project_url || '/functions/v1/connectivity-watchdog',
      'Content-Type', 'application/json',
      'apikey', v_anon_key,
      '{}'::jsonb
    )
  );

  PERFORM cron.schedule(
    'market-fetch-every-hour',
    '0 * * * *',
    format('select net.http_post(url := %L, headers := jsonb_build_object(%L, %L, %L, %L), body := %L)',
      v_project_url || '/functions/v1/market-intelligence-fetcher',
      'Content-Type', 'application/json',
      'apikey', v_anon_key,
      '{}'::jsonb
    )
  );

  PERFORM cron.schedule(
    'detect-leaks-every-4h',
    '0 */4 * * *',
    format('select net.http_post(url := %L, headers := jsonb_build_object(%L, %L, %L, %L), body := %L)',
      v_project_url || '/functions/v1/detect-leaks',
      'Content-Type', 'application/json',
      'apikey', v_anon_key,
      '{}'::jsonb
    )
  );

  PERFORM cron.schedule(
    'daily-analytics-rollup-midnight',
    '0 0 * * *',
    format('select net.http_post(url := %L, headers := jsonb_build_object(%L, %L, %L, %L), body := %L)',
      v_project_url || '/functions/v1/daily-analytics-rollup',
      'Content-Type', 'application/json',
      'apikey', v_anon_key,
      '{}'::jsonb
    )
  );

END $$;
