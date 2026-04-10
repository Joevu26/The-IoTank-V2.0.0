-- supabase/migrations/20260319000006_fix_billing_rls.sql
-- ============================================================================
-- FIX: Add INSERT / UPDATE / DELETE policies to client_billing and profiles
--      so that System Admins (levels 1-4) can create and manage station owner
--      accounts from the Super Admin portal.
-- ============================================================================

-- 1. CLIENT_BILLING — allow system admins to INSERT new billing records
DROP POLICY IF EXISTS "System admins can insert billing records" ON public.client_billing;
CREATE POLICY "System admins can insert billing records"
  ON public.client_billing FOR INSERT TO authenticated
  WITH CHECK (
    public.is_system_admin(3)  -- levels 1-3 (support_staff = level 3)
    OR public.is_system_admin(4)     -- levels 1-4 (analyst = level 4)
  );

-- 2. CLIENT_BILLING — allow system admins to UPDATE billing records
DROP POLICY IF EXISTS "System admins can update billing records" ON public.client_billing;
CREATE POLICY "System admins can update billing records"
  ON public.client_billing FOR UPDATE TO authenticated
  USING (public.is_system_admin(4))
  WITH CHECK (public.is_system_admin(4));

-- 3. CLIENT_BILLING — allow system admins to DELETE billing records
DROP POLICY IF EXISTS "System admins can delete billing records" ON public.client_billing;
CREATE POLICY "System admins can delete billing records"
  ON public.client_billing FOR DELETE TO authenticated
  USING (public.is_system_admin(3));

-- 4. PROFILES — allow system admins to INSERT new profile records
--    (needed when creating the owner profile entry after billing record)
DROP POLICY IF EXISTS "System admins can insert profiles" ON public.profiles;
CREATE POLICY "System admins can insert profiles"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_system_admin(4));

-- 5. PROFILES — allow system admins to UPDATE any profile
DROP POLICY IF EXISTS "System admins can update any profile" ON public.profiles;
CREATE POLICY "System admins can update any profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_system_admin(4))
  WITH CHECK (public.is_system_admin(4));
