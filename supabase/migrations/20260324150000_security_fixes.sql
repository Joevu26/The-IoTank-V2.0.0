-- supabase/migrations/20260324150000_security_fixes.sql

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. CRITICAL: Fix Privilege Escalation in handle_new_user trigger
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- We completely ignore client-provided roles like 'system_admin' or 'owner'
  -- All new sign-ups default to a basic profile with 'viewer' role unless
  -- created by an existing admin process (which would handle roles securely elsewhere).
  
  INSERT INTO public.profiles (supabase_uid, email, display_name, role, firebase_uid)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 
    'viewer', -- Hardcoded to prevent privilege escalation
    'sb_' || NEW.id::TEXT
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. AUTHENTICATION: Secure Master Access Password RPCs
CREATE OR REPLACE FUNCTION public.update_master_password(new_password TEXT)
RETURNS VOID AS $$
DECLARE
  f_uid TEXT := public.firebase_uid();
  s_uid UUID := auth.uid();
BEGIN
  IF s_uid IS NULL AND f_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles 
  SET master_access_password = crypt(new_password, gen_salt('bf', 8)) 
  WHERE supabase_uid = s_uid OR firebase_uid = f_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.verify_master_password(test_password TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  f_uid TEXT := public.firebase_uid();
  s_uid UUID := auth.uid();
  hashed_pw TEXT;
BEGIN
  SELECT master_access_password INTO hashed_pw
  FROM public.profiles
  WHERE supabase_uid = s_uid OR firebase_uid = f_uid
  LIMIT 1;

  IF hashed_pw IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN hashed_pw = crypt(test_password, hashed_pw);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
