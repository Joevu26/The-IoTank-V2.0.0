-- supabase/migrations/20260321000006_fix_system_users_visibility.sql

-- Ensure system users can at least see their own profile record
-- This was likely dropped by a previous CASCADE operation
DROP POLICY IF EXISTS "System users can read their own profile" ON public.system_users;
CREATE POLICY "System users can read their own profile"
ON public.system_users FOR SELECT
TO authenticated, anon
USING (firebase_uid = public.firebase_uid());

-- Broaden the super admin policy to ensure they can see everyone
-- NOTE: is_system_admin now takes an INTEGER level (4 = super_admin)
DROP POLICY IF EXISTS "Super Admins can manage all users" ON public.system_users;
CREATE POLICY "Super Admins can manage all users"
ON public.system_users FOR ALL
TO authenticated
USING (public.is_system_admin(4))
WITH CHECK (public.is_system_admin(4));

-- Ensure service role has full access
DROP POLICY IF EXISTS "Service role can manage system users" ON public.system_users;
CREATE POLICY "Service role can manage system users"
ON public.system_users FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
