-- supabase/migrations/20260421110000_harden_analytics_rpc.sql
-- ============================================================================
-- RPC HARDENING: Ensuring Reliable Analytics Retrieval (Final Hardened Version)
-- ============================================================================

-- 1. RE-DECLARE THE ANALYTICS RPC WITH SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_tank_analytics_30d(p_station_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
    -- 1. Authorization Check: Ensure the caller belongs to the station
    IF NOT (
        EXISTS (SELECT 1 FROM public.profiles WHERE auth_user_id = auth.uid() AND station_id = p_station_id)
        OR (SELECT (raw_user_meta_data->>'is_admin')::boolean FROM auth.users WHERE id = auth.uid()) = true
    ) THEN
        RAISE EXCEPTION 'Unauthorized: User does not have access to this station analytics';
    END IF;

    -- 2. Direct Return to avoid VARIABLE/RELATION ambiguity (v_result removed)
    RETURN (
        WITH daily_stats AS (
            SELECT 
                t.tank_name,
                t.fuel_type,
                COALESCE(SUM(ft.amount), 0) as total_volume,
                COALESCE(AVG(ft.amount), 0) as avg_daily,
                COALESCE(jsonb_agg(jsonb_build_object(
                    'date', ft.timestamp,
                    'volume', ft.amount
                ) ORDER BY ft.timestamp ASC) FILTER (WHERE ft.id IS NOT NULL), '[]'::jsonb) as trend_data
            FROM tanks t
            LEFT JOIN fuel_transactions ft ON t.id = ft.tank_id
            WHERE t.station_id = p_station_id 
              AND (ft.timestamp > (now() - interval '30 days') OR ft.timestamp IS NULL)
            GROUP BY t.id, t.tank_name, t.fuel_type
        )
        SELECT jsonb_build_object(
            'timestamp', now(),
            'station_id', p_station_id,
            'summary', COALESCE(jsonb_agg(s), '[]'::jsonb)
        )
        FROM daily_stats s
    );
END;
$$;

-- 2. ENSURE PERMISSIONS ARE EXPLICIT
GRANT EXECUTE ON FUNCTION public.get_tank_analytics_30d(UUID) TO authenticated;

-- 3. NOTIFY POSTGREST TO RELOAD SCHEMA
NOTIFY pgrst, 'reload schema';
