-- supabase/migrations/20260325164000_fix_invitations_and_auth_level.sql

-- 1. Update get_auth_level to recognize 'admin' role
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
  -- 1. Check system_users (Levels 1-4)
  SELECT role INTO sys_role 
  FROM system_users 
  WHERE supabase_uid = n_uid 
  AND is_active = TRUE
  LIMIT 1;
  
  IF sys_role IS NOT NULL THEN
    CASE sys_role
      WHEN 'super_admin' THEN RETURN 1;
      WHEN 'admin_helper' THEN RETURN 2;
      WHEN 'support_staff' THEN RETURN 3;
      WHEN 'analyst' THEN RETURN 4;
      ELSE RETURN 99;
    END CASE;
  END IF;

  -- 2. Check profiles (Levels 5-8)
  SELECT role INTO prof_role 
  FROM profiles 
  WHERE supabase_uid = n_uid
  LIMIT 1;
  
  IF prof_role IS NOT NULL THEN
    CASE prof_role
      WHEN 'owner' THEN RETURN 5;
      WHEN 'admin' THEN RETURN 5;
      WHEN 'supervisor' THEN RETURN 6;
      WHEN 'operator' THEN RETURN 7;
      WHEN 'viewer' THEN RETURN 8;
      ELSE RETURN 99;
    END CASE;
  END IF;

  RETURN 99;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Add client_id to invitation_requests for robust multi-tenancy
ALTER TABLE public.invitation_requests ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.client_billing(id) ON DELETE CASCADE;

-- Backfill client_id if invited_by_uid exists (from profiles)
UPDATE public.invitation_requests ir
SET client_id = p.client_id
FROM public.profiles p
WHERE ir.invited_by_uid = p.supabase_uid
AND ir.client_id IS NULL;

-- 3. Update RLS for invitation_requests
ALTER TABLE public.invitation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Inviters can view their own requests" ON public.invitation_requests;
CREATE POLICY "Inviters can view their own requests" 
ON public.invitation_requests FOR SELECT 
TO authenticated 
USING (client_id = public.get_user_client_id() OR public.is_system_admin(3) OR invited_by_uid = auth.uid());

DROP POLICY IF EXISTS "Station Owners can submit invite requests" ON public.invitation_requests;
CREATE POLICY "Station Owners can submit invite requests" 
ON public.invitation_requests FOR INSERT 
TO authenticated 
WITH CHECK (public.get_auth_level() <= 5 AND client_id = public.get_user_client_id());

DROP POLICY IF EXISTS "Owners can delete their invites" ON public.invitation_requests;
CREATE POLICY "Owners can delete their invites"
ON public.invitation_requests FOR DELETE
TO authenticated
USING (client_id = public.get_user_client_id() OR public.is_system_admin(3));
