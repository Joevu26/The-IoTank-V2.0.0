-- Fix Supabase database linter findings:
-- - function_search_path_mutable for specific SECURITY DEFINER functions
-- - rls_enabled_no_policy for internal tables

-- 1) Ensure stable, non-mutable search_path on SECURITY DEFINER trigger functions.
CREATE OR REPLACE FUNCTION public.stamp_admin_log_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.system_user_id IS NULL THEN
    SELECT id INTO NEW.system_user_id
    FROM public.system_users
    WHERE supabase_uid = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.stamp_audit_log_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF public.get_auth_level() >= 4 THEN
    NEW.client_id := public.get_user_client_id();
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'audit_logs'
        AND column_name = 'supabase_uid'
    ) THEN
      NEW.supabase_uid := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Add explicit policies for tables with RLS enabled but no policies.
-- These are internal/system tables; default to service_role access.

-- edge_rate_limits
ALTER TABLE IF EXISTS public.edge_rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role manages edge rate limits" ON public.edge_rate_limits;
CREATE POLICY "service role manages edge rate limits"
ON public.edge_rate_limits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- fuel_transactions
ALTER TABLE IF EXISTS public.fuel_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role manages fuel transactions" ON public.fuel_transactions;
CREATE POLICY "service role manages fuel transactions"
ON public.fuel_transactions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "org members view fuel transactions" ON public.fuel_transactions;
CREATE POLICY "org members view fuel transactions"
ON public.fuel_transactions
FOR SELECT
TO authenticated
USING (client_id = public.get_user_client_id());

-- market_bookmarks
ALTER TABLE IF EXISTS public.market_bookmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role manages market bookmarks" ON public.market_bookmarks;
CREATE POLICY "service role manages market bookmarks"
ON public.market_bookmarks
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "org members manage market bookmarks" ON public.market_bookmarks;
CREATE POLICY "org members manage market bookmarks"
ON public.market_bookmarks
FOR ALL
TO authenticated
USING (client_id = public.get_user_client_id())
WITH CHECK (client_id = public.get_user_client_id());

