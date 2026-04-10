-- supabase/migrations/20260402030000_fix_auth_helper_functions_fallback.sql
-- ============================================================================
-- FIX: Support email-based matching as a fallback for unlinked users during initial login
-- This ensures that RLS functions correctly even if the supabase_uid hasn't been synced yet.
-- ============================================================================

-- 1. Redefine is_system_admin to support email-based fallback for unlinked users
CREATE OR REPLACE FUNCTION public.is_system_admin(minimum_role TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_uid UUID;
  v_email TEXT;
  v_role TEXT;
  v_active BOOLEAN;
  v_role_order INT;
  v_required_order INT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN FALSE; END IF;

  v_email := LOWER(auth.jwt()->>'email');

  -- First attempt by UID
  SELECT su.role, su.is_active INTO v_role, v_active
  FROM public.system_users su
  WHERE su.supabase_uid::uuid = v_uid::uuid;

  -- Fallback to email if UID not matched OR UID is null in DB
  IF NOT FOUND OR v_role IS NULL THEN
    SELECT su.role, su.is_active INTO v_role, v_active
    FROM public.system_users su
    WHERE LOWER(su.email) = v_email
    AND su.supabase_uid IS NULL; -- Only allow email fallback if UID isn't already set to someone else
  END IF;

  IF v_role IS NULL OR NOT v_active THEN RETURN FALSE; END IF;
  IF minimum_role IS NULL THEN RETURN TRUE; END IF;

  -- ALIGNED HIERARCHY (1 is highest)
  v_role_order := CASE v_role
    WHEN 'super_admin'   THEN 1
    WHEN 'admin_helper'  THEN 2
    WHEN 'support_staff' THEN 3
    WHEN 'analyst'       THEN 4
    ELSE 99
  END;

  v_required_order := CASE minimum_role
    WHEN 'super_admin'   THEN 1
    WHEN 'admin_helper'  THEN 2
    WHEN 'support_staff' THEN 3
    WHEN 'analyst'       THEN 4
    ELSE 99
  END;

  RETURN v_role_order <= v_required_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 2. Redefine get_auth_level to support email-based fallback for unlinked users
CREATE OR REPLACE FUNCTION public.get_auth_level()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  sys_role TEXT;
  prof_role TEXT;
BEGIN
  IF v_uid IS NULL THEN RETURN 99; END IF;
  
  v_email := LOWER(auth.jwt()->>'email');

  -- 1. Check system_users (Levels 1-4)
  -- Attempt by UID first
  SELECT role INTO sys_role 
  FROM public.system_users 
  WHERE supabase_uid = v_uid 
  AND is_active = TRUE
  LIMIT 1;
  
  -- Fallback to email if UID not matched
  IF sys_role IS NULL THEN
    SELECT role INTO sys_role 
    FROM public.system_users 
    WHERE LOWER(email) = v_email
    AND supabase_uid IS NULL
    AND is_active = TRUE
    LIMIT 1;
  END IF;

  IF sys_role IS NOT NULL THEN
    CASE sys_role
      WHEN 'super_admin' THEN RETURN 1;
      WHEN 'admin_helper' THEN RETURN 2;
      WHEN 'support_staff' THEN RETURN 3;
      WHEN 'analyst' THEN RETURN 4;
      ELSE NULL; -- Continue to profiles if system role is unknown
    END CASE;
  END IF;

  -- 2. Check profiles (Levels 5-8)
  -- Attempt by UID first
  SELECT role INTO prof_role 
  FROM public.profiles 
  WHERE supabase_uid = v_uid
  LIMIT 1;
  
  -- Fallback to email if UID not matched
  IF prof_role IS NULL THEN
    SELECT role INTO prof_role 
    FROM public.profiles 
    WHERE LOWER(email) = v_email
    AND supabase_uid IS NULL
    LIMIT 1;
  END IF;

  IF prof_role IS NOT NULL THEN
    CASE prof_role
      WHEN 'owner' THEN RETURN 5;
      WHEN 'admin' THEN RETURN 5;
      WHEN 'supervisor' THEN RETURN 6;
      WHEN 'operator' THEN RETURN 7;
      WHEN 'viewer' THEN RETURN 8;
      ELSE RETURN 99;
    END CASE;
  END IF;

  RETURN 99;
END;
$$ LANGUAGE plpgsql STABLE;
