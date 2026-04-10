-- supabase/migrations/20260402_cleanup_firebase_migration.sql
-- ============================================================================
-- CLEANUP: Consolidate Firebase migration remnants and simplify auth logic
-- ============================================================================

-- 1. Ensure system_users table has all necessary fields
ALTER TABLE public.system_users
ADD COLUMN IF NOT EXISTS supabase_uid UUID UNIQUE,
ADD COLUMN IF NOT EXISTS firebase_uid TEXT UNIQUE;

-- Create index for Supabase UID lookups
CREATE INDEX IF NOT EXISTS idx_system_users_supabase_uid ON public.system_users(supabase_uid);
CREATE INDEX IF NOT EXISTS idx_system_users_firebase_uid ON public.system_users(firebase_uid);

-- 2. Ensure profiles table has all necessary fields
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS supabase_uid UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS firebase_uid TEXT UNIQUE;

-- Create indexes for lookups
CREATE INDEX IF NOT EXISTS idx_profiles_supabase_uid ON public.profiles(supabase_uid);
CREATE INDEX IF NOT EXISTS idx_profiles_firebase_uid ON public.profiles(firebase_uid);

-- 3. Create a consolidated auth lookup function that uses Supabase UID first
DROP FUNCTION IF EXISTS public.get_user_client_id() CASCADE;
CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS UUID AS $$
DECLARE
    v_client_id UUID;
BEGIN
    -- Lookup by Supabase UID (primary method)
    SELECT client_id INTO v_client_id
    FROM public.profiles
    WHERE supabase_uid = auth.uid()
    LIMIT 1;
    
    IF v_client_id IS NOT NULL THEN
        RETURN v_client_id;
    END IF;
    
    -- Fallback: return NULL if not found (user is likely a system admin)
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth STABLE;

-- 4. Create simplified get_auth_level function
DROP FUNCTION IF EXISTS public.get_auth_level() CASCADE;
CREATE OR REPLACE FUNCTION public.get_auth_level()
RETURNS INTEGER AS $$
DECLARE
    v_role TEXT;
    v_level INTEGER;
BEGIN
    -- Check if system admin
    SELECT role INTO v_role
    FROM public.system_users
    WHERE supabase_uid = auth.uid()
    LIMIT 1;
    
    IF v_role IS NOT NULL THEN
        CASE v_role
            WHEN 'super_admin' THEN v_level := 1;
            WHEN 'admin_helper' THEN v_level := 2;
            WHEN 'support_staff' THEN v_level := 3;
            WHEN 'analyst' THEN v_level := 4;
            ELSE v_level := 8; -- default to viewer
        END CASE;
        RETURN v_level;
    END IF;
    
    -- Check if client user
    SELECT role INTO v_role
    FROM public.profiles
    WHERE supabase_uid = auth.uid()
    LIMIT 1;
    
    IF v_role IS NOT NULL THEN
        CASE v_role
            WHEN 'owner' THEN v_level := 5;
            WHEN 'supervisor' THEN v_level := 6;
            WHEN 'operator' THEN v_level := 7;
            ELSE v_level := 8; -- viewer
        END CASE;
        RETURN v_level;
    END IF;
    
    -- Not found
    RETURN 8;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth STABLE;

-- 5. Create utility function to get user record (system or client)
DROP FUNCTION IF EXISTS public.get_current_user_record() CASCADE;
CREATE OR REPLACE FUNCTION public.get_current_user_record()
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    full_name TEXT,
    role TEXT,
    is_system_admin BOOLEAN,
    client_id UUID
) AS $$
BEGIN
    -- Try to get system user record
    RETURN QUERY SELECT
        su.id as user_id,
        su.email,
        su.full_name,
        su.role,
        true as is_system_admin,
        NULL::UUID as client_id
    FROM public.system_users su
    WHERE su.supabase_uid = auth.uid()
    LIMIT 1;
    
    -- If not found, try client profile
    IF NOT FOUND THEN
        RETURN QUERY SELECT
            p.id as user_id,
            p.email,
            p.full_name,
            p.role,
            false as is_system_admin,
            p.client_id
        FROM public.profiles p
        WHERE p.supabase_uid = auth.uid()
        LIMIT 1;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 6. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_client_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_level() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_record() TO authenticated;
