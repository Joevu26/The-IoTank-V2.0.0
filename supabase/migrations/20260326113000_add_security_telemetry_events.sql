-- Security telemetry event stream for proxy abuse, denials, and provisioning anomalies.

CREATE TABLE IF NOT EXISTS public.security_telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  source TEXT NOT NULL,
  endpoint TEXT,
  actor_uid UUID,
  actor_email TEXT,
  actor_role TEXT,
  actor_auth_level INTEGER,
  client_id UUID,
  scope_key TEXT,
  status_code INTEGER,
  reason TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT security_telemetry_events_severity_chk
    CHECK (severity IN ('info', 'warning', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_security_telemetry_events_created_at
  ON public.security_telemetry_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_telemetry_events_type
  ON public.security_telemetry_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_telemetry_events_client
  ON public.security_telemetry_events (client_id, created_at DESC);

ALTER TABLE public.security_telemetry_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System admins can read security telemetry events" ON public.security_telemetry_events;
CREATE POLICY "System admins can read security telemetry events"
ON public.security_telemetry_events
FOR SELECT
TO authenticated
USING (public.is_system_admin(3));

CREATE OR REPLACE FUNCTION public.log_security_telemetry_event(
  p_event_type TEXT,
  p_severity TEXT DEFAULT 'info',
  p_source TEXT DEFAULT 'edge_function',
  p_endpoint TEXT DEFAULT NULL,
  p_actor_uid UUID DEFAULT NULL,
  p_actor_email TEXT DEFAULT NULL,
  p_actor_role TEXT DEFAULT NULL,
  p_actor_auth_level INTEGER DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
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
    client_id,
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
    p_client_id,
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
