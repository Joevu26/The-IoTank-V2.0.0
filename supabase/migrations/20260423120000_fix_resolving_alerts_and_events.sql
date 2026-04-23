-- supabase/migrations/20260423120000_fix_resolving_alerts_and_events.sql
-- ============================================================================
-- FIX: RESOLVING ALERTS & UNIFIED EVENTS
-- Ensures UI notification dismissals work without breaking immutability
-- ============================================================================

-- 1. Add missing resolved_by to alerts table (PGRST204 fix)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alerts' AND column_name = 'resolved_by') THEN
        ALTER TABLE public.alerts ADD COLUMN resolved_by TEXT;
    END IF;
END $$;

-- 2. Add missing is_resolved to unified_events table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unified_events' AND column_name = 'is_resolved') THEN
        ALTER TABLE public.unified_events ADD COLUMN is_resolved BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 3. Modify immutability trigger to allow is_resolved updates ONLY
CREATE OR REPLACE FUNCTION public.prevent_unified_events_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Only allow updating is_resolved flag. Everything else must exactly match.
        IF NEW.id = OLD.id 
           AND NEW.station_id = OLD.station_id
           AND NEW.event_category = OLD.event_category
           AND NEW.event_type = OLD.event_type
           AND NEW.description = OLD.description
           AND NEW.actor_id = OLD.actor_id
           AND NEW.metadata = OLD.metadata
           AND NEW.created_at = OLD.created_at THEN
            RETURN NEW;
        END IF;
    END IF;
    RAISE EXCEPTION 'unified_events: Audit log entries are immutable and cannot be modified or deleted.';
END;
$$;

-- 4. Create RPCs to safely resolve events without granting UPDATE to authenticated users
CREATE OR REPLACE FUNCTION public.resolve_unified_event(p_event_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.unified_events SET is_resolved = true WHERE id = p_event_id;
$$;

CREATE OR REPLACE FUNCTION public.resolve_all_station_events(p_station_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.unified_events SET is_resolved = true WHERE station_id = p_station_id AND is_resolved = false;
$$;
