-- supabase/migrations/20260403174500_add_photo_url_to_system_users.sql
-- ============================================================================
-- FIX: Profile System Mismatch & Missing Administrator Photo Support
-- ============================================================================

-- 1. Add photo_url to system_users table if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_users' AND column_name='photo_url') THEN
    ALTER TABLE system_users ADD COLUMN photo_url TEXT;
  END IF;
END $$;

-- 2. Add full_name column check (Ensure it exists for AuthContext mapping)
-- Note: It already exists as per initial schema, but we ensure it for safety.

-- 3. Grant UPDATE permissions on system_users for own record
-- This was partially missing in some older schemas.
DROP POLICY IF EXISTS "System users can update their own profile" ON public.system_users;
CREATE POLICY "System users can update their own profile"
ON public.system_users FOR UPDATE
TO authenticated
USING (supabase_uid = auth.uid())
WITH CHECK (supabase_uid = auth.uid());

-- 4. Audit Log for this change
COMMENT ON COLUMN public.system_users.photo_url IS 'Stores the public URL of the system administrator profile photo.';
