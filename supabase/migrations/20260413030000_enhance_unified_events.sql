-- supabase/migrations/20260413030000_enhance_unified_events.sql
-- ============================================================================
-- ENHANCE UNIFIED EVENTS: Add resolved state and human-readable actor name
-- ============================================================================

-- 1. Add new columns to unified_events
ALTER TABLE public.unified_events 
    ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS actor_name TEXT;

-- 2. Update the audit_trigger_handler to grab the actor_name from profiles
CREATE OR REPLACE FUNCTION public.audit_trigger_handler()
RETURNS TRIGGER AS $$
DECLARE
    v_station_id UUID;
    v_actor_name TEXT;
BEGIN
    -- Resolve station_id
    IF TG_TABLE_NAME = 'fuel_stations' THEN
        v_station_id := NEW.station_id;
    ELSE
        v_station_id := NEW.station_id;
    END IF;

    -- Attempt to get actor name from profiles
    BEGIN
        SELECT display_name INTO v_actor_name
        FROM public.profiles
        WHERE id = auth.uid() OR firebase_uid = auth.uid()::text
        LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        v_actor_name := NULL;
    END;

    INSERT INTO public.unified_events (
        station_id, 
        event_category, 
        event_type, 
        description, 
        actor_id, 
        actor_email, 
        actor_name,
        metadata
    )
    VALUES (
        v_station_id,
        'SYSTEM',
        TG_TABLE_NAME || '_' || TG_OP,
        'Forensic audit: ' || TG_OP || ' detected on ' || TG_TABLE_NAME,
        auth.uid(),
        auth.jwt()->>'email',
        v_actor_name,
        jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
    );
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Add UPDATE policy for unified_events so users can mark alerts as read/resolved
ALTER TABLE public.unified_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Station members can update unified events" ON public.unified_events;
CREATE POLICY "Station members can update unified events"
    ON public.unified_events
    FOR UPDATE
    USING (station_id = (SELECT get_station_id_from_auth()));
