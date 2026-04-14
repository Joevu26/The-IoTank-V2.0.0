-- supabase/migrations/20260411000009_identity_handshake_diagnostic.sql
-- ============================================================================
-- IDENTITY HANDSHAKE DIAGNOSTIC & RPC HARDENING
-- ============================================================================

-- 1. Create a Self-Diagnostic Function
CREATE OR REPLACE FUNCTION public.check_my_identity()
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_auth_user JSONB;
  v_profile JSONB;
  v_system_user JSONB;
BEGIN
  -- Get Auth User Details
  SELECT jsonb_build_object(
    'id', id,
    'email', email,
    'last_sign_in_at', last_sign_in_at
  ) INTO v_auth_user
  FROM auth.users
  WHERE id = v_uid;

  -- Get Profile Details
  -- Checking for both old and new column names just in case renaming failed
  BEGIN
    SELECT to_jsonb(p.*) INTO v_profile FROM public.profiles p WHERE p.auth_user_id = v_uid LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      SELECT to_jsonb(p.*) INTO v_profile FROM public.profiles p WHERE p.supabase_uid = v_uid LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_profile := '{"error": "Column mismatch in profiles"}'::jsonb;
    END;
  END;

  -- Get System User Details
  SELECT to_jsonb(su.*) INTO v_system_user FROM public.system_users su WHERE su.auth_user_id = v_uid LIMIT 1;

  RETURN jsonb_build_object(
    'timestamp', now(),
    'auth_uid', v_uid,
    'auth_user', v_auth_user,
    'profile', v_profile,
    'system_user', v_system_user,
    'rpc_test', (SELECT public.get_user_bundle_v1())
  );
END;
$$;

-- 2. Definitive fix for get_user_bundle_v1 to ensure it uses the correct columns
CREATE OR REPLACE FUNCTION public.get_user_bundle_v1()
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_result JSONB;
  v_profile_exists BOOLEAN;
  v_system_user_exists BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;

  -- Performance optimized query with CASE for 8-level hierarchy
  WITH identity AS (
    -- 1. Check system_users (IoTank Staff)
    SELECT
      'system'::TEXT          AS identity_type,
      su.role,
      su.full_name            AS display_name,
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
      CASE 
        WHEN su.role = 'super_admin'   THEN 1
        WHEN su.role = 'admin_helper'  THEN 2
        WHEN su.role = 'support_staff' THEN 3
        WHEN su.role = 'analyst'       THEN 4
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
      p.address,
      p.phone_number,
      p.site_ids,
      COALESCE(p.mfa_enabled, FALSE) AS mfa_enabled,
      TRUE                    AS is_active,
      p.created_at,
      p.email,
      CASE 
        WHEN p.role IN ('admin', 'owner') THEN 5
        WHEN p.role = 'supervisor' THEN 6
        WHEN p.role = 'operator'   THEN 7
        WHEN p.role = 'viewer'     THEN 8
        ELSE 99
      END                     AS auth_level
    FROM public.profiles p
    LEFT JOIN public.fuel_stations fs ON p.station_id = fs.station_id
    WHERE p.auth_user_id = v_uid
    LIMIT 1
  )
  SELECT to_jsonb(identity.*)
  INTO v_result
  FROM identity
  LIMIT 1;

  -- Fallback if no identity found (User exists in Auth but not in data tables)
  IF v_result IS NULL THEN
    SELECT jsonb_build_object(
      'identity_type', 'none',
      'email', auth.email(),
      'auth_level', 8,
      'role', 'viewer',
      'station_id', NULL,
      'station_name', 'Awaiting Configuration',
      'is_active', TRUE
    ) INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;
