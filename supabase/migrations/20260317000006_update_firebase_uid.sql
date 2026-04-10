-- supabase/migrations/20260317000006_update_firebase_uid.sql

-- Helper function to get current user's firebase_uid from metadata
-- Update: Support custom header 'x-firebase-uid' to bypass 401 signature validation 
-- when using Firebase Authentication alongside Supabase without Third-Party JWTs.
CREATE OR REPLACE FUNCTION public.firebase_uid() 
RETURNS TEXT AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claims', true)::json->>'sub', ''),
    current_setting('request.headers', true)::json->>'x-firebase-uid'
  );
$$ LANGUAGE SQL STABLE;
