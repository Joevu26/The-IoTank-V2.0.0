-- supabase/migrations/20260409000500_cascade_and_function_fixes.sql
-- ============================================================================
-- 1. FIX AUTH FUNCTIONS (Fixes 'column su.supabase_uid does not exist')
-- ============================================================================

-- A. get_auth_level
CREATE OR REPLACE FUNCTION public.get_auth_level()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  n_uid UUID := auth.uid();
  sys_role TEXT;
  prof_role TEXT;
BEGIN
  -- 1. Check system_users (Levels 1-4)
  SELECT role INTO sys_role 
  FROM system_users 
  WHERE auth_user_id = n_uid 
  AND is_active = TRUE
  LIMIT 1;
  
  IF sys_role IS NOT NULL THEN
    CASE sys_role
      WHEN 'super_admin' THEN RETURN 1;
      WHEN 'admin_helper' THEN RETURN 2;
      WHEN 'support_staff' THEN RETURN 3;
      WHEN 'analyst' THEN RETURN 4;
      ELSE RETURN 99;
    END CASE;
  END IF;

  -- 2. Check profiles (Levels 5-8)
  SELECT role INTO prof_role 
  FROM profiles 
  WHERE auth_user_id = n_uid
  LIMIT 1;
  
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

-- B. is_system_admin
CREATE OR REPLACE FUNCTION public.is_system_admin(minimum_role TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_uid UUID;
  v_role TEXT;
  v_active BOOLEAN;
  v_role_order INT;
  v_required_order INT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN FALSE; END IF;

  SELECT role, is_active INTO v_role, v_active
  FROM public.system_users
  WHERE auth_user_id = v_uid;

  IF v_role IS NULL OR NOT v_active THEN RETURN FALSE; END IF;
  IF minimum_role IS NULL THEN RETURN TRUE; END IF;

  -- HIERARCHY (1 is highest)
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

-- C. get_station_id_from_auth
CREATE OR REPLACE FUNCTION public.get_station_id_from_auth()
RETURNS UUID AS $$
DECLARE
    v_station_id UUID;
BEGIN
    SELECT station_id INTO v_station_id
    FROM public.profiles
    WHERE auth_user_id = auth.uid();
    
    RETURN v_station_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- D. admin_adjust_station_debt
CREATE OR REPLACE FUNCTION public.admin_adjust_station_debt(
  p_station_id UUID,
  p_adjustment_amount DECIMAL,
  p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_uid UUID;
  v_system_user_id UUID;
  v_old_debt DECIMAL;
  v_new_debt DECIMAL;
BEGIN
  v_admin_uid := auth.uid();
  
  SELECT id INTO v_system_user_id
  FROM system_users
  WHERE auth_user_id = v_admin_uid
    AND is_active = TRUE
    AND role IN ('super_admin', 'admin_helper');

  IF v_system_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admins and Admin Helpers can adjust debt.';
  END IF;

  -- ... (Logic remains valid since table column names already renamed as 'auth_user_id' elsewhere)
  -- The core fix here is 'auth_user_id = v_admin_uid' in the WHERE clause.
  
  SELECT current_debt INTO v_old_debt FROM fuel_stations WHERE id = p_station_id;
  IF v_old_debt IS NULL THEN RAISE EXCEPTION 'Station not found.'; END IF;

  v_new_debt := GREATEST(0, v_old_debt + p_adjustment_amount);

  UPDATE fuel_stations SET current_debt = v_new_debt, updated_at = NOW() WHERE id = p_station_id;

  -- Record audit
  INSERT INTO admin_logs (system_user_id, auth_user_id, action_type, affected_station_id, description)
  VALUES (v_system_user_id, v_admin_uid, 'debt_adjusted', p_station_id, p_reason);

  RETURN jsonb_build_object('success', true, 'new_debt', v_new_debt);
END;
$$;

-- E. Fix Profiles Policy
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
CREATE POLICY "Users can read their own profile" ON public.profiles FOR SELECT
USING (auth_user_id = auth.uid());

-- ============================================================================
-- 2. ENFORCE CASCADING DELETES (Fixes 'Database error deleting user')
-- ============================================================================

-- A. profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_auth_user_id_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_auth_user_id_fkey 
FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- B. system_users
ALTER TABLE public.system_users DROP CONSTRAINT IF EXISTS system_users_auth_user_id_fkey;
ALTER TABLE public.system_users ADD CONSTRAINT system_users_auth_user_id_fkey 
FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- C. admin_logs
ALTER TABLE public.admin_logs DROP CONSTRAINT IF EXISTS admin_logs_auth_user_id_fkey;
ALTER TABLE public.admin_logs ADD CONSTRAINT admin_logs_auth_user_id_fkey 
FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- D. fuel_stations
ALTER TABLE public.fuel_stations DROP CONSTRAINT IF EXISTS fuel_stations_owner_id_fkey;
ALTER TABLE public.fuel_stations ADD CONSTRAINT fuel_stations_owner_id_fkey 
FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================================
-- 3. ADDITIONAL LEGACY FIXES
-- ============================================================================

-- Repair any views or triggers that might be cached with old column names
-- This is a generic "poke" to force re-evaluation of dependent objects
-- (Most triggers refer to columns by name, so RENAME should have handled them, 
-- but explicit functions like get_auth_level needed manual updates above).
