-- supabase/migrations/20260321000000_fix_provisioning_rls.sql
-- ============================================================================
-- FIX: Allow system admins (support_staff and above) to provision new accounts.
-- The previous policies either used the hardcoded is_admin() function or 
-- only allowed users to insert their own records, blocking the Super Admin portal.
-- ============================================================================

-- 1. client_billing
DROP POLICY IF EXISTS "Admins can create billing records" ON public.client_billing;
CREATE POLICY "Admins can create billing records"
ON public.client_billing FOR INSERT
TO authenticated
WITH CHECK (public.is_system_admin(3));

-- 2. sites
DROP POLICY IF EXISTS "System admins can create sites" ON public.sites;
CREATE POLICY "System admins can create sites"
ON public.sites FOR INSERT
TO authenticated
WITH CHECK (public.is_system_admin(3));

-- 3. tanks
DROP POLICY IF EXISTS "System admins can create tanks" ON public.tanks;
CREATE POLICY "System admins can create tanks"
ON public.tanks FOR INSERT
TO authenticated
WITH CHECK (public.is_system_admin(3));

-- 4. profiles
DROP POLICY IF EXISTS "System admins can insert profiles" ON public.profiles;
CREATE POLICY "System admins can insert profiles"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (public.is_system_admin(3));
