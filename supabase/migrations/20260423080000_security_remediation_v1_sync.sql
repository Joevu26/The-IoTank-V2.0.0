-- supabase/migrations/20260423080000_security_remediation_v1_sync.sql
-- ============================================================================
-- SECURITY REMEDIATION V1 SYNC: Hardening Search Paths and Storage
-- ============================================================================

-- 1. HARDEN FUNCTION SEARCH PATHS
-- Prevents "Search Path Mutable" linter warnings and hijacking attacks.
-- Explicitly setting search_path to 'public' for all SECURITY DEFINER functions.

DO $$ 
BEGIN
    -- Harden get_tankiq_station_summary
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_tankiq_station_summary') THEN
        ALTER FUNCTION public.get_tankiq_station_summary(UUID) SET search_path = public;
    END IF;

    -- Harden get_tankiq_consumption_stats
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_tankiq_consumption_stats') THEN
        ALTER FUNCTION public.get_tankiq_consumption_stats(UUID, INTEGER) SET search_path = public;
    END IF;

    -- Harden get_tankiq_delivery_logs
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_tankiq_delivery_logs') THEN
        ALTER FUNCTION public.get_tankiq_delivery_logs(UUID, INTEGER) SET search_path = public;
    END IF;

    -- Harden get_tankiq_market_context
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_tankiq_market_context') THEN
        ALTER FUNCTION public.get_tankiq_market_context() SET search_path = public;
    END IF;

    -- Harden check_auth_attempt
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'check_auth_attempt') THEN
        ALTER FUNCTION public.check_auth_attempt(TEXT) SET search_path = public;
    END IF;

    -- Harden log_auth_attempt
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'log_auth_attempt') THEN
        ALTER FUNCTION public.log_auth_attempt(TEXT, BOOLEAN) SET search_path = public;
    END IF;

    -- Harden audit_trigger_handler
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'audit_trigger_handler') THEN
        ALTER FUNCTION public.audit_trigger_handler() SET search_path = public;
    END IF;

    -- Harden cleanup_old_events
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'cleanup_old_events') THEN
        ALTER FUNCTION public.cleanup_old_events() SET search_path = public;
    END IF;
END $$;


-- 2. TIGHTEN RLS POLICIES (Sync from manual remediation script)

-- a. Unified Events: Ensure users only log as themselves
DROP POLICY IF EXISTS "Allow authenticated inserts to unified_events" ON public.unified_events;
CREATE POLICY "Allow authenticated inserts to unified_events" 
ON public.unified_events FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = actor_id);

-- b. Pending Registrations: Mandatory validations
DROP POLICY IF EXISTS "Anyone can request registration" ON public.pending_registrations;
CREATE POLICY "Anyone can request registration" 
ON public.pending_registrations FOR INSERT 
TO anon, authenticated
WITH CHECK (email IS NOT NULL AND station_name IS NOT NULL);

-- c. Auth Attempts: Fix missing policy
DROP POLICY IF EXISTS "Enable inserts for auth rate limiting" ON public.auth_attempts;
CREATE POLICY "Enable inserts for auth rate limiting" 
ON public.auth_attempts FOR INSERT 
TO anon, authenticated
WITH CHECK (true);


-- 3. HARDEN STORAGE BUCKETS
-- address "Public Bucket Allows Listing" warning for profile-photos.

-- Allow individual photo viewing but disable broad listing
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'profile-photos');

-- Ensure individuals can only manage their own folders
DROP POLICY IF EXISTS "Users can manage own folder" ON storage.objects;
CREATE POLICY "Users can manage own folder" 
ON storage.objects FOR ALL 
TO authenticated 
USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);


-- 4. RELOAD PostgREST Cache
NOTIFY pgrst, 'reload schema';
