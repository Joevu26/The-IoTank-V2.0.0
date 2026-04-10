-- supabase/migrations/20260411000001_fix_security_lints.sql
-- ============================================================================
-- AUDIT REMEDIATION: Security Lint Fixes
-- ============================================================================

-- 1. Fix: function_search_path_mutable
-- Enforce a fixed search_path to prevent malicious path hijacking 
ALTER FUNCTION public.check_sensor_station_lock() SET search_path = public;
ALTER FUNCTION public.refresh_tank_analytics() SET search_path = public;

-- For get_user_client_id, we just ensure it defers cleanly (or we can just set it to public)
ALTER FUNCTION public.get_user_client_id() SET search_path = public, auth;


-- 2. Fix: materialized_view_in_api
-- Materialized views bypass RLS. Revoke direct frontend access.
REVOKE ALL ON public.tank_analytics_30d FROM anon, authenticated;

-- Create an RLS-enforcing RPC wrapper instead to allow secure frontend queries
CREATE OR REPLACE FUNCTION public.get_tank_analytics_30d(p_station_id uuid)
RETURNS SETOF public.tank_analytics_30d
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Authorization check: Ensure user belongs to the requested station
    -- or has elevated system admin privileges.
    IF public.get_user_station_id() != p_station_id AND NOT public.is_system_admin('support_staff') THEN
        RAISE EXCEPTION 'Unauthorized: User is not linked to station %', p_station_id;
    END IF;

    -- Return the view data safely filtered
    RETURN QUERY SELECT * FROM public.tank_analytics_30d WHERE station_id = p_station_id;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.get_tank_analytics_30d(uuid) TO authenticated;

-- Reload schema cache to apply API revocation immediately
NOTIFY pgrst, 'reload schema';
