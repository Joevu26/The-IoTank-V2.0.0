-- supabase/migrations/20260324180000_enhance_audit_logs.sql

-- 1. ADD COLUMNS TO audit_logs FOR SNAPSHOTS
ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS changes_made JSONB,
ADD COLUMN IF NOT EXISTS before_values JSONB,
ADD COLUMN IF NOT EXISTS after_values JSONB;

-- 2. ENSURE RLS ALLOWS OWNERS (Level 5) and SUPERVISORS (Level 6) TO READ THEIR OWN ORG LOGS
-- The existing policy in security_hardening.sql might already cover this if audit_logs is in the loop,
-- but we need to ensure it's specifically for their client_id.

DROP POLICY IF EXISTS "Tenant isolation" ON public.audit_logs;
CREATE POLICY "Tenant isolation" ON public.audit_logs 
FOR SELECT 
TO authenticated 
USING (client_id = public.get_user_client_id() OR public.is_system_admin(3));

-- 3. ALLOW WORKERS (Level 7) TO INSERT LOGS
-- Workers must be able to record their own actions.
DROP POLICY IF EXISTS "Workers can insert logs" ON public.audit_logs;
CREATE POLICY "Workers can insert logs" ON public.audit_logs 
FOR INSERT 
TO authenticated 
WITH CHECK (client_id = public.get_user_client_id());

-- 4. GRANT PERMISSIONS
GRANT ALL ON TABLE public.audit_logs TO authenticated;
