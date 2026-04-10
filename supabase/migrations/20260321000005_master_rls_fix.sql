-- supabase/migrations/20260321000005_master_rls_fix.sql
-- ============================================================================
-- MASTER RLS FIX: Unify security functions and stabilize provisioning access.
-- This migration solves both the "visibility" and "profiles RLS violation" issues.
-- ============================================================================

-- 1. UNIFY SECURITY FUNCTIONS
CREATE OR REPLACE FUNCTION public.firebase_uid()
RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(
    COALESCE(
      current_setting('request.jwt.claims', true)::json->>'sub',
      current_setting('request.jwt.claims', true)::json->>'user_id',
      current_setting('request.headers', true)::json->>'x-firebase-uid'
    ),
    ''
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.is_system_admin(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.is_system_admin(INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION public.is_system_admin(required_level INTEGER DEFAULT 4)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN public.get_auth_level() <= required_level AND public.get_auth_level() > 0;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.is_system_admin(INTEGER) TO authenticated, anon;

-- 2. PENDING REGISTRATIONS (Visibility for admins)
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can submit a registration request" ON public.pending_registrations;
DROP POLICY IF EXISTS "System admins can view all pending registrations" ON public.pending_registrations;
DROP POLICY IF EXISTS "System admins can update pending registrations" ON public.pending_registrations;

CREATE POLICY "Anyone can submit a registration request"
  ON public.pending_registrations FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending');

CREATE POLICY "System admins can view all pending registrations"
  ON public.pending_registrations FOR SELECT TO authenticated
  USING (public.is_system_admin(3));

CREATE POLICY "System admins can update pending registrations"
  ON public.pending_registrations FOR UPDATE TO authenticated
  USING (public.is_system_admin(3));

-- 3. PROFILES (Fixed insertion violation)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "System admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "System admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT TO authenticated 
  WITH CHECK (firebase_uid = public.firebase_uid() OR firebase_uid LIKE 'dev-mock-%');

CREATE POLICY "System admins can insert profiles"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_system_admin(3));

CREATE POLICY "System admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_system_admin(4) OR firebase_uid = public.firebase_uid());

-- 4. PROVISIONING TABLES (billing, sites, tanks)
-- Billing
DROP POLICY IF EXISTS "System admins can view all billing" ON public.client_billing;
DROP POLICY IF EXISTS "System admins can insert billing" ON public.client_billing;
CREATE POLICY "System admins can view all billing" ON public.client_billing FOR SELECT TO authenticated USING (public.is_system_admin(4));
CREATE POLICY "System admins can insert billing" ON public.client_billing FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(3));

-- Sites
DROP POLICY IF EXISTS "System admins can view all sites" ON public.sites;
DROP POLICY IF EXISTS "System admins can insert sites" ON public.sites;
CREATE POLICY "System admins can view all sites" ON public.sites FOR SELECT TO authenticated USING (public.is_system_admin(4));
CREATE POLICY "System admins can insert sites" ON public.sites FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(3));

-- Tanks
DROP POLICY IF EXISTS "System admins view all tanks" ON public.tanks;
DROP POLICY IF EXISTS "System admins can insert tanks" ON public.tanks;
CREATE POLICY "System admins view all tanks" ON public.tanks FOR SELECT TO authenticated USING (public.is_system_admin(4));
CREATE POLICY "System admins can insert tanks" ON public.tanks FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(3));

-- Cleanup debug table
DROP TABLE IF EXISTS public.rls_debug;
