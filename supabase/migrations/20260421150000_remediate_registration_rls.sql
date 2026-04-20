-- supabase/migrations/20260421150000_remediate_registration_rls.sql
-- ============================================================================
-- REMEDIATION: Standardizing Pending Registrations RLS
-- Fixes "Permission Denied" errors by updating integer roles to text signatures.
-- ============================================================================

-- 1. Ensure RLS is active
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;

-- 2. Standardize SELECT Policy (support_staff+)
DROP POLICY IF EXISTS "System admins can view all pending registrations" ON public.pending_registrations;
CREATE POLICY "System admins can view all pending registrations"
  ON public.pending_registrations FOR SELECT TO authenticated
  USING (public.is_system_admin('support_staff'));

-- 3. Standardize UPDATE Policy (support_staff+)
DROP POLICY IF EXISTS "System admins can update pending registrations" ON public.pending_registrations;
CREATE POLICY "System admins can update pending registrations"
  ON public.pending_registrations FOR UPDATE TO authenticated
  USING (public.is_system_admin('support_staff'))
  WITH CHECK (public.is_system_admin('support_staff'));

-- 4. Standardize DELETE Policy (admin_helper+)
DROP POLICY IF EXISTS "System admins can delete pending registrations" ON public.pending_registrations;
CREATE POLICY "System admins can delete pending registrations"
  ON public.pending_registrations FOR DELETE TO authenticated
  USING (public.is_system_admin('admin_helper'));

-- 5. Restore/Harden Public INSERT (anon)
DROP POLICY IF EXISTS "Public can submit registrations" ON public.pending_registrations;
CREATE POLICY "Public can submit registrations" 
  ON public.pending_registrations FOR INSERT TO anon 
  WITH CHECK (status = 'pending');

-- 6. Grant sequence access if needed (usually handled by Supabase but good to ensure)
GRANT ALL ON TABLE public.pending_registrations TO service_role;
GRANT SELECT, UPDATE, DELETE ON TABLE public.pending_registrations TO authenticated;
GRANT INSERT ON TABLE public.pending_registrations TO anon;

-- FINAL NOTIFY
NOTIFY pgrst, 'reload schema';
