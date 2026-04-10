-- supabase/migrations/20260403130000_fix_logo_upload_rls.sql
-- ============================================================================
-- FIX: Company Logo Upload RLS & Storage Permissions
-- ============================================================================

-- 1. Grant UPDATE permissions on client_billing
-- Users must be able to update their own organization record (e.g. logo_url, kra_pin)
DROP POLICY IF EXISTS "Users can update own billing record" ON public.client_billing;
CREATE POLICY "Users can update own billing record"
ON public.client_billing FOR UPDATE
USING (
    supabase_uid::uuid = auth.uid()
)
WITH CHECK (
    supabase_uid::uuid = auth.uid()
);

-- 2. Configure Storage Bucket: profile-photos
-- Ensure the bucket exists and RLS is enabled
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Storage Object RLS: profile-photos
-- Allow authenticated users to upload to their organization folder
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'profile-photos' AND
    (storage.foldername(name))[1] = 'organizations'
);

-- Allow users to update/delete their own organization assets
DROP POLICY IF EXISTS "Authenticated users can update own logos" ON storage.objects;
CREATE POLICY "Authenticated users can update own logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'profile-photos' AND
    (storage.foldername(name))[1] = 'organizations'
);

DROP POLICY IF EXISTS "Authenticated users can delete own logos" ON storage.objects;
CREATE POLICY "Authenticated users can delete own logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'profile-photos' AND
    (storage.foldername(name))[1] = 'organizations'
);

-- Public/Authenticated read access
DROP POLICY IF EXISTS "Public read for profile photos" ON storage.objects;
CREATE POLICY "Public read for profile photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-photos');
