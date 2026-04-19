-- ============================================================================
-- 1. RESTORE BACKWARD COMPATIBILITY: is_system_admin(INTEGER)
-- This resolves the 42883 error caused by a previous signature change.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_system_admin(minimum_level INTEGER)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
    -- Map legacy integer levels to the new text-based hierarchy check
    -- 1=super, 2=helper, 3=staff, 4=analyst
    RETURN public.get_auth_level() <= minimum_level;
END;
$$;

-- 2. UPDATE RLS FOR current_station_shifts
-- ============================================================================
DROP POLICY IF EXISTS "Station members can view shift status" ON public.current_station_shifts;
CREATE POLICY "Station members can view shift status"
    ON public.current_station_shifts
    FOR SELECT
    USING (
        station_id = (SELECT get_station_id_from_auth())
        OR public.is_system_admin(3)
    );

DROP POLICY IF EXISTS "Station members can update shift status" ON public.current_station_shifts;
CREATE POLICY "Station members can update shift status"
    ON public.current_station_shifts
    FOR ALL
    USING (
        station_id = (SELECT get_station_id_from_auth())
        OR public.is_system_admin()
    );

-- 2. UPDATE RLS FOR shift_closures
-- ============================================================================
DROP POLICY IF EXISTS "Station members can view shift logs" ON public.shift_closures;
CREATE POLICY "Station members can view shift logs"
    ON public.shift_closures
    FOR SELECT
    USING (
        station_id = (SELECT get_station_id_from_auth())
        OR public.is_system_admin()
    );

DROP POLICY IF EXISTS "Station members can insert shift logs" ON public.shift_closures;
CREATE POLICY "Station members can insert shift logs"
    ON public.shift_closures
    FOR INSERT
    WITH CHECK (
        station_id = (SELECT get_station_id_from_auth())
        OR public.is_system_admin()
    );

-- 3. NOTIFY PostgREST
-- ============================================================================
NOTIFY pgrst, 'reload schema';
