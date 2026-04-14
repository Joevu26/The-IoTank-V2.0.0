-- supabase/migrations/20260411000008_unified_security_remediation.sql
-- ============================================================================
-- SECURITY REMEDIATION: Unified Event Timeline & Stateless Shift Control
-- ============================================================================

-- 1. UNIFIED EVENTS TABLE (The forensic ledger)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.unified_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID REFERENCES public.fuel_stations(station_id) ON DELETE CASCADE,
    event_category TEXT NOT NULL CHECK (event_category IN ('SHIFT', 'DELIVERY', 'TEAM', 'SECURITY', 'SYSTEM', 'FINANCE', 'AI')),
    event_type TEXT NOT NULL,
    description TEXT,
    actor_id UUID REFERENCES auth.users(id),
    actor_email TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for timeline performance
CREATE INDEX IF NOT EXISTS idx_unified_events_station_created ON public.unified_events(station_id, created_at DESC);

-- 2. STATELESS SHIFT TRACKER (Global Synchronization)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.current_station_shifts (
    station_id UUID PRIMARY KEY REFERENCES public.fuel_stations(station_id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- 3. GLOBAL CLEANUP: PURGE LEGACY NAMES & FIREBASE REFERENCES
-- ============================================================================
DO $$ 
BEGIN
    -- Drop legacy audit/log tables if they exist
    DROP TABLE IF EXISTS public.admin_logs CASCADE;
    DROP TABLE IF EXISTS public.event_logs CASCADE;
    DROP TABLE IF EXISTS public.usage_logs CASCADE;

    -- Drop legacy columns from profiles
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'firebase_uid') THEN
        ALTER TABLE public.profiles DROP COLUMN firebase_uid;
    END IF;

    -- Drop legacy columns from fuel_stations
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_stations' AND column_name = 'firebase_uid') THEN
        ALTER TABLE public.fuel_stations DROP COLUMN firebase_uid;
    END IF;

    -- Drop legacy columns from tanks
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tanks' AND column_name = 'firebase_uid') THEN
        ALTER TABLE public.tanks DROP COLUMN firebase_uid;
    END IF;
END $$;

-- 4. RLS POLICIES FOR UNIFIED EVENTS
-- ============================================================================
ALTER TABLE public.unified_events ENABLE ROW LEVEL SECURITY;

-- Allow all station members to view their own station's events
DROP POLICY IF EXISTS "Station members can view unified events" ON public.unified_events;
CREATE POLICY "Station members can view unified events"
    ON public.unified_events
    FOR SELECT
    USING (station_id = (SELECT get_station_id_from_auth()));

-- Allow ONLY Station Admins (Auth Level 5) to delete events if needed
DROP POLICY IF EXISTS "Station admins can delete events" ON public.unified_events;
CREATE POLICY "Station admins can delete events"
    ON public.unified_events
    FOR DELETE
    USING (
        station_id = (SELECT get_station_id_from_auth()) 
        AND (SELECT (get_user_bundle_v2()->>'auth_level')::int <= 5)
    );

-- 5. RLS POLICIES FOR SHIFT TRACKER
-- ============================================================================
ALTER TABLE public.current_station_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Station members can view shift status" ON public.current_station_shifts;
CREATE POLICY "Station members can view shift status"
    ON public.current_station_shifts
    FOR SELECT
    USING (station_id = (SELECT get_station_id_from_auth()));

DROP POLICY IF EXISTS "Station members can update shift status" ON public.current_station_shifts;
CREATE POLICY "Station members can update shift status"
    ON public.current_station_shifts
    FOR ALL
    USING (station_id = (SELECT get_station_id_from_auth()));

-- 6. AUTOMATED DATA AUDIT TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.audit_trigger_handler()
RETURNS TRIGGER AS $$
DECLARE
    v_station_id UUID;
BEGIN
    -- Resolve station_id from the record
    IF TG_TABLE_NAME = 'fuel_stations' THEN
        v_station_id := NEW.station_id;
    ELSE
        v_station_id := NEW.station_id;
    END IF;

    INSERT INTO public.unified_events (
        station_id, 
        event_category, 
        event_type, 
        description, 
        actor_id, 
        actor_email, 
        metadata
    )
    VALUES (
        v_station_id,
        'SYSTEM',
        TG_TABLE_NAME || '_' || TG_OP,
        'Forensic audit: ' || TG_OP || ' detected on ' || TG_TABLE_NAME,
        auth.uid(),
        auth.jwt()->>'email',
        jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
    );
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Prevent audit failure from blocking business transactions
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to critical tables
DROP TRIGGER IF EXISTS audit_tanks_change ON public.tanks;
CREATE TRIGGER audit_tanks_change AFTER INSERT OR UPDATE OR DELETE ON public.tanks FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_handler();

DROP TRIGGER IF EXISTS audit_deliveries_change ON public.deliveries;
CREATE TRIGGER audit_deliveries_change AFTER INSERT OR UPDATE OR DELETE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_handler();

-- 7. RETAIN POLICY (1 YEAR)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_events()
RETURNS void AS $$
BEGIN
    DELETE FROM public.unified_events WHERE created_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- 8. Enable Realtime
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'current_station_shifts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.current_station_shifts;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'unified_events'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.unified_events;
    END IF;
END $$;
