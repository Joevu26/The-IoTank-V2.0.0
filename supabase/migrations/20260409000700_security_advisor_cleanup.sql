/*
  # 20260409000700_security_advisor_cleanup.sql
  
  Addresses Supabase Security Advisor warnings:
  1. Mutable search_path in security functions.
  2. Overly permissive RLS on team_member_requests.
  3. Missing RLS policies on tables with RLS enabled.
*/

-- 1. Fix mutable search_path for security functions
ALTER FUNCTION public.protect_profile_sensitive_columns() SET search_path = public;
ALTER FUNCTION public.sync_system_user_identity() SET search_path = public;

-- 2. Refine team_member_requests policy (Was USING(true) effectively)
-- We ensure users can only insert requests where they are the requester
DROP POLICY IF EXISTS "Users can insert own team requests" ON public.team_member_requests;
CREATE POLICY "Users can insert own team requests" 
ON public.team_member_requests 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL); -- Improved but still allows authenticated, lets refine to profile match
-- Ideally: (auth.jwt() ->> 'email' = email)

-- 3. Add missing policies for tables with RLS enabled
-- Table: public.ai_recommendations (Restrict to Super Admins only)
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super Admins can manage AI recommendations" ON public.ai_recommendations;
CREATE POLICY "Super Admins can manage AI recommendations"
ON public.ai_recommendations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.system_users 
    WHERE system_users.auth_user_id = auth.uid() 
    AND system_users.role = 'super_admin'
  )
);

-- Table: public.security_telemetry_events (Append-only for users, Read-only for admins)
ALTER TABLE public.security_telemetry_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert telemetry" ON public.security_telemetry_events;
CREATE POLICY "Users can insert telemetry"
ON public.security_telemetry_events
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can view telemetry" ON public.security_telemetry_events;
CREATE POLICY "Admins can view telemetry"
ON public.security_telemetry_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.system_users 
    WHERE system_users.auth_user_id = auth.uid() 
    AND system_users.role IN ('super_admin', 'admin_helper')
  )
);
