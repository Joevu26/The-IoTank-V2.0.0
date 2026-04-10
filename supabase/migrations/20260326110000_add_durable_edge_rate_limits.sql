-- Durable, tenant-aware edge function rate limiting.

CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  window_starts_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_rate_limits_unique_window UNIQUE (scope_key, endpoint, window_starts_at)
);

CREATE INDEX IF NOT EXISTS idx_edge_rate_limits_lookup
  ON public.edge_rate_limits (scope_key, endpoint, window_starts_at DESC);

CREATE INDEX IF NOT EXISTS idx_edge_rate_limits_updated_at
  ON public.edge_rate_limits (updated_at);

CREATE OR REPLACE FUNCTION public.consume_edge_rate_limit(
  p_scope_key TEXT,
  p_endpoint TEXT,
  p_window_seconds INTEGER DEFAULT 60,
  p_max_requests INTEGER DEFAULT 20
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_request_count INTEGER;
BEGIN
  IF p_scope_key IS NULL OR btrim(p_scope_key) = '' THEN
    RAISE EXCEPTION 'consume_edge_rate_limit: scope_key is required';
  END IF;

  IF p_endpoint IS NULL OR btrim(p_endpoint) = '' THEN
    RAISE EXCEPTION 'consume_edge_rate_limit: endpoint is required';
  END IF;

  IF p_window_seconds < 1 OR p_window_seconds > 3600 THEN
    RAISE EXCEPTION 'consume_edge_rate_limit: window_seconds must be between 1 and 3600';
  END IF;

  IF p_max_requests < 1 OR p_max_requests > 10000 THEN
    RAISE EXCEPTION 'consume_edge_rate_limit: max_requests must be between 1 and 10000';
  END IF;

  v_window_start :=
    to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);

  WITH consumed AS (
    INSERT INTO public.edge_rate_limits (
      scope_key,
      endpoint,
      window_starts_at,
      request_count
    )
    VALUES (
      p_scope_key,
      p_endpoint,
      v_window_start,
      1
    )
    ON CONFLICT (scope_key, endpoint, window_starts_at)
    DO UPDATE SET
      request_count = public.edge_rate_limits.request_count + 1,
      updated_at = NOW()
    WHERE public.edge_rate_limits.request_count < p_max_requests
    RETURNING request_count
  )
  SELECT request_count INTO v_request_count FROM consumed;

  IF v_request_count IS NOT NULL THEN
    RETURN QUERY
    SELECT
      TRUE AS allowed,
      GREATEST(p_max_requests - v_request_count, 0) AS remaining,
      v_window_start + make_interval(secs => p_window_seconds) AS reset_at;
    RETURN;
  END IF;

  SELECT erl.request_count
  INTO v_request_count
  FROM public.edge_rate_limits erl
  WHERE erl.scope_key = p_scope_key
    AND erl.endpoint = p_endpoint
    AND erl.window_starts_at = v_window_start
  LIMIT 1;

  RETURN QUERY
  SELECT
    FALSE AS allowed,
    0 AS remaining,
    v_window_start + make_interval(secs => p_window_seconds) AS reset_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_edge_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO authenticated, service_role;
