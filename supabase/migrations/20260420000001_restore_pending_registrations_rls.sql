-- Recovery Migration: 20260420000000_restore_pending_registrations_rls.sql
-- Description: Restore RLS policies for pending_registrations that were accidentally 
-- dropped during the global function refactor (CASCADE) on get_auth_level/is_system_admin.

-- 1. Ensure RLS is enabled
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;

-- 2. Restore SELECT policy
-- Required for system admins (support_staff level 3 or higher)
DROP POLICY IF EXISTS "System admins can view all pending registrations" ON public.pending_registrations;
CREATE POLICY "System admins can view all pending registrations"
  ON public.pending_registrations FOR SELECT TO authenticated
  USING (public.is_system_admin(3));

-- 3. Restore UPDATE policy
-- Required for approving/rejecting registrations (support_staff level 3 or higher)
DROP POLICY IF EXISTS "System admins can update pending registrations" ON public.pending_registrations;
CREATE POLICY "System admins can update pending registrations"
  ON public.pending_registrations FOR UPDATE TO authenticated
  USING (public.is_system_admin(3))
  WITH CHECK (public.is_system_admin(3));

-- 4. Restore DELETE policy (Archive/Cleanup)
DROP POLICY IF EXISTS "System admins can delete pending registrations" ON public.pending_registrations;
CREATE POLICY "System admins can delete pending registrations"
  ON public.pending_registrations FOR DELETE TO authenticated
  USING (public.is_system_admin(2)); -- Restrict delete to admin_helper or super_admin

-- 5. Notify PostgREST
NOTIFY pgrst, 'reload schema';
