-- supabase/migrations/20260402010000_fix_handle_new_user_trigger.sql
-- ============================================================================
-- FIX: handle_new_user trigger crash on new user creation
-- The system_users table does NOT have a supabase_uid column.
-- The previous migration added a broken FK and the trigger tried to insert
-- into a non-existent column. This migration corrects both issues.
-- ============================================================================

-- 1. Drop the broken FK constraint on system_users (references non-existent column)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'system_users_supabase_uid_fkey'
    AND table_name = 'system_users'
  ) THEN
    ALTER TABLE public.system_users DROP CONSTRAINT system_users_supabase_uid_fkey;
    RAISE NOTICE 'Dropped broken system_users_supabase_uid_fkey constraint.';
  END IF;
END $$;

-- 2. Replace handle_new_user with a safe, column-aware version
-- This version only inserts into profiles (which DOES have supabase_uid).
-- It does NOT touch system_users (admin accounts are managed manually).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Safely insert a profile for the new user.
  -- Use ON CONFLICT to handle cases where a profile with this email already exists.
  INSERT INTO public.profiles (supabase_uid, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'viewer'  -- Default role; elevated roles are assigned by admins separately
  )
  ON CONFLICT (email) DO UPDATE SET
    supabase_uid = EXCLUDED.supabase_uid,
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log but don't crash — a broken profile trigger should never block auth user creation
    RAISE WARNING 'handle_new_user: Failed to create profile for %. Error: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 3. Ensure the trigger is attached correctly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
