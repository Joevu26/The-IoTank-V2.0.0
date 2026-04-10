-- supabase/migrations/20260405000008_restore_rls_integrity.sql
-- ============================================================================
-- RESTORE RLS INTEGRITY: Insert/Update/Delete missing from Identity Harmonization
-- ============================================================================

-- 1. TEAM MEMBER REQUESTS
-- ============================================================================
-- Ensure all capabilities exist for both system admins and clients.

-- Clients can insert requests for their own station
DROP POLICY IF EXISTS "client_can_insert_own_requests" ON public.team_member_requests;
CREATE POLICY "client_can_insert_own_requests" ON public.team_member_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        client_id = public.get_client_id_from_auth() OR public.is_admin()
    );

-- Active system users can update (approve/reject) all requests
DROP POLICY IF EXISTS "system_user_can_update_requests" ON public.team_member_requests;
CREATE POLICY "system_user_can_update_requests" ON public.team_member_requests
    FOR UPDATE TO authenticated
    USING (public.is_admin());

-- Active system users can delete requests
DROP POLICY IF EXISTS "system_user_can_delete_requests" ON public.team_member_requests;
CREATE POLICY "system_user_can_delete_requests" ON public.team_member_requests
    FOR DELETE TO authenticated
    USING (public.is_admin());


-- 2. DEVICES
-- ============================================================================
-- System Admins need full control over devices.

DROP POLICY IF EXISTS "System admins can manage devices" ON public.devices;
CREATE POLICY "System admins can manage devices"
  ON public.devices FOR ALL TO authenticated
  USING (public.is_admin());

-- 3. SITES
-- ============================================================================
-- System Admins need full control over sites.

DROP POLICY IF EXISTS "System admins can manage sites" ON public.sites;
CREATE POLICY "System admins can manage sites"
  ON public.sites FOR ALL TO authenticated
  USING (public.is_admin());

-- 4. CLIENT BILLING
-- ============================================================================
-- System Admins need full control over client billing records.

DROP POLICY IF EXISTS "System admins can manage client_billing" ON public.client_billing;
CREATE POLICY "System admins can manage client_billing"
  ON public.client_billing FOR ALL TO authenticated
  USING (public.is_admin());

-- Refresh cache
NOTIFY pgrst, 'reload schema';
