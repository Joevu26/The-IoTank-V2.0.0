-- supabase/migrations/20260317000008_profile_policies.sql

-- Add the missing INSERT policy for the profiles table.
-- Without this, new users cannot create a profile upon signing up.
-- We also allow 'dev-mock-%' UIDs to be inserted to support the local development App Check bypass.

CREATE POLICY "Users can insert their own profile" 
ON profiles 
FOR INSERT 
WITH CHECK (
  firebase_uid = public.firebase_uid() 
  OR firebase_uid LIKE 'dev-mock-%'
);
