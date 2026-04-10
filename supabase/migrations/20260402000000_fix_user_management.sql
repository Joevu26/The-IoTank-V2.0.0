-- supabase/migrations/20260402000000_fix_user_management.sql
-- ============================================================================
-- FIX: USER MANAGEMENT - CASCADE DELETION & ROBUST PROFILE SYNC
-- ============================================================================

-- 1. FIX DELETION: Add ON DELETE CASCADE to all references of auth.users
-- This ensures when a user is deleted from the dashboard, their profile and 
-- system_users records are also removed, preventing "Database error deleting user".
DO $$ 
BEGIN
  -- Profiles Relationship
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'profiles_supabase_uid_fkey') THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_supabase_uid_fkey;
  END IF;
  ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_supabase_uid_fkey 
    FOREIGN KEY (supabase_uid) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

  -- System Users Relationship
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'system_users_supabase_uid_fkey') THEN
    ALTER TABLE public.system_users DROP CONSTRAINT system_users_supabase_uid_fkey;
  END IF;
  ALTER TABLE public.system_users 
    ADD CONSTRAINT system_users_supabase_uid_fkey 
    FOREIGN KEY (supabase_uid) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

  -- Invitation Requests Relationship
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'invitation_requests_invited_by_uid_fkey') THEN
    ALTER TABLE public.invitation_requests DROP CONSTRAINT invitation_requests_invited_by_uid_fkey;
  END IF;
  ALTER TABLE public.invitation_requests 
    ADD CONSTRAINT invitation_requests_invited_by_uid_fkey 
    FOREIGN KEY (invited_by_uid) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;
END $$;

-- 2. HARDEN handle_new_user()
-- We use an UPSERT strategy to ensure that if a profile already existed (e.g. legacy data)
-- it is updated with the correct supabase_uid and linked to Auth correctly.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- We use ON CONFLICT because legacy profiles might already exist by email
  INSERT INTO public.profiles (supabase_uid, email, display_name, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')
  )
  ON CONFLICT (email) DO UPDATE SET
    supabase_uid = EXCLUDED.supabase_uid,
    updated_at = NOW();

  -- If the user signed up as a system_admin (via raw_user_metadata), link them to system_users
  IF (NEW.raw_user_meta_data->>'role') = 'super_admin' OR (NEW.raw_user_meta_data->>'role') = 'support_staff' THEN
    INSERT INTO public.system_users (supabase_uid, email, full_name, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      COALESCE(NEW.raw_user_meta_data->>'role', 'support_staff')
    )
    ON CONFLICT (email) DO UPDATE SET
      supabase_uid = EXCLUDED.supabase_uid,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 3. FIX get_user_client_id()
-- Ensure it returns NULL gracefully if no profile exists, instead of potentially breaking RLS checks.
CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS UUID
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_client_id UUID;
BEGIN
  SELECT client_id INTO v_client_id FROM public.profiles WHERE supabase_uid = auth.uid() LIMIT 1;
  RETURN v_client_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. FIX INVITATION RLS
-- Some users might have difficulty adding team members if they aren't Level 5.
-- We ensure the check is explicit and robust.
DROP POLICY IF EXISTS "Station Owners can submit invite requests" ON public.invitation_requests;
CREATE POLICY "Station Owners can submit invite requests" 
ON public.invitation_requests FOR INSERT 
TO authenticated 
WITH CHECK (
  (public.get_auth_level() <= 5) -- Admin or owner
  AND (client_id = public.get_user_client_id()) -- Must be within their own org
);

-- 5. FINAL CLEANUP: Ensure firebase_uid columns are truly gone to prevent function failure
-- Sometimes a migration might have skipped a table due to locks.
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT table_name
               FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND column_name = 'firebase_uid'
    LOOP
        EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS firebase_uid CASCADE', t);
    END LOOP;
END $$;
