-- supabase/migrations/20260322000004_fix_auth_hang_recursion.sql
-- First, aggressively drop all potential function signatures with CASCADE
-- This clears any conflicts with defaults or parameter types.
DROP FUNCTION IF EXISTS public.is_system_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_system_admin(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.is_system_admin(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.is_system_admin(INT4) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- Also disable RLS temporarily to ensure we can reset everything clearly
ALTER TABLE IF EXISTS public.system_users DISABLE ROW LEVEL SECURITY;

-- 1. Modernize is_system_admin to support both native Supabase UID and Firebase UID
-- This function is SECURITY DEFINER to bypass RLS when checking permissions.
CREATE OR REPLACE FUNCTION public.is_system_admin(required_role TEXT DEFAULT NULL)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid_text TEXT := public.firebase_uid();
  v_uid_uuid UUID := auth.uid();
  v_role TEXT;
  v_active BOOLEAN;
  v_role_order INT;
  v_req_order INT;
BEGIN
  -- Basic validity check
  IF v_uid_uuid IS NULL AND v_uid_text IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Fetch role and status bypassing RLS
  SELECT su.role, su.is_active INTO v_role, v_active
  FROM public.system_users su
  WHERE (su.supabase_uid = v_uid_uuid OR su.firebase_uid = v_uid_text)
  LIMIT 1;

  IF NOT FOUND OR NOT v_active THEN
    RETURN FALSE;
  END IF;

  IF required_role IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Numeric hierarchy for comparison
  v_role_order := CASE v_role
    WHEN 'super_admin'   THEN 4
    WHEN 'admin_helper'  THEN 3
    WHEN 'support_staff' THEN 2
    WHEN 'analyst'       THEN 1
    ELSE 0
  END;

  v_req_order := CASE required_role
    WHEN 'super_admin'   THEN 4
    WHEN 'admin_helper'  THEN 3
    WHEN 'support_staff' THEN 2
    WHEN 'analyst'       THEN 1
    ELSE 0
  END;

  RETURN v_role_order >= v_req_order;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Add an INTEGER overload for is_system_admin to support legacy level checks
CREATE OR REPLACE FUNCTION public.is_system_admin(required_level INTEGER)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_level INTEGER;
BEGIN
  v_level := public.get_auth_level();
  -- Level mapping: 1=super, 2=helper, 3=staff, 4=analyst
  -- Hierarchy is inverted (lower number = higher power)
  RETURN v_level <= required_level;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Fix the RLS policies for system_users to prevent recursion
-- We use a more direct check for self-visibility and a non-recursive admin check.

ALTER TABLE public.system_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System users can read their own profile" ON public.system_users;
DROP POLICY IF EXISTS "Admins can manage all users" ON public.system_users;
DROP POLICY IF EXISTS "Super Admins can manage all users" ON public.system_users;
DROP POLICY IF EXISTS "Service role can manage system users" ON public.system_users;
DROP POLICY IF EXISTS "Anyone can read system users" ON public.system_users;

CREATE POLICY "System users can read their own profile"
ON public.system_users FOR SELECT
TO authenticated
USING (supabase_uid = auth.uid() OR firebase_uid = public.firebase_uid());

CREATE POLICY "Super Admins can manage all users"
ON public.system_users FOR ALL
TO authenticated
USING (
  -- Use the SECURITY DEFINER check which we've hardened above.
  public.is_system_admin('super_admin')
)
WITH CHECK (
  public.is_system_admin('super_admin')
);

CREATE POLICY "Service role can manage system users"
ON public.system_users FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
