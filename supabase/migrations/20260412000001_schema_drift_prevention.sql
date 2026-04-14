-- supabase/migrations/20260411000011_schema_drift_prevention.sql
-- ============================================================================
-- PRODUCTION SCHEMA INTEGRITY VALIDATOR
-- ============================================================================
-- This script provides a diagnostic function that the frontend or admins
-- can call to verify that all necessary columns exist before executing
-- sensitive RPCs. This prevents "fatal 400" crashes in production.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_core_schema()
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_catalog, information_schema
LANGUAGE plpgsql
AS $$
DECLARE
    v_missing_columns TEXT[] := '{}';
    v_report JSONB;
BEGIN

    -- 1. Check Profiles Table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'auth_user_id') THEN
        v_missing_columns := array_append(v_missing_columns, 'profiles.auth_user_id');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'station_id') THEN
        v_missing_columns := array_append(v_missing_columns, 'profiles.station_id');
    END IF;

    -- 2. Check Fuel Stations Table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fuel_stations' AND column_name = 'station_id') THEN
        v_missing_columns := array_append(v_missing_columns, 'fuel_stations.station_id');
    END IF;

    -- 3. Check System Users Table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_users' AND column_name = 'auth_user_id') THEN
        v_missing_columns := array_append(v_missing_columns, 'system_users.auth_user_id');
    END IF;

    -- 4. Build Report
    IF array_length(v_missing_columns, 1) > 0 THEN
        v_report := jsonb_build_object(
            'status', 'failed',
            'healthy', false,
            'missing_critical_columns', v_missing_columns,
            'recommendation', 'Production schema drift detected. Run definitive identity fix migration immediately.'
        );
    ELSE
        v_report := jsonb_build_object(
            'status', 'passed',
            'healthy', true,
            'message', 'All core auth columns verified. Safe to execute get_user_bundle_v2.'
        );
    END IF;

    RETURN v_report;
END;
$$;
