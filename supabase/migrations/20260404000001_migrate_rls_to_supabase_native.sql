-- supabase/migrations/20260404000001_migrate_rls_to_supabase_native.sql
-- ============================================================================
-- FIX: Migrate Security (RLS) to Supabase-Native UUIDs
-- ============================================================================

-- 1. Redefine Security Helper Functions
-- ============================================================================

-- Check if the current user is a system administrator
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.system_users 
        WHERE supabase_uid = auth.uid() 
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Get the Client ID (Organization ID) for the current user
CREATE OR REPLACE FUNCTION public.get_client_id_from_auth()
RETURNS UUID AS $$
DECLARE
    v_client_id UUID;
BEGIN
    -- Check client profiles
    SELECT client_id INTO v_client_id
    FROM public.profiles
    WHERE supabase_uid = auth.uid();
    
    RETURN v_client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Update TANKS Row-Level Security
-- ============================================================================

-- Drop old policies that relied on firebase_uid column
DROP POLICY IF EXISTS "Users can view own tanks" ON public.tanks;
DROP POLICY IF EXISTS "Users can create own tanks" ON public.tanks;
DROP POLICY IF EXISTS "Users can update own tanks" ON public.tanks;
DROP POLICY IF EXISTS "Users can delete own tanks" ON public.tanks;
DROP POLICY IF EXISTS "Admins have full access to tanks" ON public.tanks;

-- Create new UUID-based policies
CREATE POLICY "Users can view own tanks"
ON public.tanks FOR SELECT
USING (client_id = get_client_id_from_auth() OR is_admin());

CREATE POLICY "Users can create own tanks"
ON public.tanks FOR INSERT
WITH CHECK (client_id = get_client_id_from_auth() OR is_admin());

CREATE POLICY "Users can update own tanks"
ON public.tanks FOR UPDATE
USING (client_id = get_client_id_from_auth() OR is_admin())
WITH CHECK (client_id = get_client_id_from_auth() OR is_admin());

CREATE POLICY "Users can delete own tanks"
ON public.tanks FOR DELETE
USING (client_id = get_client_id_from_auth() OR is_admin());

-- 3. Update SITES Row-Level Security
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own sites" ON public.sites;
DROP POLICY IF EXISTS "Users can create own sites" ON public.sites;
DROP POLICY IF EXISTS "Users can update own sites" ON public.sites;
DROP POLICY IF EXISTS "Users can delete own sites" ON public.sites;

CREATE POLICY "Users can view own sites"
ON public.sites FOR SELECT
USING (client_id = get_client_id_from_auth() OR is_admin());

CREATE POLICY "Users can create own sites"
ON public.sites FOR INSERT
WITH CHECK (client_id = get_client_id_from_auth() OR is_admin());

CREATE POLICY "Users can update own sites"
ON public.sites FOR UPDATE
USING (client_id = get_client_id_from_auth() OR is_admin());

CREATE POLICY "Users can delete own sites"
ON public.sites FOR DELETE
USING (client_id = get_client_id_from_auth() OR is_admin());

-- 4. Update ALERTS & READINGS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can update own alerts" ON public.alerts;

CREATE POLICY "Users can view own alerts"
ON public.alerts FOR SELECT
USING (client_id = get_client_id_from_auth() OR is_admin());

CREATE POLICY "Users can update own alerts"
ON public.alerts FOR UPDATE
USING (client_id = get_client_id_from_auth() OR is_admin());

-- READINGS (Via Tank Ownership)
DROP POLICY IF EXISTS "Users can view own sensor readings" ON public.sensor_readings;
CREATE POLICY "Users can view own sensor readings"
ON public.sensor_readings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tanks
    WHERE tanks.id = sensor_readings.tank_id 
    AND (tanks.client_id = get_client_id_from_auth() OR is_admin())
  )
);
