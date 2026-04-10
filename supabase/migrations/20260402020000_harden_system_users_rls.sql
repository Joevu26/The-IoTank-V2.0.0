-- supabase/migrations/20260402020000_harden_system_users_rls.sql
-- ============================================================================
-- FIX: Allow system users to read their own profile by email if UID is unlinked
-- This ensures that initial logins from the client or admin portal don't fail
-- even if the supabase_uid hasn't been synchronized yet.
-- ============================================================================

-- 1. Drop the old UID-only policy
DROP POLICY IF EXISTS "System users can read their own profile" ON public.system_users;

-- 2. Create a more robust version that checks both UID and the JWT email
CREATE POLICY "System users can read their own profile"
  ON public.system_users FOR SELECT TO authenticated
  USING (
    supabase_uid::uuid = auth.uid()::uuid
    OR LOWER(email) = LOWER(auth.jwt()->>'email')
  );

-- 3. Ensure RLS is active
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;

-- 4. Audit Log Entry (System Internal)
-- If we had a mechanism for this, we'd log it here.
