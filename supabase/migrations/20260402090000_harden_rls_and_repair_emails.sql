-- supabase/migrations/20260402090000_harden_rls_and_repair_emails.sql
-- ============================================================================
-- FIX: Sanitize emails and further harden RLS for identity discovery
-- ============================================================================

-- 1. Sanitize existing emails (Remove whitespace and lowercase)
UPDATE public.profiles SET email = LOWER(TRIM(email));
UPDATE public.system_users SET email = LOWER(TRIM(email));

-- 2. Harden Profiles RLS
DROP POLICY IF EXISTS "Users can see their own profile" ON public.profiles;
CREATE POLICY "Users can see their own profile"
    ON public.profiles FOR SELECT TO authenticated
    USING (
        supabase_uid::uuid = auth.uid()::uuid
        OR (supabase_uid IS NULL AND LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt() ->> 'email')))
        OR public.is_system_admin('analyst')
    );

DROP POLICY IF EXISTS "Users can link their own profile" ON public.profiles;
CREATE POLICY "Users can link their own profile"
    ON public.profiles FOR UPDATE TO authenticated
    USING (
        (supabase_uid IS NULL AND LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt() ->> 'email')))
    )
    WITH CHECK (
        (supabase_uid::uuid = auth.uid()::uuid AND LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt() ->> 'email')))
    );

-- 3. Harden System Users RLS
DROP POLICY IF EXISTS "System users can read their own profile" ON public.system_users;
CREATE POLICY "System users can read their own profile"
    ON public.system_users FOR SELECT TO authenticated
    USING (
        supabase_uid::uuid = auth.uid()::uuid
        OR (supabase_uid IS NULL AND LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt() ->> 'email')))
        OR public.is_system_admin('super_admin')
    );

DROP POLICY IF EXISTS "System users can link their own record" ON public.system_users;
CREATE POLICY "System users can link their own record"
    ON public.system_users FOR UPDATE TO authenticated
    USING (
        (supabase_uid IS NULL AND LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt() ->> 'email')))
    )
    WITH CHECK (
        (supabase_uid::uuid = auth.uid()::uuid AND LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt() ->> 'email')))
    );

-- 4. Create a repair function that can be called via RPC to force-link an account
-- This is a fallback if the auto-sync in AuthContext fails due to RLS edge cases.
CREATE OR REPLACE FUNCTION public.repair_my_identity()
RETURNS BOOLEAN AS $$
DECLARE
    v_email TEXT;
    v_uid UUID;
    v_updated BOOLEAN := FALSE;
BEGIN
    v_uid := auth.uid();
    v_email := LOWER(TRIM(auth.jwt() ->> 'email'));
    
    IF v_uid IS NULL OR v_email IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Try to link profile
    UPDATE public.profiles 
    SET supabase_uid = v_uid
    WHERE supabase_uid IS NULL AND LOWER(TRIM(email)) = v_email;
    
    IF FOUND THEN v_updated := TRUE; END IF;

    -- Try to link system user
    UPDATE public.system_users 
    SET supabase_uid = v_uid
    WHERE supabase_uid IS NULL AND LOWER(TRIM(email)) = v_email;

    IF FOUND THEN v_updated := TRUE; END IF;

    RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
