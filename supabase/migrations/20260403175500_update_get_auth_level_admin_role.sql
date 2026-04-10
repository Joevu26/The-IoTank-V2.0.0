-- supabase/migrations/20260403175500_update_get_auth_level_admin_role.sql
-- ============================================================================
-- FIX: Support 'admin' role in Client Portal Auth Level mapping
-- ============================================================================

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
      WHEN 'admin' THEN RETURN 6;      -- Support 'admin' role
      WHEN 'supervisor' THEN RETURN 6; -- Support 'supervisor' role as alias
      WHEN 'operator' THEN RETURN 7;
      WHEN 'viewer' THEN RETURN 8;
      ELSE RETURN 99;
    END CASE;
  END IF;

  RETURN 99;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Provide Integer Overload for is_system_admin to prevent SQL errors
CREATE OR REPLACE FUNCTION public.is_system_admin(required_level INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.get_auth_level() <= required_level AND public.get_auth_level() > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

COMMENT ON FUNCTION public.get_auth_level() IS 'Returns the auth level of the user (1-4 for System Admins, 5+ for Client Workforce). Level 6 now specifically includes both Admin and Supervisor roles.';
