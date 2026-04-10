-- supabase/migrations/20260321000003_fix_firebase_uid_resolver.sql
-- ============================================================================
-- FIX: Restore x-firebase-uid header fallback in firebase_uid()
-- Some components (like the Super Admin portal) send a custom header for RLS.
-- The previous version only looked at JWT claims, leading to RLS failures if 
-- the JWT parsing was bypassed or if the header was preferred.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.firebase_uid()
RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(
    COALESCE(
      current_setting('request.jwt.claims', true)::json->>'sub',
      current_setting('request.jwt.claims', true)::json->>'user_id',
      current_setting('request.headers', true)::json->>'x-firebase-uid'
    ),
    ''
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
