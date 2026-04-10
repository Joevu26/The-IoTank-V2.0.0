-- supabase/migrations/20260324210000_fix_client_billing_rls.sql
-- ============================================================================
-- FIX: Explicitly allow System Admins to INSERT/UPDATE client_billing and sites.
-- This resolves the 403 Forbidden error during registration approval.
-- ============================================================================

-- 1. CLIENT_BILLING
ALTER TABLE public.client_billing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System admins can insert billing" ON public.client_billing;
CREATE POLICY "System admins can insert billing"
ON public.client_billing FOR INSERT
TO authenticated
WITH CHECK (public.is_system_admin(3)); -- Level 3 (support_staff) and above

DROP POLICY IF EXISTS "System admins can update billing" ON public.client_billing;
CREATE POLICY "System admins can update billing"
ON public.client_billing FOR UPDATE
TO authenticated
USING (public.is_system_admin(3))
WITH CHECK (public.is_system_admin(3));

DROP POLICY IF EXISTS "System admins can view all billing" ON public.client_billing;
CREATE POLICY "System admins can view all billing"
ON public.client_billing FOR SELECT
TO authenticated
USING (public.is_system_admin(4)); -- Level 4 (analyst) and above

-- 2. SITES
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System admins can insert sites" ON public.sites;
CREATE POLICY "System admins can insert sites"
ON public.sites FOR INSERT
TO authenticated
WITH CHECK (public.is_system_admin(3));

DROP POLICY IF EXISTS "System admins can update sites" ON public.sites;
CREATE POLICY "System admins can update sites"
ON public.sites FOR UPDATE
TO authenticated
USING (public.is_system_admin(3))
WITH CHECK (public.is_system_admin(3));

DROP POLICY IF EXISTS "System admins can view all sites" ON public.sites;
CREATE POLICY "System admins can view all sites"
ON public.sites FOR SELECT
TO authenticated
USING (public.is_system_admin(4));

-- 3. TANKS (Just in case)
ALTER TABLE public.tanks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "System admins can insert tanks" ON public.tanks;
CREATE POLICY "System admins can insert tanks"
ON public.tanks FOR INSERT
TO authenticated
WITH CHECK (public.is_system_admin(3));

-- 4. GRANT PERMISSIONS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_billing TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tanks TO authenticated;
