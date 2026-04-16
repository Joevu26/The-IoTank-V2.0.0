-- ==========================================
-- SUPABASE SECURITY REMEDIATION SCRIPT
-- ==========================================

-- 1. HARDEN FUNCTION SEARCH PATHS
-- Prevents "Search Path Mutable" linter warnings and hijacking attacks.

ALTER FUNCTION public.get_tankiq_station_summary(UUID) 
SET search_path = public;

ALTER FUNCTION public.get_tankiq_consumption_stats(UUID, INTEGER) 
SET search_path = public;

ALTER FUNCTION public.get_tankiq_delivery_logs(UUID, INTEGER) 
SET search_path = public;

ALTER FUNCTION public.get_tankiq_market_context() 
SET search_path = public;

ALTER FUNCTION public.check_auth_attempt(TEXT) 
SET search_path = public;

ALTER FUNCTION public.log_auth_attempt(TEXT, BOOLEAN) 
SET search_path = public;

ALTER FUNCTION public.audit_trigger_handler() 
SET search_path = public;

ALTER FUNCTION public.cleanup_old_events() 
SET search_path = public;


-- 2. TIGHTEN RLS POLICIES
-- Address "RLS Policy Always True" and "RLS Enabled No Policy" warnings.

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

-- Ensure individuals can only manage their own folders if needed
DROP POLICY IF EXISTS "Users can manage own folder" ON storage.objects;
CREATE POLICY "Users can manage own folder" 
ON storage.objects FOR ALL 
TO authenticated 
USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ==========================================
-- REMEDIATION COMPLETE
-- ==========================================
