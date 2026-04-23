-- supabase/migrations/20260423110000_db_linter_fixes.sql
-- ============================================================================
-- FIX DB LINTER WARNINGS
-- ============================================================================

-- 1. function_search_path_mutable: Function `public.firebase_uid` has a role mutable search_path
-- We added this shim in 20260423020000_definitive_identity_unification.sql
-- Setting explicit search_path prevents search_path injection attacks
ALTER FUNCTION public.firebase_uid() SET search_path = public;


-- 2. rls_policy_always_true: Table `public.alerts` has an RLS policy `System can insert alerts` for `INSERT` that allows unrestricted access
-- The policy "System can insert alerts" was overly broad (`WITH CHECK (true)`).
-- We now restrict it so users can only insert alerts for their own station,
-- or if they are support staff. (The alert-engine uses service_role so it bypasses RLS).
DROP POLICY IF EXISTS "System can insert alerts" ON public.alerts;
CREATE POLICY "System can insert alerts" ON public.alerts
    FOR INSERT TO authenticated
    WITH CHECK (
        station_id IN (
            SELECT p.station_id FROM public.profiles p WHERE p.auth_user_id = auth.uid()
        )
        OR public.is_system_admin('support_staff')
    );


-- 3. public_bucket_allows_listing: Public bucket `profile-photos` has 1 broad SELECT policy on `storage.objects`
-- We drop the overly broad policy and restrict SELECT to only specific files
-- Wait, public buckets don't need a SELECT policy at all for public access via URL.
-- A SELECT policy allows listing the bucket contents via API. We only want users to see their own files in API listings.
DO $$
BEGIN
    -- We assume the old policy was named 'Public Access' based on the linter report
    DROP POLICY IF EXISTS "Public Access" ON storage.objects;
    
    -- Create a restrictive policy so users can only list/read their own files via the API.
    -- (The public URL access is not affected by this, it is controlled by the bucket's public flag)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can list their own profile photos'
    ) THEN
        CREATE POLICY "Users can list their own profile photos" ON storage.objects
        FOR SELECT TO authenticated
        USING (
            bucket_id = 'profile-photos' AND 
            auth.uid()::text = (storage.foldername(name))[1]
        );
    END IF;
END $$;
