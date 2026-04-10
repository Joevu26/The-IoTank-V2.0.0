-- supabase/migrations/20260409000400_access_request_visibility_fix.sql

-- ============================================================================
-- 1. Schema Stabilization: Standardize 'auth_user_id' across relevant tables
-- ============================================================================
DO $$ 
BEGIN
    -- profiles: Rename supabase_uid to auth_user_id if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'supabase_uid') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'auth_user_id') THEN
        ALTER TABLE public.profiles RENAME COLUMN supabase_uid TO auth_user_id;
    END IF;

    -- team_member_requests: Rename requested_by to auth_user_id if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_member_requests' AND column_name = 'requested_by') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_member_requests' AND column_name = 'auth_user_id') THEN
        ALTER TABLE public.team_member_requests RENAME COLUMN requested_by TO auth_user_id;
    END IF;

    -- If neither exists (unlikely given prev migrations), add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_member_requests' AND column_name = 'auth_user_id') THEN
        ALTER TABLE public.team_member_requests ADD COLUMN auth_user_id UUID;
    END IF;

    -- admin_logs: Consolidate legacy admin/supabase UIDs to 'auth_user_id'
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_logs' AND column_name = 'supabase_uid') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_logs' AND column_name = 'auth_user_id') THEN
        ALTER TABLE public.admin_logs RENAME COLUMN supabase_uid TO auth_user_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_logs' AND column_name = 'admin_auth_id') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_logs' AND column_name = 'auth_user_id') THEN
        ALTER TABLE public.admin_logs RENAME COLUMN admin_auth_id TO auth_user_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_logs' AND column_name = 'auth_user_id') THEN
        ALTER TABLE public.admin_logs ADD COLUMN auth_user_id UUID;
    END IF;
END $$;

-- ============================================================================
-- 2. Identity Linkage Helper Trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_system_user_identity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.auth_user_id IS NOT NULL THEN
    UPDATE public.system_users
    SET auth_user_id = NEW.auth_user_id,
        updated_at = NOW()
    WHERE lower(email) = lower(NEW.email)
      AND auth_user_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_system_identity ON public.profiles;
CREATE TRIGGER trg_sync_system_identity
  AFTER INSERT OR UPDATE OF auth_user_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_system_user_identity();

-- ============================================================================
-- 3. Policy Recalibration
-- ============================================================================

-- team_member_requests
DROP POLICY IF EXISTS "Users can insert own team requests" ON public.team_member_requests;
CREATE POLICY "Users can insert own team requests"
ON public.team_member_requests FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own team requests" ON public.team_member_requests;
CREATE POLICY "Users can view own team requests"
ON public.team_member_requests FOR SELECT
TO authenticated
USING (
    station_id = public.get_station_id_from_auth() 
    OR auth_user_id = auth.uid()
    OR public.is_system_admin(3)
);

-- pending_registrations
DROP POLICY IF EXISTS "System admins can view all pending registrations" ON public.pending_registrations;
CREATE POLICY "System admins can view all pending registrations"
ON public.pending_registrations FOR SELECT
TO authenticated
USING (public.is_system_admin(3));

-- ============================================================================
-- 4. Permissions & Identity Repair
-- ============================================================================
GRANT ALL ON public.team_member_requests TO authenticated;
GRANT ALL ON public.pending_registrations TO authenticated;

-- Force link for existing profiles to system users
DO $$
BEGIN
  UPDATE public.system_users su
  SET auth_user_id = p.auth_user_id
  FROM public.profiles p
  WHERE lower(su.email) = lower(p.email)
    AND su.auth_user_id IS NULL
    AND p.auth_user_id IS NOT NULL;
END $$;
