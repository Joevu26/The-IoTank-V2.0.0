-- supabase/migrations/20260413010000_is_admin_identity_hardening.sql
-- ============================================================================
-- SECURITY HARDENING: Standardizing Security Helpers
-- Ensures that is_admin() and is_system_admin() use the unified auth_user_id column.
-- ============================================================================

-- Ensure auth_user_id exists on system_users and data counts
DO $$ 
BEGIN
    -- Rename supabase_uid to auth_user_id if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_users' AND column_name = 'supabase_uid') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_users' AND column_name = 'auth_user_id') THEN
            ALTER TABLE public.system_users RENAME COLUMN supabase_uid TO auth_user_id;
        ELSE
            -- Both exist, migration 20260411000008 already added auth_user_id
            ALTER TABLE public.system_users DROP COLUMN IF EXISTS supabase_uid;
        END IF;
    END IF;
END $$;

-- Hardened is_system_admin
CREATE OR REPLACE FUNCTION public.is_system_admin(minimum_role TEXT DEFAULT NULL)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_active BOOLEAN;
  v_role_order INT;
  v_required_order INT;
BEGIN
  IF v_uid IS NULL THEN RETURN FALSE; END IF;

  -- Use auth_user_id (Unified)
  SELECT su.role, su.is_active INTO v_role, v_active
  FROM public.system_users su
  WHERE su.auth_user_id = v_uid;

  IF NOT FOUND OR NOT v_active THEN RETURN FALSE; END IF;
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
$$;

-- Hardened is_admin (super_admin check)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN public.is_system_admin('super_admin');
END;
$$;

-- FINAL NOTIFY
NOTIFY pgrst, 'reload schema';
