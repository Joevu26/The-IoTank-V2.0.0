-- supabase/migrations/20260409000600_auth_lookup_helper.sql
-- ============================================================================
-- 1. AUTH LOOKUP HELPER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(p_email TEXT)
RETURNS UUID
SECURITY DEFINER
SET search_path = auth
AS $$
BEGIN
  RETURN (SELECT id FROM auth.users WHERE email = p_email LIMIT 1);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_auth_user_id_by_email IS 'Returns user ID for a given email from auth.users. Requires service role or security definer.';
