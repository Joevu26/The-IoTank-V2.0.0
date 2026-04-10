-- supabase/migrations/20260326000000_audit_remediation.sql
-- ============================================================================
-- AUDIT REMEDIATION: RLS Hardening & Data Integrity
-- ============================================================================

-- 1. HARDEN get_user_client_id()
-- Prevent the "NULL match" loophole by returning a non-existent UUID string 
-- if no profile is found.
CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS UUID
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_client_id UUID;
BEGIN
  SELECT client_id INTO v_client_id FROM profiles WHERE supabase_uid = auth.uid() LIMIT 1;
  -- If NULL, return a "Nil UUID" which will not match any real organization.
  RETURN COALESCE(v_client_id, '00000000-0000-0000-0000-000000000000'::UUID);
END;
$$ LANGUAGE plpgsql STABLE;


-- 2. TIGHTEN INVITATION REQUESTS
-- Ensure 'client_id' is never NULL on insert and matches the user's org.
ALTER TABLE public.invitation_requests ALTER COLUMN client_id SET NOT NULL;

DROP POLICY IF EXISTS "Inviters can view their own requests" ON public.invitation_requests;
CREATE POLICY "Inviters can view their own requests" 
ON public.invitation_requests FOR SELECT 
TO authenticated 
USING (
    client_id = public.get_user_client_id() 
    OR public.is_system_admin(3)
);


-- 3. DATA INTEGRITY: TANK CONSTRAINTS
-- Prevent logical injection (negative dimensions) at the database layer.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_tank_dimensions'
      AND conrelid = 'public.tanks'::regclass
  ) THEN
    ALTER TABLE public.tanks
    ADD CONSTRAINT check_tank_dimensions
    CHECK (tank_capacity >= 0 AND tank_height >= 0);
  END IF;
END
$$;


-- 4. PENDING REGISTRATIONS HARDENING
-- Prevent anyone from updating a registration after it's been submitted, 
-- unless they are a system admin.
DROP POLICY IF EXISTS "System admins can update pending registrations" ON public.pending_registrations;
CREATE POLICY "System admins can update pending registrations"
ON public.pending_registrations FOR UPDATE
TO authenticated
USING (public.is_system_admin(3))
WITH CHECK (public.is_system_admin(3));


-- 5. AUDIT LOG ENHANCEMENT
-- Ensure system_user_id is correctly linked if not provided.
CREATE OR REPLACE FUNCTION public.stamp_admin_log_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.system_user_id IS NULL THEN
    SELECT id INTO NEW.system_user_id FROM system_users WHERE supabase_uid = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_stamp_admin_log_user ON public.admin_logs;
CREATE TRIGGER tr_stamp_admin_log_user
  BEFORE INSERT ON public.admin_logs
  FOR EACH ROW EXECUTE FUNCTION public.stamp_admin_log_user();
