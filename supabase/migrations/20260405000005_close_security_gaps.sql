-- supabase/migrations/20260405000005_close_security_gaps.sql
-- ============================================================================
-- SECURITY HARDENING: Closing RLS gaps for reports and logs
-- ============================================================================

-- 1. REPORTS: Tenant isolation
-- ============================================================================
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation for reports" ON public.reports;
CREATE POLICY "Tenant isolation for reports"
ON public.reports FOR ALL TO authenticated
USING (client_id = public.get_client_id_from_auth() OR public.is_admin());


-- 2. EVENT_LOGS: Tenant isolation
-- ============================================================================
ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation for event_logs" ON public.event_logs;
CREATE POLICY "Tenant isolation for event_logs"
ON public.event_logs FOR SELECT TO authenticated
USING (client_id = public.get_client_id_from_auth() OR public.is_admin());


-- 3. USAGE_LOGS: Tenant isolation
-- ============================================================================
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation for usage_logs" ON public.usage_logs;
CREATE POLICY "Tenant isolation for usage_logs"
ON public.usage_logs FOR SELECT TO authenticated
USING (client_id = public.get_client_id_from_auth() OR public.is_admin());


-- 4. USER_PREFERENCES: Self-service isolation
-- ============================================================================
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own preferences" ON public.user_preferences;
CREATE POLICY "Users manage own preferences"
ON public.user_preferences FOR ALL TO authenticated
USING (user_id IN (SELECT id FROM public.profiles WHERE supabase_uid = auth.uid()));


-- Refresh the cache
NOTIFY pgrst, 'reload schema';
