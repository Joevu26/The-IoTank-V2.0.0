-- supabase/migrations/20260319000007_fix_profile_rbac_visibility.sql
-- ============================================================================
-- FIX: Profiles RLS Visibility
-- Station Owners (Level 5) need to be able to read their own profile to 
-- correctly identify their role and access high-privilege settings tabs.
-- ============================================================================

-- 1. Ensure RLS is enabled
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies if they exist (cleanup)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 3. Create SELECT policy for authenticated users to see THEIR OWN profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (firebase_uid = public.firebase_uid());

-- 4. Create UPDATE policy for users to manage their own profile details
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (firebase_uid = public.firebase_uid())
WITH CHECK (firebase_uid = public.firebase_uid());

-- 5. System Admins still need to see all profiles
DROP POLICY IF EXISTS "System admins can view all profiles" ON public.profiles;
CREATE POLICY "System admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (public.get_auth_level() <= 4);

-- 6. Direct INSERT is already handled in 20260317000008_profile_policies.sql
-- But we ensure it's robust here too.
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated 
WITH CHECK (firebase_uid = public.firebase_uid() OR firebase_uid LIKE 'dev-mock-%');

-- 7. Grant permissions explicitly
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
