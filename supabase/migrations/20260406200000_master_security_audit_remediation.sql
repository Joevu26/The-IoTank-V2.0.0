-- supabase/migrations/20260406200000_master_security_audit_remediation.sql
-- ============================================================================
-- REMEDIATION: Fixes for Phase 5 (Isolation), Phase 7 (Logic), and Phase 10 (Audit)
-- ============================================================================

-- 1. FIX Phase 5: Storage RLS Isolation (organizations bucket)
-- Previously, any user could overwrite any logo because it only checked the folder name.
-- We now enforce that the folder name (which should be the client_id/organization_id)
-- matches the user's actual client_id.

DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'profile-photos' AND
    (storage.foldername(name))[1] = 'organizations' AND
    (storage.foldername(name))[2] = (SELECT client_id::text FROM public.profiles WHERE supabase_uid = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Authenticated users can update own logos" ON storage.objects;
CREATE POLICY "Authenticated users can update own logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'profile-photos' AND
    (storage.foldername(name))[1] = 'organizations' AND
    (storage.foldername(name))[2] = (SELECT client_id::text FROM public.profiles WHERE supabase_uid = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Authenticated users can delete own logos" ON storage.objects;
CREATE POLICY "Authenticated users can delete own logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'profile-photos' AND
    (storage.foldername(name))[1] = 'organizations' AND
    (storage.foldername(name))[2] = (SELECT client_id::text FROM public.profiles WHERE supabase_uid = auth.uid() LIMIT 1)
);

-- 2. FIX Phase 7: Negative Volume Constraints
-- Enforce that tank levels and sensor readings can never be negative.

ALTER TABLE public.tanks DROP CONSTRAINT IF EXISTS check_tank_volume_non_negative;
ALTER TABLE public.tanks ADD CONSTRAINT check_tank_volume_non_negative CHECK (current_volume >= 0);

ALTER TABLE public.sensor_readings DROP CONSTRAINT IF EXISTS check_ambient_volume_non_negative;
ALTER TABLE public.sensor_readings ADD CONSTRAINT check_ambient_volume_non_negative CHECK (ambient_volume >= 0);

ALTER TABLE public.sensor_readings DROP CONSTRAINT IF EXISTS check_standard_volume_non_negative;
ALTER TABLE public.sensor_readings ADD CONSTRAINT check_standard_volume_non_negative CHECK (standard_volume >= 0);

-- 3. FIX Phase 7: get_user_client_id() nil UUID risk
-- Return NULL instead of the nil UUID to ensure RLS fails safely (default deny).

CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS UUID
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_client_id UUID;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  
  -- 1. Try matching by UID first
  SELECT client_id INTO v_client_id FROM public.profiles WHERE supabase_uid = v_uid LIMIT 1;
  
  -- 2. Fallback to email if UID not matched (securely using verified email check in AuthContext/repair_my_identity)
  IF v_client_id IS NULL THEN
    v_email := LOWER(auth.jwt()->>'email');
    SELECT client_id INTO v_client_id 
    FROM public.profiles 
    WHERE LOWER(email) = v_email 
    AND supabase_uid IS NULL 
    LIMIT 1;
  END IF;
  
  -- RETURN NULL if not found, NOT a nil UUID.
  RETURN v_client_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. FIX Phase 10: Audit Log Tamper Protection
-- Ensure that audit logs can NEVER be updated or deleted, even by authenticated users.

DROP POLICY IF EXISTS "Clients can update their own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Clients can delete their own audit logs" ON public.audit_logs;
-- No REPLACE here, we just ensure they don't exist. RLS is already ENABLED for audit_logs.

-- Ensure only system admins can view all logs, and clients can only view their own.
DROP POLICY IF EXISTS "Clients can view own audit logs" ON public.audit_logs;
CREATE POLICY "Clients can view own audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
    client_id = public.get_user_client_id() OR
    (SELECT role FROM public.system_users WHERE supabase_uid = auth.uid()) IN ('super_admin', 'admin_helper')
);
