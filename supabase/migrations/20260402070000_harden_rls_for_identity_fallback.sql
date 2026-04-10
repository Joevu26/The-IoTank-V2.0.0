-- supabase/migrations/20260402070000_harden_rls_for_identity_fallback.sql
-- ============================================================================
-- FIX: Allow users to see and link their own records by email if UID is NULL
-- ============================================================================

-- 1. Profiles Table RLS Update
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see their own profile" ON public.profiles;
CREATE POLICY "Users can see their own profile"
    ON public.profiles FOR SELECT TO authenticated
    USING (
        supabase_uid::uuid = auth.uid()::uuid
        OR (supabase_uid IS NULL AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
        OR public.is_system_admin('analyst')
    );

DROP POLICY IF EXISTS "Users can link their own profile" ON public.profiles;
CREATE POLICY "Users can link their own profile"
    ON public.profiles FOR UPDATE TO authenticated
    USING (
        (supabase_uid IS NULL AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
    )
    WITH CHECK (
        (supabase_uid::uuid = auth.uid()::uuid AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
    );

-- 2. System Users Table RLS Update
ALTER TABLE public.system_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System users can read their own profile" ON public.system_users;
CREATE POLICY "System users can read their own profile"
    ON public.system_users FOR SELECT TO authenticated
    USING (
        supabase_uid::uuid = auth.uid()::uuid
        OR (supabase_uid IS NULL AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
        OR public.is_system_admin('super_admin')
    );

DROP POLICY IF EXISTS "System users can link their own record" ON public.system_users;
CREATE POLICY "System users can link their own record"
    ON public.system_users FOR UPDATE TO authenticated
    USING (
        (supabase_uid IS NULL AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
    )
    WITH CHECK (
        (supabase_uid::uuid = auth.uid()::uuid AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
    );

-- 3. Diagnostics: Add more information to get_auth_level to help troubleshoot
CREATE OR REPLACE FUNCTION public.get_auth_level()
RETURNS INTEGER AS $$
DECLARE
    v_uid UUID;
    v_role TEXT;
    v_is_active BOOLEAN;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN RETURN 0; END IF;

    -- Check system_users first (Admins)
    SELECT role, is_active INTO v_role, v_is_active
    FROM public.system_users
    WHERE supabase_uid::uuid = v_uid::uuid;

    IF FOUND THEN
        IF NOT v_is_active THEN RETURN 0; END IF;
        RETURN CASE v_role
            WHEN 'super_admin'   THEN 1
            WHEN 'admin_helper'  THEN 2
            WHEN 'support_staff' THEN 3
            WHEN 'analyst'       THEN 4
            ELSE 5 -- Default for system user
        END;
    END IF;

    -- Check regular profiles (Clients)
    SELECT role INTO v_role
    FROM public.profiles
    WHERE supabase_uid::uuid = v_uid::uuid;

    IF FOUND THEN
        RETURN CASE v_role
            WHEN 'admin'      THEN 6
            WHEN 'supervisor' THEN 7
            WHEN 'viewer'     THEN 8
            ELSE 9 -- Default for profile user
        END;
    END IF;

    -- Check if record exists but is unlinked (For diagnostics via RPC)
    IF EXISTS (SELECT 1 FROM public.system_users WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email') AND supabase_uid IS NULL) THEN
        RETURN -1; -- Signal: Record exists but unlinked in system_users
    END IF;

    IF EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email') AND supabase_uid IS NULL) THEN
        RETURN -2; -- Signal: Record exists but unlinked in profiles
    END IF;

    RETURN 0; -- Unknown/No record
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
