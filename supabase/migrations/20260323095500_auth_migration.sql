-- supabase/migrations/20260322000000_auth_migration.sql
-- ============================================================================
-- AUTH MIGRATION: NATIVE SUPABASE AUTH SUPPORT
-- ============================================================================

-- 1. Add supabase_uid column to system_users and profiles to bridge the gap
ALTER TABLE IF EXISTS system_users ADD COLUMN IF NOT EXISTS supabase_uid UUID REFERENCES auth.users(id);
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS supabase_uid UUID REFERENCES auth.users(id);

-- 2. Update firebase_uid() function to prefer native Supabase Auth
DROP FUNCTION IF EXISTS public.firebase_uid() CASCADE;
CREATE OR REPLACE FUNCTION public.firebase_uid()
RETURNS TEXT AS $$
DECLARE
  native_uid UUID := auth.uid();
  f_uid TEXT;
BEGIN
  -- If native Supabase Auth is present, return the native UID as text
  IF native_uid IS NOT NULL THEN
    RETURN native_uid::TEXT;
  END IF;

  -- Fallback to JWT claims or headers (for backward compatibility during migration)
  RETURN NULLIF(
    COALESCE(
      current_setting('request.jwt.claims', true)::json->>'sub',
      current_setting('request.jwt.claims', true)::json->>'user_id',
      current_setting('request.headers', true)::json->>'x-firebase-uid'
    ),
    ''
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- 3. Update get_auth_level() to check both firebase_uid and supabase_uid
DROP FUNCTION IF EXISTS public.get_auth_level() CASCADE;
CREATE OR REPLACE FUNCTION public.get_auth_level()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  f_uid TEXT := public.firebase_uid();
  n_uid UUID := auth.uid();
  sys_role TEXT;
  prof_role TEXT;
BEGIN
  -- 1. Check if user is in system_users (Levels 1-4)
  -- Check by native UUID first, then fallback to firebase_uid
  SELECT role INTO sys_role 
  FROM system_users 
  WHERE (supabase_uid = n_uid OR firebase_uid = f_uid) 
  AND is_active = TRUE
  LIMIT 1;
  
  IF sys_role IS NOT NULL THEN
    CASE sys_role
      WHEN 'super_admin' THEN RETURN 1;
      WHEN 'admin_helper' THEN RETURN 2;
      WHEN 'support_staff' THEN RETURN 3;
      WHEN 'analyst' THEN RETURN 4;
      ELSE RETURN 99;
    END CASE;
  END IF;

  -- 2. Check if user is in profiles (Levels 5-7)
  SELECT role INTO prof_role 
  FROM profiles 
  WHERE (supabase_uid = n_uid OR firebase_uid = f_uid)
  LIMIT 1;
  
  IF prof_role IS NOT NULL THEN
    CASE prof_role
      WHEN 'owner' THEN RETURN 5;
      WHEN 'supervisor' THEN RETURN 6;
      WHEN 'operator' THEN RETURN 7;
      WHEN 'viewer' THEN RETURN 8;
      ELSE RETURN 99;
    END CASE;
  END IF;

  RETURN 99; -- Unknown/Public
END;
$$ LANGUAGE plpgsql;

-- 4. Automatically sync profiles on Supabase Signup
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.raw_user_meta_data->>'role') = 'system_admin' THEN
    INSERT INTO public.system_users (supabase_uid, email, full_name, role, firebase_uid)
    VALUES (
      NEW.id, 
      NEW.email, 
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 
      COALESCE(NEW.raw_user_meta_data->>'admin_role', 'support_staff'),
      'sb_' || NEW.id::TEXT -- Placeholder for firebase_uid compatibility
    );
  ELSE
    INSERT INTO public.profiles (supabase_uid, email, display_name, role, firebase_uid)
    VALUES (
      NEW.id, 
      NEW.email, 
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 
      COALESCE(NEW.raw_user_meta_data->>'role', 'viewer'),
      'sb_' || NEW.id::TEXT
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Helper function for the Super Admin to "link" existing Firebase accounts to Supabase
-- This is useful if the user logs in with the same email and we want to transfer their data.
CREATE OR REPLACE FUNCTION public.link_firebase_to_supabase(p_firebase_uid TEXT, p_supabase_uid UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Update system_users
  UPDATE public.system_users 
  SET supabase_uid = p_supabase_uid 
  WHERE firebase_uid = p_firebase_uid;
  
  -- Update profiles
  UPDATE public.profiles 
  SET supabase_uid = p_supabase_uid 
  WHERE firebase_uid = p_firebase_uid;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
