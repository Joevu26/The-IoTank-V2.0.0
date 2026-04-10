-- ============================================================================
-- SYSTEM-WIDE SCHEMA HARMONY (V2.0.0)
-- ============================================================================
-- FINAL synchronization of all database functions, triggers, and RLS 
-- to ensure they strictly use 'auth_user_id' and 'station_id'.
-- ============================================================================

-- 1. REPAIR: Core Auth Helper Functions
-- ============================================================================

-- A. get_auth_level (Standardized v2)
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
  -- 1. Check system_users
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

  -- 2. Check profiles
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

-- B. is_system_admin (Standardized v2)
CREATE OR REPLACE FUNCTION public.is_system_admin(minimum_role TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_active BOOLEAN;
  v_role_order INT;
  v_required_order INT;
BEGIN
  IF v_uid IS NULL THEN RETURN FALSE; END IF;

  SELECT role, is_active INTO v_role, v_active
  FROM public.system_users
  WHERE auth_user_id = v_uid;

  IF v_role IS NULL OR NOT v_active THEN RETURN FALSE; END IF;
  IF minimum_role IS NULL THEN RETURN TRUE; END IF;

  -- HIERARCHY
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

-- C. get_user_station_id (Standardized v2)
-- Renaming from get_user_client_id to reflect station-centric model
CREATE OR REPLACE FUNCTION public.get_user_station_id()
RETURNS UUID
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_station_id UUID;
BEGIN
  SELECT station_id INTO v_station_id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
  RETURN COALESCE(v_station_id, '00000000-0000-0000-0000-000000000000'::UUID);
END;
$$ LANGUAGE plpgsql STABLE;

-- Backward compatibility for get_user_client_id
CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS UUID AS $$ BEGIN RETURN public.get_user_station_id(); END; $$ LANGUAGE plpgsql;

-- 2. REPAIR: Audit Logging Trigger
-- ============================================================================
-- Fixes the 'supabase_uid' error by ensuring the function uses 'auth_user_id'.
-- Added exception handling to prevent logging failures from blocking business logic.

CREATE OR REPLACE FUNCTION public.log_admin_action()
RETURNS TRIGGER AS $$
DECLARE
  v_action_type TEXT := TG_ARGV[0];
  v_description TEXT := TG_ARGV[1];
  v_admin_uid UUID;
  v_system_user_id UUID;
BEGIN
  v_admin_uid := auth.uid();
  
  -- If this is an automated system action (no auth context), bypass logging
  IF v_admin_uid IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    -- Resolve system_user_id first
    SELECT id INTO v_system_user_id FROM public.system_users WHERE auth_user_id = v_admin_uid LIMIT 1;

    INSERT INTO public.admin_logs (
      system_user_id,
      auth_user_id,
      action_type,
      affected_station_id,
      description,
      changes_made
    ) VALUES (
      v_system_user_id,
      v_admin_uid,
      v_action_type,
      CASE 
        WHEN TG_TABLE_NAME = 'fuel_stations' THEN NEW.id
        WHEN TG_TABLE_NAME = 'transactions' THEN (NEW.station_id)::uuid
        WHEN TG_TABLE_NAME = 'tanks' THEN (NEW.station_id)::uuid
        ELSE NULL 
      END,
      v_description,
      jsonb_build_object('new', row_to_json(NEW))
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never let an audit log failure crash the main transaction
    RAISE WARNING 'Audit Login Failed: % (SQL_STATE: %)', SQLERRM, SQLSTATE;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 3. IDENTITY REPAIR: profiles (Ensuring 'auth_user_id' index)
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profiles_auth_user_id') THEN
        CREATE INDEX idx_profiles_auth_user_id ON public.profiles(auth_user_id);
    END IF;
END $$;

-- 4. RELOAD: PostgREST Schema
NOTIFY pgrst, 'reload schema';
