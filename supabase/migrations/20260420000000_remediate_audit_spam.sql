-- supabase/migrations/20260420000000_remediate_audit_spam.sql
-- ============================================================================
-- AUDIT REMEDIATION: Filter out routine telemetry noise from unified_events
-- ============================================================================

CREATE OR REPLACE FUNCTION public.audit_trigger_handler()
RETURNS TRIGGER AS $$
DECLARE
    v_station_id UUID;
    v_should_audit BOOLEAN := TRUE;
BEGIN
    -- Resolve station_id from the record
    v_station_id := COALESCE(NEW.station_id, OLD.station_id);

    -- ── TELEMETRY FILTERING LOGIC ───────────────────────────────────────────
    -- If the update is on 'tanks', we only audit if configuration changed.
    -- Routine volume pings (current_volume/last_reading) are ignored to prevent UI spam.
    IF TG_TABLE_NAME = 'tanks' AND TG_OP = 'UPDATE' THEN
        -- Check if critical config columns changed
        IF (OLD.* IS DISTINCT FROM NEW.*) THEN
            -- If ONLY telemetry columns changed, set should_audit to false
            -- We check if OLD matches NEW when we ignore volume/reading/timestamp
            IF (OLD.current_volume IS DISTINCT FROM NEW.current_volume OR 
                OLD.last_reading IS DISTINCT FROM NEW.last_reading OR
                OLD.updated_at IS DISTINCT FROM NEW.updated_at)
               AND 
               (OLD.name = NEW.name AND 
                OLD.capacity = NEW.capacity AND 
                OLD.fuel_type = NEW.fuel_type AND
                OLD.low_level_threshold = NEW.low_level_threshold AND
                OLD.high_level_threshold = NEW.high_level_threshold)
            THEN
                v_should_audit := FALSE;
            END IF;
        ELSE
            v_should_audit := FALSE;
        END IF;
    END IF;

    IF v_should_audit THEN
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
            CASE 
                WHEN TG_TABLE_NAME = 'tanks' AND TG_OP = 'UPDATE' THEN 'Forensic audit: Configuration Change on ' || TG_TABLE_NAME
                ELSE 'Forensic audit: ' || TG_OP || ' detected on ' || TG_TABLE_NAME
            END,
            auth.uid(),
            auth.jwt()->>'email',
            jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
        );
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Prevent audit failure from blocking business transactions
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
