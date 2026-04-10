-- supabase/migrations/20260405000000_hardening_rls_and_security.sql
-- ============================================================================
-- SECURITY HARDENING: View Recreation, Function Search Paths, and RLS Policies
-- ============================================================================

-- 1. Fix SECURITY DEFINER View (Prevent RLS Bypass)
-- ============================================================================
DROP VIEW IF EXISTS public.tank_readings;
CREATE OR REPLACE VIEW public.tank_readings 
WITH (security_barrier = true, security_invoker = true)
AS SELECT * FROM public.sensor_readings;

-- 2. Fix Function Search Path (Prevent Hijacking)
-- ============================================================================
ALTER FUNCTION public.update_team_member_requests_updated_at() SET search_path = public;

-- 3. Row Level Security Policies
-- ============================================================================

-- Help ensure RLS is enabled on all target tables
ALTER TABLE public.analysis_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulatory_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_telemetry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_history ENABLE ROW LEVEL SECURITY;

-- FILE UPLOADS
DROP POLICY IF EXISTS "Users can manage their own file uploads" ON public.file_uploads;
CREATE POLICY "Users can manage their own file uploads"
ON public.file_uploads FOR ALL
USING (client_id = get_client_id_from_auth() OR is_admin())
WITH CHECK (client_id = get_client_id_from_auth() OR is_admin());

-- ANALYSIS HISTORY (Join via file_id)
DROP POLICY IF EXISTS "Users can view analysis for their files" ON public.analysis_history;
CREATE POLICY "Users can view analysis for their files"
ON public.analysis_history FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.file_uploads
        WHERE public.file_uploads.id = public.analysis_history.file_id
        AND (public.file_uploads.client_id = get_client_id_from_auth() OR is_admin())
    )
);

-- SHIFT CLOSURES (Update to native auth)
DROP POLICY IF EXISTS "Users can manage shifts in their organization" ON public.shift_closures;
CREATE POLICY "Users can manage shifts in their organization"
ON public.shift_closures FOR ALL
USING (client_id = get_client_id_from_auth() OR is_admin())
WITH CHECK (client_id = get_client_id_from_auth() OR is_admin());

-- SUPPORT TICKETS (Internal Feedback: Owners Insert/View only)
DROP POLICY IF EXISTS "Users can view and create their own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can view own tickets" ON public.support_tickets;
CREATE POLICY "Users can view own tickets"
ON public.support_tickets FOR SELECT
USING (client_id = get_client_id_from_auth() OR is_admin());

DROP POLICY IF EXISTS "Users can create tickets" ON public.support_tickets;
CREATE POLICY "Users can create tickets"
ON public.support_tickets FOR INSERT
WITH CHECK (client_id = get_client_id_from_auth() OR is_admin());

-- TELEMETRY HISTORY
DROP POLICY IF EXISTS "Users can view own telemetry history" ON public.telemetry_history;
CREATE POLICY "Users can view own telemetry history"
ON public.telemetry_history FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.devices
        WHERE public.devices.id = public.telemetry_history.device_id
        AND (public.devices.client_id = get_client_id_from_auth() OR is_admin())
    )
);

-- SECURITY TELEMETRY
DROP POLICY IF EXISTS "Users can view own security events" ON public.security_telemetry_events;
CREATE POLICY "Users can view own security events"
ON public.security_telemetry_events FOR SELECT
USING (client_id = get_client_id_from_auth() OR is_admin());

-- MARKET DATA & NOTICES (Internal Admin Use Only)
DROP POLICY IF EXISTS "Admins can view market data" ON public.raw_market_data;
CREATE POLICY "Admins can view market data"
ON public.raw_market_data FOR SELECT
USING (is_admin());

DROP POLICY IF EXISTS "Admins can view regulatory notices" ON public.regulatory_notices;
CREATE POLICY "Admins can view regulatory notices"
ON public.regulatory_notices FOR SELECT
USING (is_admin());

-- ============================================================================
-- SUMMARY OF CHANGES
-- ============================================================================
-- 1. Converted tank_readings to SECURITY INVOKER to respect RLS.
-- 2. Secured search_path for team member update function.
-- 3. Implemented Client-Organization isolation for File Uploads, Analysis, Shifts, and Tickets.
-- 4. Restricted Market Intelligence and Regulatory data to System Administrators only.
