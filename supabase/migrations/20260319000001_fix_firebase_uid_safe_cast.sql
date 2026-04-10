-- supabase/migrations/20260319000001_fix_firebase_uid_safe_cast.sql
-- ============================================================================
-- FIX: Make firebase_uid() safe against 500 errors caused by invalid JSON cast.
--
-- The previous version used `current_setting(...)::json` which throws a 500
-- when Supabase cannot parse Firebase JWTs (i.e. when Firebase is NOT configured
-- as a Third-Party JWT provider in Supabase settings). 
--
-- This version uses a safe EXCEPTION handler and also reads the x-firebase-uid
-- plain header as a reliable fallback set by the frontend Supabase client.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.firebase_uid()
RETURNS TEXT AS $$
DECLARE
  v_claims TEXT;
  v_uid TEXT;
BEGIN
  -- Attempt to extract from JWT 'sub' claim
  BEGIN
    v_claims := current_setting('request.jwt.claims', true);
    IF v_claims IS NOT NULL AND v_claims <> '' THEN
      v_uid := v_claims::json->>'sub';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- JWT parsing failed (e.g. Firebase JWT not configured as third-party provider)
    -- Fall through to the header fallback below.
    v_uid := NULL;
  END;

  -- Fallback: read plain x-firebase-uid header set by the frontend client
  IF v_uid IS NULL OR v_uid = '' THEN
    BEGIN
      v_uid := current_setting('request.headers', true)::json->>'x-firebase-uid';
    EXCEPTION WHEN OTHERS THEN
      v_uid := NULL;
    END;
  END IF;

  RETURN v_uid;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
