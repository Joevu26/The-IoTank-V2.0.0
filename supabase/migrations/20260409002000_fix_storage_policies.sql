-- Migration: Fix Storage RLS for Organizational Branding (V2)
-- Path: stations/${station_id}/logo.jpg
-- Path: users/${auth.uid()}/avatar.jpg

-- 1. Ensure the bucket exists and is public (for viewing)
-- Note: Manually ensure 'profile-photos' is created in the dashboard if this fails.

-- 2. Clean up old policies safely using standard SQL
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON storage.objects;
    DROP POLICY IF EXISTS "Users can manage their own avatar" ON storage.objects;
    DROP POLICY IF EXISTS "Users can manage their station branding" ON storage.objects;
    DROP POLICY IF EXISTS "System users can manage all branding" ON storage.objects;
END $$;

-- 3. ALLOW public viewing for all authenticated users
CREATE POLICY "Public profiles are viewable by everyone"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'profile-photos');

-- 4. ALLOW users to manage their OWN avatars
CREATE POLICY "Users can manage their own avatar"
ON storage.objects FOR ALL
TO authenticated
USING (
    bucket_id = 'profile-photos' 
    AND (storage.foldername(name))[1] = 'users' 
    AND (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'profile-photos' 
    AND (storage.foldername(name))[1] = 'users' 
    AND (storage.foldername(name))[2] = auth.uid()::text
);

-- 5. ALLOW admins/owners to manage their STATION branding
CREATE POLICY "Users can manage their station branding"
ON storage.objects FOR ALL
TO authenticated
USING (
    bucket_id = 'profile-photos' 
    AND (storage.foldername(name))[1] = 'stations' 
    AND (storage.foldername(name))[2] = (SELECT station_id::text FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1)
)
WITH CHECK (
    bucket_id = 'profile-photos' 
    AND (storage.foldername(name))[1] = 'stations' 
    AND (storage.foldername(name))[2] = (SELECT station_id::text FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1)
);

-- 6. FALLBACK for system users (Super Admins)
CREATE POLICY "System users can manage all branding"
ON storage.objects FOR ALL
TO authenticated
USING (
    bucket_id = 'profile-photos'
    AND EXISTS (SELECT 1 FROM public.system_users WHERE auth_user_id = auth.uid())
)
WITH CHECK (
    bucket_id = 'profile-photos'
    AND EXISTS (SELECT 1 FROM public.system_users WHERE auth_user_id = auth.uid())
);
