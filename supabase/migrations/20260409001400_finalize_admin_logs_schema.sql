-- ============================================================================
-- FINAL STABILIZATION: admin_logs Schema Alignment
-- ============================================================================
-- Ensures all audit logging tables use the standardized 'auth_user_id' naming.
-- ============================================================================

DO $$ 
BEGIN
    -- 1. Standardize admin_logs column names
    -- If 'admin_auth_id' exists (from previous rename), rename it to 'auth_user_id'
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_logs' AND column_name = 'admin_auth_id') THEN
        ALTER TABLE public.admin_logs RENAME COLUMN admin_auth_id TO auth_user_id;
    END IF;

    -- If neither 'auth_user_id' nor 'admin_auth_id' exists, create it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_logs' AND column_name = 'auth_user_id') THEN
        ALTER TABLE public.admin_logs ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 2. Cleanup legacy column fragments if they somehow slipped through
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_logs' AND column_name = 'supabase_uid') THEN
        ALTER TABLE public.admin_logs DROP COLUMN supabase_uid;
    END IF;

    -- 3. Ensure system_user_id is properly linked
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_logs' AND column_name = 'system_user_id') THEN
        ALTER TABLE public.admin_logs ADD COLUMN system_user_id UUID REFERENCES public.system_users(id) ON DELETE SET NULL;
    END IF;

END $$;

-- 4. Re-Verify RLS and Permissions
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System admins can view all admin logs" ON public.admin_logs;
CREATE POLICY "System admins can view all admin logs"
    ON public.admin_logs FOR SELECT
    TO authenticated
    USING (public.is_system_admin('support_staff'));

-- 5. RELOAD: PostgREST Schema
NOTIFY pgrst, 'reload schema';
