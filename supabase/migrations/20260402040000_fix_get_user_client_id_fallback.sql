-- supabase/migrations/20260402040000_fix_get_user_client_id_fallback.sql
-- ============================================================================
-- FIX: Support email-based matching as a fallback for unlinked users in get_user_client_id
-- This ensures that RLS policies that rely on client_id can still function
-- for newly authenticated users whose supabase_uid hasn't been synced yet.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS UUID
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_client_id UUID;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  
  -- 1. Try matching by UID first
  SELECT client_id INTO v_client_id FROM public.profiles WHERE supabase_uid = v_uid LIMIT 1;
  
  -- 2. Fallback to email if UID not matched
  IF v_client_id IS NULL THEN
    v_email := LOWER(auth.jwt()->>'email');
    SELECT client_id INTO v_client_id 
    FROM public.profiles 
    WHERE LOWER(email) = v_email 
    AND supabase_uid IS NULL 
    LIMIT 1;
  END IF;
  
  RETURN v_client_id;
END;
$$ LANGUAGE plpgsql STABLE;
