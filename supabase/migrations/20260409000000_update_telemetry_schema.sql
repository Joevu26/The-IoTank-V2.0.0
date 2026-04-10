-- supabase/migrations/20260409000000_update_telemetry_schema.sql
-- ============================================================================
-- TELEMETRY SCHEMA UPDATE: Rename 'client_id' to 'station_id'
-- ============================================================================

DO $$ 
BEGIN
    -- 1. Rename column in security_telemetry_events table
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_telemetry_events' AND column_name = 'client_id') THEN
        ALTER TABLE public.security_telemetry_events RENAME COLUMN client_id TO station_id;
    END IF;

    -- 2. Rename index if it exists
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_security_telemetry_events_client') THEN
        ALTER INDEX public.idx_security_telemetry_events_client RENAME TO idx_security_telemetry_events_station;
    END IF;
END $$;

-- 3. Update the logging function
-- Drop old function with old parameter names first
DROP FUNCTION IF EXISTS public.log_security_telemetry_event(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, INTEGER, UUID, TEXT, INTEGER, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.log_security_telemetry_event(
  p_event_type TEXT,
  p_severity TEXT DEFAULT 'info',
  p_source TEXT DEFAULT 'edge_function',
  p_endpoint TEXT DEFAULT NULL,
  p_actor_uid UUID DEFAULT NULL,
  p_actor_email TEXT DEFAULT NULL,
  p_actor_role TEXT DEFAULT NULL,
  p_actor_auth_level INTEGER DEFAULT NULL,
  p_station_id UUID DEFAULT NULL, -- Renamed from p_client_id
  p_scope_key TEXT DEFAULT NULL,
  p_status_code INTEGER DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.security_telemetry_events (
    event_type,
    severity,
    source,
    endpoint,
    actor_uid,
    actor_email,
    actor_role,
    actor_auth_level,
    station_id, -- Updated
    scope_key,
    status_code,
    reason,
    details
  )
  VALUES (
    p_event_type,
    COALESCE(p_severity, 'info'),
    COALESCE(p_source, 'edge_function'),
    p_endpoint,
    p_actor_uid,
    p_actor_email,
    p_actor_role,
    p_actor_auth_level,
    p_station_id, -- Updated
    p_scope_key,
    p_status_code,
    p_reason,
    COALESCE(p_details, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_security_telemetry_event(
  TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, INTEGER, UUID, TEXT, INTEGER, TEXT, JSONB
) TO authenticated, service_role;
