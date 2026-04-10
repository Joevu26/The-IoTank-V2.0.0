-- supabase/migrations/20260319000003_rbac_hierarchy.sql
-- ============================================================================
-- UNIFIED RBAC HIERARCHY (Levels 1-7)
-- ============================================================================

-- Function to get the numeric auth level of the current user
-- Level 1: Super Admin
-- Level 2: Admin Helper
-- Level 3: Support Staff
-- Level 4: Analyst
-- Level 5: Station Owner
-- Level 6: Station Supervisor
-- Level 7: Station Operator
-- Level 0/99: Public/Unauthenticated

CREATE OR REPLACE FUNCTION public.get_auth_level()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  f_uid TEXT := public.firebase_uid();
  sys_role TEXT;
  prof_role TEXT;
BEGIN
  -- 1. Check if user is in system_users (Levels 1-4)
  SELECT role INTO sys_role FROM system_users WHERE firebase_uid = f_uid AND is_active = TRUE;
  
  IF sys_role IS NOT NULL THEN
    CASE sys_role
      WHEN 'super_admin' THEN RETURN 1;
      WHEN 'admin_helper' THEN RETURN 2;
      WHEN 'support_staff' THEN RETURN 3;
      WHEN 'analyst' THEN RETURN 4;
      ELSE RETURN 99;
    END CASE;
  END IF;

  -- 2. Check if user is in profiles (Levels 5-7)
  SELECT role INTO prof_role FROM profiles WHERE firebase_uid = f_uid;
  
  IF prof_role IS NOT NULL THEN
    CASE prof_role
      WHEN 'owner' THEN RETURN 5;
      WHEN 'supervisor' THEN RETURN 6;
      WHEN 'operator' THEN RETURN 7;
      WHEN 'viewer' THEN RETURN 8; -- Extra level for read-only station view
      ELSE RETURN 99;
    END CASE;
  END IF;

  RETURN 99; -- Unknown/Public
END;
$$ LANGUAGE plpgsql;

-- Update is_system_admin to use the numeric level for cleaner checks
DROP FUNCTION IF EXISTS public.is_system_admin(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.is_system_admin(INTEGER) CASCADE;
CREATE OR REPLACE FUNCTION public.is_system_admin(required_level INTEGER DEFAULT 4)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Returns true if the user's level is less than or equal to the required system level (1-4)
  -- Note: Lower number = higher priority
  RETURN public.get_auth_level() <= required_level AND public.get_auth_level() > 0;
END;
$$ LANGUAGE plpgsql;

-- Add a check for client-layer levels
CREATE OR REPLACE FUNCTION public.has_client_access(required_level INTEGER DEFAULT 7)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  u_level INTEGER := public.get_auth_level();
BEGIN
  -- System admins (1-4) have access to everything
  IF u_level <= 4 THEN
    RETURN TRUE;
  END IF;
  
  -- Client users (5-7) must have a level <= required
  RETURN u_level <= required_level;
END;
$$ LANGUAGE plpgsql;

-- Add a column to profiles if it doesn't exist to cache the numeric level (optional but helpful)
-- For now, we rely on the function which is safer.

-- ============================================================================
-- Update existing RLS policies to use these new functions
-- ============================================================================

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_auth_level() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_system_admin(INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_client_access(INTEGER) TO authenticated, anon;
