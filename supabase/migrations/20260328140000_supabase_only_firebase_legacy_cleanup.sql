-- supabase/migrations/20260328140000_supabase_only_firebase_legacy_cleanup.sql
-- ============================================================================
-- Post-migration cleanup: remove runtime dependencies on legacy Firebase columns
-- and confusing "firebase_uid" naming now that identity is Supabase Auth only.
--
-- Historical migrations still contain firebase_* strings for archival context; the
-- live database is corrected here so RLS policies and helpers cannot reference
-- dropped columns (e.g. profiles.firebase_uid, client_billing.firebase_uid).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Identity helpers (prefer explicit naming; keep firebase_uid() as thin alias)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_auth_uid_text()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT auth.uid()::text;
$$;

COMMENT ON FUNCTION public.current_auth_uid_text() IS
  'Returns auth.uid() as text. Preferred over legacy firebase_uid() alias.';

CREATE OR REPLACE FUNCTION public.firebase_uid()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT auth.uid()::text;
$$;

COMMENT ON FUNCTION public.firebase_uid() IS
  'Deprecated name: returns auth.uid()::text. Use current_auth_uid_text() in new SQL.';

-- ---------------------------------------------------------------------------
-- 2) Core tenant resolver (Supabase UUID only; no legacy columns)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_client_id UUID;
BEGIN
  SELECT client_id INTO v_client_id
  FROM public.profiles
  WHERE supabase_uid = auth.uid()
  LIMIT 1;

  RETURN v_client_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_client_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Drop legacy org-RBAC policies whose expressions still reference
--    profiles.firebase_uid (removed in 20260324170000). Policies that only use
--    get_user_client_id() / get_auth_level() are left intact.
--    Tenant isolation policies (later migrations) scope many tables by client_id.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view organization tanks" ON public.tanks;
DROP POLICY IF EXISTS "Users can view organization sensor readings" ON public.sensor_readings;
DROP POLICY IF EXISTS "Users can view organization alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can view organization sites" ON public.sites;
DROP POLICY IF EXISTS "Users can manage organization shifts" ON public.shift_closures;
DROP POLICY IF EXISTS "Users can view organization fuel transactions" ON public.fuel_transactions;

-- sites: legacy SELECT policy referenced profiles.firebase_uid. Re-place with Supabase identity.
DROP POLICY IF EXISTS "Org members can view own sites" ON public.sites;
CREATE POLICY "Org members can view own sites"
ON public.sites FOR SELECT TO authenticated
USING (client_id = public.get_user_client_id() OR public.is_system_admin(4));

-- ---------------------------------------------------------------------------
-- 4) Support tickets: legacy policies referenced profiles.firebase_uid
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Clients can manage their own tickets" ON public.support_tickets;

-- ---------------------------------------------------------------------------
-- 5) Profiles: old policies used firebase_uid column (migration 20260319000007).
--    Later migrations renamed policies; drop any stragglers by name.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- ---------------------------------------------------------------------------
-- 6) Remove obsolete linkage helpers if they still exist
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.link_firebase_to_supabase(TEXT, UUID) CASCADE;
