-- supabase/migrations/20260411000011_db_rate_limiting.sql
-- ============================================================================
-- SECURITY REMEDIATION: Server-Side Rate Limiting
-- ============================================================================

-- 1. AUTH ATTEMPTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.auth_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    ip_address INET,
    attempted_at TIMESTAMPTZ DEFAULT NOW(),
    is_success BOOLEAN DEFAULT FALSE
);

-- Index for fast lookup by email and time
CREATE INDEX IF NOT EXISTS idx_auth_attempts_email_time ON public.auth_attempts(email, attempted_at DESC);

-- 2. RATE LIMIT CHECK FUNCTION (RPC)
-- Threshold: 5 attempts per 15 minutes.
-- Block duration: Until 15 minutes passes since the first failed attempt in the window.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_auth_attempt(p_email TEXT)
RETURNS TABLE (
    allowed BOOLEAN,
    remaining_attempts INTEGER,
    reset_time TIMESTAMPTZ
) AS $$
DECLARE
    v_window_start TIMESTAMPTZ := NOW() - INTERVAL '15 minutes';
    v_failed_count INTEGER;
    v_first_failed TIMESTAMPTZ;
BEGIN
    p_email := LOWER(TRIM(p_email));

    -- Count failed attempts in the last 15 minutes
    SELECT COUNT(*), MIN(attempted_at)
    INTO v_failed_count, v_first_failed
    FROM public.auth_attempts
    WHERE email = p_email
      AND attempted_at > v_window_start
      AND is_success = FALSE;

    IF v_failed_count >= 5 THEN
        RETURN QUERY SELECT FALSE, 0, v_first_failed + INTERVAL '15 minutes';
    ELSE
        RETURN QUERY SELECT TRUE, 5 - v_failed_count, (v_first_failed + INTERVAL '15 minutes');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. LOG AUTH ATTEMPT FUNCTION (RPC)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_auth_attempt(p_email TEXT, p_is_success BOOLEAN)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.auth_attempts (email, is_success, ip_address)
    VALUES (LOWER(TRIM(p_email)), p_is_success, net.ip_address_to_inet(current_setting('request.headers')::json->>'x-real-ip'));
EXCEPTION WHEN OTHERS THEN
    -- Fallback if ip resolution fails
    INSERT INTO public.auth_attempts (email, is_success)
    VALUES (LOWER(TRIM(p_email)), p_is_success);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RLS (Deny all broad access, only allow RPC execution)
-- ============================================================================
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;
GRANT EXECUTE ON FUNCTION public.check_auth_attempt(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_auth_attempt(TEXT, BOOLEAN) TO anon, authenticated;
