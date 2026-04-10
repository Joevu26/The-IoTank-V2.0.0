-- supabase/migrations/20260403000000_fix_user_deletion_rls.sql
-- ============================================================================
-- FIX: Add DELETE policies for user management tables to allow user deletion
-- ============================================================================

-- 1. Add DELETE policy for profiles table
-- Only super admins can delete user profiles
DROP POLICY IF EXISTS "Super admins can delete user profiles" ON public.profiles;
CREATE POLICY "Super admins can delete user profiles"
    ON public.profiles FOR DELETE TO authenticated
    USING (public.is_system_admin('super_admin'));

-- 2. Add DELETE policy for system_users table
-- Only super admins can delete system user records
DROP POLICY IF EXISTS "Super admins can delete system users" ON public.system_users;
CREATE POLICY "Super admins can delete system users"
    ON public.system_users FOR DELETE TO authenticated
    USING (public.is_system_admin('super_admin'));

-- 3. Ensure all foreign key constraints have CASCADE for proper deletion
-- This is a safety net in case the previous migration didn't run properly
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    -- Check and fix profiles constraint
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.profiles'::regclass
          AND conname = 'profiles_supabase_uid_fkey'
          AND confdeltype != 'c' -- 'c' = CASCADE
    ) THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_supabase_uid_fkey;
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_supabase_uid_fkey
            FOREIGN KEY (supabase_uid)
            REFERENCES auth.users(id)
            ON DELETE CASCADE;
        RAISE NOTICE 'Fixed profiles constraint to CASCADE';
    END IF;

    -- Check and fix system_users constraint
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.system_users'::regclass
          AND conname = 'system_users_supabase_uid_fkey'
          AND confdeltype != 'c' -- 'c' = CASCADE
    ) THEN
        ALTER TABLE public.system_users DROP CONSTRAINT system_users_supabase_uid_fkey;
        ALTER TABLE public.system_users
            ADD CONSTRAINT system_users_supabase_uid_fkey
            FOREIGN KEY (supabase_uid)
            REFERENCES auth.users(id)
            ON DELETE CASCADE;
        RAISE NOTICE 'Fixed system_users constraint to CASCADE';
    END IF;
END $$;

-- 4. Create a helper function to safely delete users
-- This function can be called from the admin interface
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    result JSONB;
    user_email TEXT;
    user_role TEXT;
    deleted_count INTEGER := 0;
BEGIN
    -- Only super admins can delete users
    IF NOT public.is_system_admin('super_admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
    END IF;

    -- Get user info before deletion
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = target_user_id;

    IF user_email IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    -- Check if it's a system user
    SELECT role INTO user_role
    FROM public.system_users
    WHERE supabase_uid = target_user_id;

    -- Delete from auth.users (this will cascade to profiles and system_users)
    DELETE FROM auth.users WHERE id = target_user_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    IF deleted_count > 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', format('User %s (%s) deleted successfully', user_email, COALESCE(user_role, 'client user')),
            'user_email', user_email,
            'user_role', user_role
        );
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Failed to delete user');
    END IF;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users (RLS will check permissions)
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;