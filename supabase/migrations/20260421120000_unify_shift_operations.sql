-- supabase/migrations/20260421120000_unify_shift_operations.sql
-- ============================================================================
-- UNIFIED SHIFT OPERATIONS: Multi-Event Forensic Logging
-- ============================================================================

-- 1. ADD station_id TO shift_closures (Unify identifiers)
-- ============================================================================
-- station_id already exists from standardizing migrations, we just ensure it's there if not.
ALTER TABLE public.shift_closures 
ADD COLUMN IF NOT EXISTS station_id UUID REFERENCES public.fuel_stations(station_id) ON DELETE CASCADE;

-- 2. ADD operation_type & action_label
-- ============================================================================
ALTER TABLE public.shift_closures 
ADD COLUMN IF NOT EXISTS operation_type TEXT DEFAULT 'CLOSE' CHECK (operation_type IN ('OPEN', 'CLOSE')),
ADD COLUMN IF NOT EXISTS action_label TEXT;

-- 3. UPDATING RLS POLICIES
-- ============================================================================
ALTER TABLE public.shift_closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Station members can view shift logs" ON public.shift_closures;
CREATE POLICY "Station members can view shift logs"
    ON public.shift_closures
    FOR SELECT
    USING (station_id = (SELECT get_station_id_from_auth()));

DROP POLICY IF EXISTS "Station members can insert shift logs" ON public.shift_closures;
CREATE POLICY "Station members can insert shift logs"
    ON public.shift_closures
    FOR INSERT
    WITH CHECK (station_id = (SELECT get_station_id_from_auth()));

-- 4. Enable Realtime
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'shift_closures'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_closures;
    END IF;
END $$;
