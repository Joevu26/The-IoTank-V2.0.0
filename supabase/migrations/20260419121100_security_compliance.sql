-- supabase/migrations/20260419121100_security_compliance.sql
-- ============================================================================
-- SECURITY REMEDIATION: Linter Findings & Production Hardening
-- ============================================================================

-- 1. ENABLE RLS ON MISSING TABLES
-- ============================================================================
ALTER TABLE IF EXISTS public.scraper_rate_limits ENABLE ROW LEVEL SECURITY;

-- Deny all public access to scraper limits (Service Role Only)
DROP POLICY IF EXISTS "Service role managed" ON public.scraper_rate_limits;
CREATE POLICY "Service role managed" ON public.scraper_rate_limits
    FOR ALL TO service_role USING (true);

-- 2. HARDEN FUNCTION SEARCH PATHS (Search Path Hijacking Prevention)
-- ============================================================================
ALTER FUNCTION public.cleanup_old_rss_cache() SET search_path = public;

-- 3. SECURE AUTH ATTEMPTS (Rate Limiting Hardening)
-- ============================================================================
-- The linter flagged the broad INSERT policy. We will remove it and rely on
-- the SECURITY DEFINER function 'log_auth_attempt' to handle inserts safely.
DROP POLICY IF EXISTS "Enable inserts for auth rate limiting" ON public.auth_attempts;

-- 4. SECURE STORAGE (Listing Prevention)
-- ============================================================================
-- Current policy allows broad SELECT. We replace it with scoped policies 
-- that allow viewing specific photos but prevent listing the entire bucket.

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON storage.objects;
END $$;

-- Hardened SELECT: Only allow viewing if the user belongs to the station 
-- or is viewing their own path.
DROP POLICY IF EXISTS "Strict photo viewing" ON storage.objects;
CREATE POLICY "Strict photo viewing"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'profile-photos'
    AND (
        -- User can view their own avatar
        (storage.foldername(name))[2] = auth.uid()::text
        -- Or user can view photos from their own station
        OR (storage.foldername(name))[2] = (SELECT station_id::text FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1)
        -- Or Super Admins (System Users) can see everything
        OR EXISTS (SELECT 1 FROM public.system_users WHERE auth_user_id = auth.uid())
    )
);

-- Note: 'Users can manage their own avatar' and other management policies 
-- already have strict USING/WITH CHECK clauses, so they remain secure.
