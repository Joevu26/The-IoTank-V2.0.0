-- supabase/migrations/20260411000005_remediation_phase_1.sql
-- ============================================================================
-- REMEDIATION PHASE 1: Security Hardening & Isolation Repairs
-- ============================================================================

-- 1. HARDEN RATE LIMITER (Fix IDOR vulnerability)
-- Ensure authenticated users can only consume for their own session/station
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
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_window_start TIMESTAMPTZ;
  v_request_count INTEGER;
  v_is_admin BOOLEAN;
BEGIN
  -- Validate inputs
  IF p_scope_key IS NULL OR btrim(p_scope_key) = '' THEN
    RAISE EXCEPTION 'consume_edge_rate_limit: scope_key is required';
  END IF;

  -- BREAD-CRUMB: Security Check
  -- If not service_role (null v_uid during certain internal flows) and not system admin, 
  -- enforce that the scope_key MUST contain the user's ID or station_id.
  IF v_uid IS NOT NULL THEN
    -- Check if user is system admin
    SELECT EXISTS (
      SELECT 1 FROM public.system_users 
      WHERE auth_user_id = v_uid AND is_active = TRUE
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
      -- Basic check: The scope key must contain the user's UID to prevent cross-user exhaustion
      IF p_scope_key NOT LIKE '%' || v_uid::TEXT || '%' THEN
        RAISE EXCEPTION 'Unauthorized: cannot consume rate limits for another entity.';
      END IF;
    END IF;
  END IF;

  IF p_window_seconds < 1 OR p_window_seconds > 3600 THEN
    RAISE EXCEPTION 'consume_edge_rate_limit: window_seconds must be between 1 and 3600';
  END IF;

  v_window_start := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);

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

  RETURN QUERY
  SELECT
    FALSE AS allowed,
    0 AS remaining,
    v_window_start + make_interval(secs => p_window_seconds) AS reset_at;
END;
$$;


-- 2. REPAIR PENDING_REGISTRATIONS PERMISSIONS
-- Revoke over-privileged 'GRANT ALL'
REVOKE ALL ON public.pending_registrations FROM authenticated;
REVOKE ALL ON public.pending_registrations FROM anon;

-- GRANT restrictive access
GRANT INSERT ON public.pending_registrations TO anon;
GRANT INSERT ON public.pending_registrations TO authenticated;
GRANT SELECT ON public.pending_registrations TO authenticated;

-- Ensure RLS is enabled and strictly enforced
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System admins can view all pending registrations" ON public.pending_registrations;
CREATE POLICY "System admins can view all pending registrations"
ON public.pending_registrations FOR SELECT
TO authenticated
USING (public.is_system_admin('support_staff'::text));

DROP POLICY IF EXISTS "System admins can update pending registrations" ON public.pending_registrations;
CREATE POLICY "System admins can update pending registrations"
ON public.pending_registrations FOR UPDATE
TO authenticated
USING (public.is_system_admin('support_staff'::text))
WITH CHECK (public.is_system_admin('support_staff'::text));

DROP POLICY IF EXISTS "System admins can delete pending registrations" ON public.pending_registrations;
CREATE POLICY "System admins can delete pending registrations"
ON public.pending_registrations FOR DELETE
TO authenticated
USING (public.is_system_admin('support_staff'::text));

-- Allow public insertion (for landing page) without reading
DROP POLICY IF EXISTS "Anyone can request registration" ON public.pending_registrations;
CREATE POLICY "Anyone can request registration"
ON public.pending_registrations FOR INSERT
TO anon, authenticated
WITH CHECK (TRUE);


-- 3. IDENTITY HANDSHAKE SECURITY (Hardening Profiles RLS)
-- Ensure profiles can only be read by the owner or system admin
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (auth_user_id = auth.uid() OR public.is_system_admin('support_staff'::text));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (auth_user_id = auth.uid() OR public.is_system_admin('support_staff'::text))
WITH CHECK (auth_user_id = auth.uid() OR public.is_system_admin('support_staff'::text));

NOTIFY pgrst, 'reload schema';
