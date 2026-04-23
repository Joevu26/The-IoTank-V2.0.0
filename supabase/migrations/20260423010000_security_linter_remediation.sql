-- supabase/migrations/20260423010000_security_linter_remediation.sql
-- ============================================================================
-- SECURITY HARDENING: Addressing Supabase Linter Warnings
-- ============================================================================

-- 1. FIX: function_search_path_mutable for audit_trigger_handler
-- ----------------------------------------------------------------------------
-- We explicitly set the search_path to 'public' to prevent search_path hijacking.
ALTER FUNCTION public.audit_trigger_handler() SET search_path = public;


-- 2. FIX: rls_enabled_no_policy for system_settings
-- ----------------------------------------------------------------------------
-- Standardize access to the system_settings table.
-- We allow 'service_role' (internal) and administrative roles to manage settings.

DROP POLICY IF EXISTS "Service role has full access to system_settings" ON public.system_settings;
CREATE POLICY "Service role has full access to system_settings" 
ON public.system_settings 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view system_settings" ON public.system_settings;
CREATE POLICY "Admins can view system_settings" 
ON public.system_settings 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('super_admin', 'owner')
  )
);

DROP POLICY IF EXISTS "Admins can modify system_settings" ON public.system_settings;
CREATE POLICY "Admins can modify system_settings" 
ON public.system_settings 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('super_admin', 'owner')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('super_admin', 'owner')
  )
);

-- 3. ENFORCE RLS on unified_events (Audit Logs) just in case
ALTER TABLE public.unified_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.unified_events;
CREATE POLICY "Admins can view all audit logs" 
ON public.unified_events 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('super_admin', 'owner')
  )
);
