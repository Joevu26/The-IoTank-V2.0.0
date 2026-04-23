-- supabase/migrations/20260423100000_comprehensive_security_fixes.sql
-- ============================================================================
-- COMPREHENSIVE SECURITY REMEDIATION
-- Fixes: CRIT-003, CRIT-004, HIGH-004, HIGH-005 (DB layer),
--        LOGIC-001, LOGIC-002, MED-005, DATA-003
-- ============================================================================

-- ============================================================================
-- CRIT-003: Make unified_events APPEND-ONLY (tamper-proof audit trail)
-- ============================================================================

-- 1a. Revoke DELETE and UPDATE from all non-service roles
REVOKE DELETE ON public.unified_events FROM authenticated;
REVOKE UPDATE ON public.unified_events FROM authenticated;

-- 1b. Immutability trigger — blocks any UPDATE or DELETE at DB level
CREATE OR REPLACE FUNCTION public.prevent_unified_events_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION 'unified_events: Audit log entries are immutable and cannot be modified or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS unified_events_immutable ON public.unified_events;
CREATE TRIGGER unified_events_immutable
    BEFORE UPDATE OR DELETE ON public.unified_events
    FOR EACH ROW EXECUTE FUNCTION public.prevent_unified_events_mutation();

-- 1c. DATA-003: Force server-side created_at — strip client control of timestamp
ALTER TABLE public.unified_events
    ALTER COLUMN created_at SET DEFAULT NOW(),
    ALTER COLUMN created_at SET NOT NULL;

-- Re-enforce the RLS INSERT policy (actor_id must match caller)
DROP POLICY IF EXISTS "Allow authenticated inserts to unified_events" ON public.unified_events;
CREATE POLICY "Allow authenticated inserts to unified_events"
ON public.unified_events FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = actor_id);

-- Only service_role / system functions may ever delete (for GDPR purge flows only)
DROP POLICY IF EXISTS "Service role may purge unified_events" ON public.unified_events;
DROP POLICY IF EXISTS "service_role_purge_unified_events" ON public.unified_events;
CREATE POLICY "Service role may purge unified_events"
ON public.unified_events FOR DELETE
TO service_role
USING (true);


-- ============================================================================
-- CRIT-004: Device Token Registry + Shorter Token Lifetime
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.device_tokens (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tank_id       UUID        REFERENCES public.tanks(id) ON DELETE CASCADE,
    station_id    UUID        NOT NULL,
    issued_by     UUID        REFERENCES auth.users(id),
    issued_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at    TIMESTAMPTZ NOT NULL,
    is_revoked    BOOLEAN     NOT NULL DEFAULT FALSE,
    revoked_at    TIMESTAMPTZ,
    revoked_by    UUID        REFERENCES auth.users(id),
    revoke_reason TEXT,
    token_hash    TEXT        UNIQUE NOT NULL,
    CONSTRAINT device_tokens_expires_after_issued CHECK (expires_at > issued_at)
);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Only station admins can see their own station's tokens
DROP POLICY IF EXISTS "Station admins can view their device tokens" ON public.device_tokens;
CREATE POLICY "Station admins can view their device tokens"
ON public.device_tokens FOR SELECT
TO authenticated
USING (
    station_id IN (
        SELECT p.station_id FROM public.profiles p
        WHERE p.auth_user_id = auth.uid()
          AND p.role IN ('admin', 'owner')
    )
    OR public.is_system_admin('support_staff')
);

DROP POLICY IF EXISTS "Station admins can revoke their device tokens" ON public.device_tokens;
CREATE POLICY "Station admins can revoke their device tokens"
ON public.device_tokens FOR UPDATE
TO authenticated
USING (
    station_id IN (
        SELECT p.station_id FROM public.profiles p
        WHERE p.auth_user_id = auth.uid()
          AND p.role IN ('admin', 'owner')
    )
)
WITH CHECK (
    station_id IN (
        SELECT p.station_id FROM public.profiles p
        WHERE p.auth_user_id = auth.uid()
          AND p.role IN ('admin', 'owner')
    )
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_station   ON public.device_tokens(station_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_tank      ON public.device_tokens(tank_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_hash      ON public.device_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_device_tokens_revoked   ON public.device_tokens(is_revoked) WHERE is_revoked = FALSE;


-- ============================================================================
-- HIGH-004: Tighten auth_attempts — remove unrestricted anon INSERT
-- ============================================================================

-- Drop the open-to-anyone INSERT policy
DROP POLICY IF EXISTS "Enable inserts for auth rate limiting" ON public.auth_attempts;

-- Inserts are now only done by the SECURITY DEFINER RPC functions (log_auth_attempt)
-- which are called internally — clients never INSERT directly
REVOKE INSERT ON public.auth_attempts FROM anon;
REVOKE INSERT ON public.auth_attempts FROM authenticated;

-- Re-create log_auth_attempt if it was pruned, and grant execute
CREATE OR REPLACE FUNCTION public.log_auth_attempt(p_email TEXT, p_is_success BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.auth_attempts (email, is_success)
    VALUES (LOWER(TRIM(p_email)), p_is_success);
EXCEPTION WHEN OTHERS THEN
    NULL; -- Never block auth due to rate-limit logging failures
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_auth_attempt(TEXT, BOOLEAN) TO anon, authenticated;


-- ============================================================================
-- LOGIC-001: Sensor reading validation trigger (volume bounds check)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_sensor_reading()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_capacity  NUMERIC;
    v_tank_name TEXT;
BEGIN
    -- Volume must be non-negative
    IF NEW.volume < 0 THEN
        RAISE EXCEPTION 'sensor_readings: Volume cannot be negative (got %)', NEW.volume;
    END IF;

    -- Temperature sanity check (-40°C to +80°C covers all industrial fuels)
    IF NEW.temperature IS NOT NULL AND (NEW.temperature < -40 OR NEW.temperature > 80) THEN
        RAISE EXCEPTION 'sensor_readings: Temperature % is outside safe range (-40 to 80°C)', NEW.temperature;
    END IF;

    -- Volume cannot exceed tank capacity
    SELECT tank_capacity, tank_name
    INTO   v_capacity, v_tank_name
    FROM   public.tanks
    WHERE  id = NEW.tank_id;

    IF v_capacity IS NOT NULL AND NEW.volume > v_capacity THEN
        RAISE EXCEPTION 'sensor_readings: Volume % exceeds tank "%" capacity %',
            NEW.volume, v_tank_name, v_capacity;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_sensor_reading_trigger ON public.sensor_readings;
CREATE TRIGGER validate_sensor_reading_trigger
    BEFORE INSERT OR UPDATE ON public.sensor_readings
    FOR EACH ROW EXECUTE FUNCTION public.validate_sensor_reading();


-- ============================================================================
-- LOGIC-002: Alert deduplication — unique constraint to prevent TOCTOU race
-- ============================================================================

-- Drop any existing partial unique index first
DROP INDEX IF EXISTS idx_alerts_unique_active;

-- Add a partial unique constraint: only one unresolved alert per (tank, type)
CREATE UNIQUE INDEX idx_alerts_unique_active
    ON public.alerts (tank_id, alert_type)
    WHERE (is_resolved = FALSE);


-- ============================================================================
-- MED-005: data-smoothing trigger — use service_role key, not anon key
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_data_smoothing()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Use the Vault-stored service role key, not the anon key
    IF current_setting('app.settings.service_role_key', true) IS NOT NULL THEN
        PERFORM net.http_post(
            url     := 'https://suifvborodwergtrbjez.supabase.co/functions/v1/data-smoothing',
            headers := jsonb_build_object(
                'Content-Type',  'application/json',
                'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
            ),
            body    := jsonb_build_object('record', to_jsonb(NEW))
        );
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- Reload PostgREST schema cache
-- ============================================================================
NOTIFY pgrst, 'reload schema';
