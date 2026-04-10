-- supabase/migrations/20260324190000_fix_registration_visibility.sql

-- 1. Ensure 'anon' role can INSERT into pending_registrations
-- This is critical for the landing page form.
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can submit registrations" ON public.pending_registrations;
CREATE POLICY "Public can submit registrations" 
ON public.pending_registrations FOR INSERT 
TO anon 
WITH CHECK (status = 'pending');

-- 2. Ensure system admins can SELECT and UPDATE pending_registrations
-- We use is_system_admin(3) which means support staff and higher.
DROP POLICY IF EXISTS "System admins can view all pending registrations" ON public.pending_registrations;
CREATE POLICY "System admins can view all pending registrations"
ON public.pending_registrations FOR SELECT 
TO authenticated
USING (public.is_system_admin(3));

DROP POLICY IF EXISTS "System admins can update pending registrations" ON public.pending_registrations;
CREATE POLICY "System admins can update pending registrations"
ON public.pending_registrations FOR UPDATE
TO authenticated
USING (public.is_system_admin(3))
WITH CHECK (public.is_system_admin(3));

-- 3. Fix the "Chicken-and-Egg" problem for Super Admin linkage
-- Allow an authenticated user to UPDATE their own record in system_users 
-- EVEN IF the supabase_uid is currently NULL, provided the email matches.
DROP POLICY IF EXISTS "Users can link their own identity" ON public.system_users;
CREATE POLICY "Users can link their own identity"
ON public.system_users FOR UPDATE
TO authenticated
USING (email = auth.jwt()->>'email' OR supabase_uid = auth.uid())
WITH CHECK (email = auth.jwt()->>'email' OR supabase_uid = auth.uid());

-- 4. Grant explicit permissions to roles if not already present
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_registrations TO authenticated;
GRANT INSERT ON public.pending_registrations TO anon;
GRANT SELECT, UPDATE ON public.system_users TO authenticated;
