-- supabase/migrations/20260402050000_diagnose_user_joseph.sql
-- ============================================================================
-- DIAGNOSTICS: Check state of josephvundi26@gmail.com
-- ============================================================================

DO $$
DECLARE
    v_email TEXT := 'josephvundi26@gmail.com';
    v_auth_uid UUID;
    v_profile_uid UUID;
    v_sys_user_uid UUID;
    v_profile_id UUID;
    v_sys_user_id UUID;
    v_profile_email TEXT;
    v_sys_user_email TEXT;
BEGIN
    -- 1. Check auth.users
    SELECT id INTO v_auth_uid FROM auth.users WHERE email = v_email;
    RAISE NOTICE 'Auth UID for %: %', v_email, v_auth_uid;

    -- 2. Check profiles
    SELECT id, supabase_uid, email INTO v_profile_id, v_profile_uid, v_profile_email 
    FROM public.profiles 
    WHERE LOWER(email) = LOWER(v_email);
    RAISE NOTICE 'Profile: ID=%, supabase_uid=%, email=%', v_profile_id, v_profile_uid, v_profile_email;

    -- 3. Check system_users
    SELECT id, supabase_uid, email INTO v_sys_user_id, v_sys_user_uid, v_sys_user_email 
    FROM public.system_users 
    WHERE LOWER(email) = LOWER(v_email);
    RAISE NOTICE 'System User: ID=%, supabase_uid=%, email=%', v_sys_user_id, v_sys_user_uid, v_sys_user_email;

    -- 4. Check get_auth_level
    -- We can't easily call get_auth_level here since it uses auth.uid(), 
    -- but we can simulate what it would do.
END;
$$;
