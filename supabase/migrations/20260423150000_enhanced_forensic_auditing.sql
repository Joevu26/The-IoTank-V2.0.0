-- supabase/migrations/20260423150000_enhanced_forensic_auditing.sql
-- ============================================================================
-- AUDIT ENHANCEMENT: Descriptive event logging for high-fidelity forensics
-- ============================================================================

CREATE OR REPLACE FUNCTION public.audit_trigger_handler()
RETURNS TRIGGER AS $$
DECLARE
    v_station_id UUID;
    v_actor_name TEXT;
    v_category TEXT := 'SYSTEM';
    v_should_audit BOOLEAN := TRUE;
    v_description TEXT;
BEGIN
    -- Resolve station_id
    v_station_id := COALESCE(NEW.station_id, OLD.station_id);

    -- ── TELEMETRY FILTERING ─────────────────
    -- Prevent log spam from routine telemetry updates
    IF TG_TABLE_NAME = 'tanks' AND TG_OP = 'UPDATE' THEN
        IF (OLD.* IS NOT DISTINCT FROM NEW.*) THEN 
            v_should_audit := FALSE;
        ELSIF (OLD.current_volume IS DISTINCT FROM NEW.current_volume OR OLD.last_reading_at IS DISTINCT FROM NEW.last_reading_at)
              AND OLD.tank_name = NEW.tank_name AND OLD.tank_capacity = NEW.tank_capacity THEN
            v_should_audit := FALSE; 
        END IF;
    END IF;

    IF NOT v_should_audit THEN RETURN NEW; END IF;

    -- ── CATEGORY ASSIGNMENT ──────────────────
    IF TG_TABLE_NAME IN ('fuel_transactions', 'deliveries') THEN 
        v_category := 'DELIVERY';
    ELSIF TG_TABLE_NAME = 'shift_closures' THEN 
        v_category := 'SHIFT';
    ELSIF TG_TABLE_NAME = 'alerts' THEN 
        v_category := 'SECURITY';
    ELSIF TG_TABLE_NAME = 'billing' THEN 
        v_category := 'FINANCE';
    ELSIF TG_TABLE_NAME IN ('tanks', 'sites') THEN
        v_category := 'INVENTORY';
    END IF;

    -- ── DESCRIPTIVE LOGGING ──────────────────
    IF TG_TABLE_NAME = 'tanks' THEN
        IF TG_OP = 'INSERT' THEN v_description := 'New tank asset initialized: ' || NEW.tank_name;
        ELSIF TG_OP = 'UPDATE' THEN v_description := 'Configuration modified for tank: ' || NEW.tank_name;
        ELSIF TG_OP = 'DELETE' THEN v_description := 'Permanent removal of tank asset: ' || OLD.tank_name;
        END IF;
    ELSIF TG_TABLE_NAME = 'sites' THEN
        IF TG_OP = 'INSERT' THEN v_description := 'New facility registered: ' || NEW.site_name;
        ELSIF TG_OP = 'UPDATE' THEN v_description := 'Site metadata updated: ' || NEW.site_name;
        ELSIF TG_OP = 'DELETE' THEN v_description := 'Facility record purged: ' || OLD.site_name;
        END IF;
    ELSIF TG_TABLE_NAME = 'alerts' THEN
        IF TG_OP = 'INSERT' THEN v_description := 'Security event triggered: ' || NEW.title;
        ELSIF TG_OP = 'UPDATE' AND NEW.is_resolved THEN v_description := 'Alert resolution finalized: ' || NEW.title;
        ELSE v_description := 'Alert update: ' || NEW.title;
        END IF;
    ELSIF TG_TABLE_NAME = 'shift_closures' THEN
        v_description := 'Shift operation ' || TG_OP || 'ed by user.';
    ELSE
        v_description := 'Forensic audit: ' || TG_OP || ' on ' || TG_TABLE_NAME;
    END IF;

    -- Attempt to get actor name
    SELECT display_name INTO v_actor_name FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1;

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
        v_category, 
        TG_TABLE_NAME || '_' || TG_OP,
        v_description,
        auth.uid(), 
        auth.jwt()->>'email', 
        COALESCE(v_actor_name, auth.jwt()->>'email', 'SYSTEM'),
        jsonb_build_object(
            'old', to_jsonb(OLD), 
            'new', to_jsonb(NEW),
            'table', TG_TABLE_NAME,
            'operation', TG_OP,
            'timestamp', now()
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
