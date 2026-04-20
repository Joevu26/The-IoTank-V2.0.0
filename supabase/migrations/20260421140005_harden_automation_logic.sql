-- AUTOMATION HARDENING: SAFE SCHEMA EVOLUTION
-- Ensures unified identity mapping and resilient automation triggers.

-- 1. Hardening Utility: Safe Table Hardening
CREATE OR REPLACE FUNCTION public.safe_harden_table(p_table_name text, p_firebase_col text DEFAULT 'firebase_uid')
RETURNS void AS $$
BEGIN
    -- Only proceed if the table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = p_table_name) THEN
        RETURN;
    END IF;

    -- Add supabase_uid if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = p_table_name AND column_name = 'supabase_uid') THEN
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN supabase_uid UUID REFERENCES auth.users(id)', p_table_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(supabase_uid)', 'idx_' || p_table_name || '_supabase_uid', p_table_name);
    END IF;

    -- Make firebase column nullable if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = p_table_name AND column_name = p_firebase_col) THEN
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', p_table_name, p_firebase_col);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Apply Hardening to Core Tables
SELECT public.safe_harden_table('profiles');
SELECT public.safe_harden_table('fuel_stations');
SELECT public.safe_harden_table('tanks');
SELECT public.safe_harden_table('fuel_inventory_log');
SELECT public.safe_harden_table('sensor_readings');
SELECT public.safe_harden_table('alerts');

-- 3. Automation Resiliency: Defensive pg_cron Management
CREATE OR REPLACE FUNCTION public.safe_unschedule_job(p_job_name text)
RETURNS void AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = p_job_name) THEN
        PERFORM cron.unschedule(p_job_name);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Clean up any malformed legacy schedules
SELECT public.safe_unschedule_job('connectivity-watchdog');
SELECT public.safe_unschedule_job('market-fetcher');
SELECT public.safe_unschedule_job('leak-detection');

-- 4. Final Verification: Ensure pg_cron setup is robust
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        CREATE EXTENSION IF NOT EXISTS pg_cron;
    END IF;
END;
$$;
