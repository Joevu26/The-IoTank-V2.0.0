-- supabase/migrations/20260319000008_rename_owner_to_admin.sql
-- ============================================================================
-- ROLE ALIAS: owner / admin (Client Web Layer)
-- Station Owners are now formally referred to as 'admin', but 'owner' 
-- remains supported for backward compatibility and interchangeable use.
-- ============================================================================

-- Step 1: Update the constraint from profiles to allow BOTH
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'admin', 'supervisor', 'operator', 'viewer'));

-- Step 2: Note: We keep existing 'owner' records as is, or optionally migrate them.
-- To follow the "preferred" instruction, we can migrate them but keep 'owner' valid.
UPDATE public.profiles
  SET role = 'admin'
  WHERE role = 'owner';

-- Step 3: Update get_auth_level function to recognize both as Level 5
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

  -- 2. Check if user is in profiles (Levels 5-8)
  SELECT role INTO prof_role FROM profiles WHERE firebase_uid = f_uid;
  
  IF prof_role IS NOT NULL THEN
    CASE prof_role
      WHEN 'admin' THEN RETURN 5;    -- Preferred
      WHEN 'owner' THEN RETURN 5;    -- Alias
      WHEN 'supervisor' THEN RETURN 6;
      WHEN 'operator' THEN RETURN 7;
      WHEN 'viewer' THEN RETURN 8;
      ELSE RETURN 99;
    END CASE;
  END IF;

  RETURN 99; -- Unknown/Public
END;
$$ LANGUAGE plpgsql;

-- Step 4: Explicitly grant execute
GRANT EXECUTE ON FUNCTION public.get_auth_level() TO authenticated, anon;
