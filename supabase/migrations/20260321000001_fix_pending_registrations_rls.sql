-- ============================================================================
-- FIX: Update is_system_admin calls to use integers instead of string literals
-- The function signature was updated in 20260319000003_rbac_hierarchy.sql 
-- to accept integers (1=super_admin, 2=admin_helper, 3=support_staff, 4=analyst).
-- Passing 'support_staff' causes a Postgres type error, blocking frontend queries.
-- ============================================================================

-- ENSURE the correct function signature exists
DROP FUNCTION IF EXISTS public.is_system_admin(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.is_system_admin(INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION public.is_system_admin(required_level INTEGER DEFAULT 4)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Returns true if the user's level is less than or equal to the required system level (1-4)
  RETURN public.get_auth_level() <= required_level AND public.get_auth_level() > 0;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.is_system_admin(INTEGER) TO authenticated, anon;

-- 1. pending_registrations
DROP POLICY IF EXISTS "System admins can view all pending registrations" ON public.pending_registrations;
CREATE POLICY "System admins can view all pending registrations"
  ON public.pending_registrations FOR SELECT TO authenticated
  USING (public.is_system_admin(3));

DROP POLICY IF EXISTS "System admins can update pending registrations" ON public.pending_registrations;
CREATE POLICY "System admins can update pending registrations"
  ON public.pending_registrations FOR UPDATE TO authenticated
  USING (public.is_system_admin(3))
  WITH CHECK (public.is_system_admin(3));

-- 2. client_billing
DROP POLICY IF EXISTS "Admins can create billing records" ON public.client_billing;
CREATE POLICY "Admins can create billing records"
ON public.client_billing FOR INSERT
TO authenticated
WITH CHECK (public.is_system_admin(3));

-- 3. sites
DROP POLICY IF EXISTS "System admins can create sites" ON public.sites;
CREATE POLICY "System admins can create sites"
ON public.sites FOR INSERT
TO authenticated
WITH CHECK (public.is_system_admin(3));

-- 4. tanks
DROP POLICY IF EXISTS "System admins can create tanks" ON public.tanks;
CREATE POLICY "System admins can create tanks"
ON public.tanks FOR INSERT
TO authenticated
WITH CHECK (public.is_system_admin(3));

-- 5. profiles
DROP POLICY IF EXISTS "System admins can insert profiles" ON public.profiles;
CREATE POLICY "System admins can insert profiles"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (public.is_system_admin(3));
