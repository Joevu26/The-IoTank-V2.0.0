-- supabase/migrations/20260411000004_performance_optimization_v1.sql
-- ============================================================================
-- PERFORMANCE OPTIMIZATION: Unified Identity Handshake
-- ============================================================================

-- 1. UNIFIED IDENTITY BUNDLE
-- This function returns everything needed for a user session in a single call.
CREATE OR REPLACE FUNCTION public.get_user_bundle_v1()
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;

  WITH identity AS (
    -- 1. Check system_users (IoT staff)
    SELECT 
      'system'::TEXT as identity_type,
      su.role,
      su.display_name,
      su.photo_url,
      'SYSTEM_GOVERNANCE'::UUID as station_id,
      'IoTank Governance'::TEXT as station_name,
      '/iotank-logo.png'::TEXT as logo_url,
      NULL::TEXT as county,
      NULL::JSONB as address,
      NULL::TEXT as phone_number,
      ARRAY[]::UUID[] as site_ids,
      FALSE as mfa_enabled,
      su.is_active,
      su.created_at,
      CASE su.role
        WHEN 'super_admin'   THEN 1
        WHEN 'admin_helper'  THEN 2
        WHEN 'support_staff' THEN 3
        WHEN 'analyst'       THEN 4
        ELSE 99
      END as auth_level
    FROM public.system_users su
    WHERE su.auth_user_id = v_uid AND su.is_active = TRUE
    
    UNION ALL
    
    -- 2. Check profiles (Customers)
    SELECT 
      'profile'::TEXT as identity_type,
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
      COALESCE(p.mfa_enabled, FALSE) as mfa_enabled,
      TRUE as is_active,
      p.created_at,
      CASE p.role
        WHEN 'admin'      THEN 5
        WHEN 'owner'      THEN 5
        WHEN 'supervisor' THEN 6
        WHEN 'operator'   THEN 7
        WHEN 'viewer'     THEN 8
        ELSE 99
      END as auth_level
    FROM public.profiles p
    LEFT JOIN public.fuel_stations fs ON p.station_id = fs.station_id  -- FIXED: use station_id instead of id
    WHERE p.auth_user_id = v_uid
    LIMIT 1
  )
  SELECT 
    to_jsonb(identity.*)
  INTO v_result
  FROM identity
  LIMIT 1;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 2. PERFORMANCE INDEXES
-- Ensure O(1) lookups for the bundle
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id_perf ON public.profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_system_users_auth_user_id_perf ON public.system_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_fuel_stations_station_id_perf ON public.fuel_stations(station_id); -- FIXED: use station_id instead of id

-- 3. RELOAD
NOTIFY pgrst, 'reload schema';