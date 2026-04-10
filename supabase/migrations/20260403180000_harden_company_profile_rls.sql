-- supabase/migrations/20260403180000_harden_company_profile_rls.sql
-- ============================================================================
-- SECURITY HARDENING: Restrict Company Profile Updates to Client Admins
-- ============================================================================

-- 1. Redefine the UPDATE policy for client_billing
-- This ensures that only users with auth_level <= 6 (Owners/Admins) can modify organization details.
-- It also enforces organization isolation by checking get_user_client_id().

DROP POLICY IF EXISTS "Users can update own billing record" ON public.client_billing;
DROP POLICY IF EXISTS "Owners can update organization billing" ON public.client_billing;
DROP POLICY IF EXISTS "Authorized admins can update organization billing" ON public.client_billing;

CREATE POLICY "Authorized admins can update organization billing"
  ON public.client_billing FOR UPDATE
  TO authenticated
  USING (
    (id = public.get_user_client_id() AND public.get_auth_level() <= 6)
    OR public.is_system_admin('support_staff') -- Allow system support staff to assist
  )
  WITH CHECK (
    (id = public.get_user_client_id() AND public.get_auth_level() <= 6)
    OR public.is_system_admin('support_staff')
  );

-- 2. Audit: Ensure logo_url changes are tracked if needed (optional, handled by triggers)
COMMENT ON POLICY "Authorized admins can update organization billing" ON public.client_billing IS 'Restricts organization profile and logo updates to Owners (Level 5) and Admins (Level 6) of that specific organization.';
