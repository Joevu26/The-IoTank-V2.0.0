-- Retention housekeeping helpers for security telemetry and edge rate-limiter tables.

CREATE OR REPLACE FUNCTION public.purge_security_telemetry_events(
  p_older_than_days INTEGER DEFAULT 90
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  IF p_older_than_days < 7 OR p_older_than_days > 3650 THEN
    RAISE EXCEPTION 'p_older_than_days must be between 7 and 3650';
  END IF;

  DELETE FROM public.security_telemetry_events
  WHERE created_at < NOW() - make_interval(days => p_older_than_days);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_edge_rate_limits(
  p_older_than_hours INTEGER DEFAULT 72
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  IF p_older_than_hours < 1 OR p_older_than_hours > 8760 THEN
    RAISE EXCEPTION 'p_older_than_hours must be between 1 and 8760';
  END IF;

  DELETE FROM public.edge_rate_limits
  WHERE updated_at < NOW() - make_interval(hours => p_older_than_hours);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_security_telemetry_events(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_edge_rate_limits(INTEGER) TO service_role;
