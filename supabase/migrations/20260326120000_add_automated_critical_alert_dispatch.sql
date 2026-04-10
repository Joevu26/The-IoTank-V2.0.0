-- Automated dispatch queue for critical security telemetry alerts.

ALTER TABLE public.security_telemetry_events
  ADD COLUMN IF NOT EXISTS alert_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS alert_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_alert_error TEXT,
  ADD COLUMN IF NOT EXISTS alerted_at TIMESTAMPTZ;

ALTER TABLE public.security_telemetry_events
  DROP CONSTRAINT IF EXISTS security_telemetry_events_alert_status_chk;

ALTER TABLE public.security_telemetry_events
  ADD CONSTRAINT security_telemetry_events_alert_status_chk
  CHECK (alert_status IN ('pending', 'processing', 'sent', 'failed', 'not_applicable'));

UPDATE public.security_telemetry_events
SET alert_status = 'not_applicable'
WHERE severity <> 'critical';

CREATE INDEX IF NOT EXISTS idx_security_telemetry_events_alert_queue
  ON public.security_telemetry_events (created_at ASC)
  WHERE severity = 'critical' AND alert_status IN ('pending', 'failed');

CREATE OR REPLACE FUNCTION public.claim_pending_critical_alert_events(
  p_limit INTEGER DEFAULT 20
)
RETURNS SETOF public.security_telemetry_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_limit < 1 OR p_limit > 200 THEN
    RAISE EXCEPTION 'p_limit must be between 1 and 200';
  END IF;

  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.security_telemetry_events
    WHERE severity = 'critical'
      AND alert_status IN ('pending', 'failed')
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.security_telemetry_events ste
    SET
      alert_status = 'processing',
      alert_attempts = ste.alert_attempts + 1
    FROM picked
    WHERE ste.id = picked.id
    RETURNING ste.*
  )
  SELECT * FROM updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_critical_alert_event(
  p_event_id UUID,
  p_sent BOOLEAN,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.security_telemetry_events
  SET
    alert_status = CASE WHEN p_sent THEN 'sent' ELSE 'failed' END,
    alerted_at = CASE WHEN p_sent THEN NOW() ELSE alerted_at END,
    last_alert_error = CASE WHEN p_sent THEN NULL ELSE LEFT(COALESCE(p_error, 'unknown error'), 1000) END
  WHERE id = p_event_id
    AND severity = 'critical';
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_pending_critical_alert_events(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_critical_alert_event(UUID, BOOLEAN, TEXT) TO service_role;
