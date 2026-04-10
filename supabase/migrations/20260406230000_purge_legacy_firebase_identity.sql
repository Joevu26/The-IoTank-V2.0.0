-- supabase/migrations/20260406230000_purge_legacy_firebase_identity.sql
-- ============================================================================
-- FINAL FIREBASE PURGE: Transition to pure Supabase-native UUID architecture.
-- Removes all legacy 'firebase_uid' columns and decommission shim functions.
-- ============================================================================

DO $$
BEGIN
  -- 1. DATA VALIDATION & INTEGRITY CHECK
  -- Only perform if firebase_uid still exists in profiles (idempotency)
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'profiles' AND column_name = 'firebase_uid') THEN
    
    IF EXISTS (SELECT 1 FROM public.profiles WHERE supabase_uid IS NULL AND firebase_uid IS NOT NULL) THEN
      RAISE EXCEPTION 'Migration Aborted: Profiles found with missing supabase_uid.';
    END IF;
    
  END IF;

  -- 2. DROP LEGACY COLUMNS
  -- Remove firebase_uid from all core tables.
  
  ALTER TABLE IF EXISTS public.system_users DROP COLUMN IF EXISTS firebase_uid;
  ALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS firebase_uid;
  ALTER TABLE IF EXISTS public.client_billing DROP COLUMN IF EXISTS firebase_uid;
  ALTER TABLE IF EXISTS public.tanks DROP COLUMN IF EXISTS firebase_uid;
  ALTER TABLE IF EXISTS public.transactions DROP COLUMN IF EXISTS firebase_uid;
  ALTER TABLE IF EXISTS public.usage_logs DROP COLUMN IF EXISTS firebase_uid;
  ALTER TABLE IF EXISTS public.alerts DROP COLUMN IF EXISTS firebase_uid;
  ALTER TABLE IF EXISTS public.deliveries DROP COLUMN IF EXISTS firebase_uid;
  ALTER TABLE IF EXISTS public.pending_registrations DROP COLUMN IF EXISTS firebase_uid;

  -- 3. ENFORCE SUPABASE ID INTEGRITY
  -- Set supabase_uid to NOT NULL to ensure future consistency.
  
  ALTER TABLE IF EXISTS public.profiles ALTER COLUMN supabase_uid SET NOT NULL;
  -- Note: Other tables might allow NULL supabase_uid if handled by system admins (e.g. alerts without specific users).

  -- 4. DECOMMISSION SHIM FUNCTIONS
  -- Remove the firebase_uid() helper as it is no longer relevant.
  DROP FUNCTION IF EXISTS public.firebase_uid() CASCADE;

END $$;

-- 5. UPDATE AUTH HELPERS
-- Simplify get_auth_level to use auth.uid() directly.
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
  IF n_uid IS NULL THEN RETURN 99; END IF;

  -- 1. Check system_users
  SELECT role INTO sys_role FROM public.system_users WHERE supabase_uid = n_uid AND is_active = TRUE LIMIT 1;
  IF sys_role IS NOT NULL THEN
    RETURN CASE sys_role
      WHEN 'super_admin'   THEN 1
      WHEN 'admin_helper'  THEN 2
      WHEN 'support_staff' THEN 3
      WHEN 'analyst'       THEN 4
      ELSE 99
    END;
  END IF;

  -- 2. Check profiles
  SELECT role INTO prof_role FROM public.profiles WHERE supabase_uid = n_uid LIMIT 1;
  IF prof_role IS NOT NULL THEN
    RETURN CASE prof_role
      WHEN 'admin'      THEN 5
      WHEN 'owner'      THEN 5
      WHEN 'supervisor' THEN 6
      WHEN 'operator'   THEN 7
      WHEN 'viewer'     THEN 8
      ELSE 99
    END;
  END IF;

  RETURN 99;
END;
$$ LANGUAGE plpgsql;

-- 6. UPDATE CLIENT ID HELPER
CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS UUID
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_client_id UUID;
BEGIN
  SELECT client_id INTO v_client_id FROM public.profiles WHERE supabase_uid = auth.uid() LIMIT 1;
  RETURN v_client_id;
END;
$$ LANGUAGE plpgsql STABLE;
