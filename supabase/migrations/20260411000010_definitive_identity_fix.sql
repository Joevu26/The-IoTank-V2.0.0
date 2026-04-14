-- supabase/migrations/20260411000010_definitive_identity_fix.sql
-- ============================================================================
-- DEFINITIVE IDENTITY FIX & SCHEMA ALIGNMENT
-- ============================================================================

DO $$ 
BEGIN
    -- 1. FORCE SCHEMA ALIGNMENT: fuel_stations
    -- Rename 'id' to 'station_id' if it hasn't been successfully renamed yet.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_stations' AND column_name = 'id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_stations' AND column_name = 'station_id') THEN
            ALTER TABLE public.fuel_stations RENAME COLUMN id TO station_id;
        END IF;
    END IF;

    -- 2. FORCE SCHEMA ALIGNMENT: profiles
    -- Rename 'id' to 'auth_user_id' if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'id') THEN
         IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'auth_user_id') THEN
             ALTER TABLE public.profiles RENAME COLUMN id TO auth_user_id;
         END IF;
    END IF;
    
    -- Rename 'supabase_uid' to 'auth_user_id'
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'supabase_uid') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'auth_user_id') THEN
            ALTER TABLE public.profiles RENAME COLUMN supabase_uid TO auth_user_id;
        ELSE 
            -- Both exist, which means auth_user_id was added, but supabase_uid wasn't dropped.
            -- Keep auth_user_id, drop supabase_uid.
            ALTER TABLE public.profiles DROP COLUMN supabase_uid;
        END IF;
    END IF;

    -- Ensure 'display_name' is correctly named on system_users
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_users' AND column_name = 'full_name') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_users' AND column_name = 'display_name') THEN
            ALTER TABLE public.system_users RENAME COLUMN full_name TO display_name;
        END IF;
    END IF;

END $$;


-- 3. FIX: get_station_id_from_auth
-- This avoids the phantom admin issue by checking both profiles and system_users.
CREATE OR REPLACE FUNCTION public.get_station_id_from_auth()
RETURNS UUID AS $$
DECLARE
    v_station_id UUID;
    v_is_system BOOLEAN;
BEGIN
    -- Check if user is system admin
    SELECT TRUE INTO v_is_system FROM public.system_users WHERE auth_user_id = auth.uid() LIMIT 1;
    IF v_is_system THEN
        RETURN NULL; -- System admins don't have a specific station_id
    END IF;

    -- Standard lookup
    SELECT station_id INTO v_station_id 
    FROM public.profiles 
    WHERE auth_user_id = auth.uid() 
    LIMIT 1;
    
    RETURN v_station_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 4. IMPLEMENT SAFE RPC: get_user_bundle_v2
CREATE OR REPLACE FUNCTION public.get_user_bundle_v2()
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;

  BEGIN
    WITH identity AS (
      -- 1. Check system_users (IoTank Staff)
      SELECT
        'system'::TEXT          AS identity_type,
        su.role,
        su.display_name,
        su.photo_url,
        NULL::UUID              AS station_id,
        'IoTank Governance'     AS station_name,
        '/iotank-logo.png'      AS logo_url,
        NULL::TEXT              AS county,
        NULL::JSONB             AS address,
        NULL::TEXT              AS phone_number,
        ARRAY[]::UUID[]         AS site_ids,
        FALSE                   AS mfa_enabled,
        su.is_active,
        su.created_at,
        su.email,
        CASE su.role
          WHEN 'super_admin'   THEN 1
          WHEN 'admin_helper'  THEN 2
          WHEN 'support_staff' THEN 3
          WHEN 'analyst'       THEN 4
          ELSE 99
        END                     AS auth_level
      FROM public.system_users su
      WHERE su.auth_user_id = v_uid AND su.is_active = TRUE

      UNION ALL

      -- 2. Check profiles (Station Users)
      SELECT
        'profile'::TEXT         AS identity_type,
        p.role,
        p.display_name,
        p.photo_url,
        p.station_id,
        fs.station_name,
        fs.logo_url,
        fs.county,
        NULL::JSONB             AS address,
        NULL::TEXT              AS phone_number,
        ARRAY[]::UUID[]         AS site_ids,
        COALESCE(p.mfa_enabled, FALSE) AS mfa_enabled,
        TRUE                    AS is_active,
        p.created_at,
        p.email,
        CASE p.role
          WHEN 'admin'      THEN 5
          WHEN 'owner'      THEN 5
          WHEN 'supervisor' THEN 6
          WHEN 'operator'   THEN 7
          WHEN 'viewer'     THEN 8
          ELSE 99
        END                     AS auth_level
      FROM public.profiles p
      LEFT JOIN public.fuel_stations fs ON p.station_id = fs.station_id -- Safely use validated column name
      WHERE p.auth_user_id = v_uid
      LIMIT 1
    )
    SELECT to_jsonb(identity.*)
    INTO v_result
    FROM identity
    LIMIT 1;

    -- Return the result if found, if not it will be null and handled by frontend
    RETURN v_result;

  EXCEPTION WHEN OTHERS THEN
    -- In V2, we catch errors and return them cleanly to avoid 400 crashes loop
    RETURN jsonb_build_object(
      'identity_type', 'error',
      'error_code', SQLSTATE,
      'error_message', SQLERRM
    );
  END;
END;
$$;

-- Reload PostgREST to be safe
NOTIFY pgrst, 'reload schema';
