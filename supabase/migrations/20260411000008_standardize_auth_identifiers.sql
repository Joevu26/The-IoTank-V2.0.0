-- supabase/migrations/20260411000008_standardize_auth_identifiers.sql
-- ============================================================================
-- DEFINITIVE STANDARDIZATION: auth_user_id & get_user_bundle_v1
-- ============================================================================
-- Resolves the 400 Bad Request and Timeout errors caused by schema mismatch
-- and recursive RLS dependencies.
-- ============================================================================

-- 1. Ensure indexes exist for identity lookup performance
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id_station ON public.profiles(auth_user_id, station_id);
CREATE INDEX IF NOT EXISTS idx_system_users_auth_user_id ON public.system_users(auth_user_id);

-- 2. Fix get_station_id_from_auth to be ultra-fast and standardize column names
CREATE OR REPLACE FUNCTION public.get_station_id_from_auth()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT station_id 
        FROM public.profiles 
        WHERE auth_user_id = auth.uid() 
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Fix get_user_bundle_v1 to follow the 8-level hierarchy and latest schema
CREATE OR REPLACE FUNCTION public.get_user_bundle_v1()
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
      p.address,
      p.phone_number,
      p.site_ids,
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
    LEFT JOIN public.fuel_stations fs ON p.station_id = fs.id
    WHERE p.auth_user_id = v_uid
    LIMIT 1
  )
  SELECT to_jsonb(identity.*)
  INTO v_result
  FROM identity
  LIMIT 1;

  RETURN v_result;
END;
$$;

-- 4. Reload PostgREST
NOTIFY pgrst, 'reload schema';
