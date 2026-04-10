-- supabase/migrations/20260319000005_implement_org_rbac.sql
-- ============================================================================
-- ORG-BASED RBAC: Enable Station Supervisors & Operators to see data
-- ============================================================================

-- Function to get the client_id (Organization ID) for the current user
CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS UUID
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  f_uid TEXT := public.firebase_uid();
  v_client_id UUID;
BEGIN
  -- 1. Check if user is a Station Owner (in client_billing)
  SELECT id INTO v_client_id FROM client_billing WHERE firebase_uid = f_uid;
  IF v_client_id IS NOT NULL THEN
    RETURN v_client_id;
  END IF;

  -- 2. Check if user is a Workforce Member (in profiles)
  SELECT client_id INTO v_client_id FROM profiles WHERE firebase_uid = f_uid;
  RETURN v_client_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- UPDATE RLS POLICIES FOR CORE TABLES
-- ============================================================================

-- 1. TANKS
DROP POLICY IF EXISTS "Users can view organization tanks" ON public.tanks;
CREATE POLICY "Users can view organization tanks"
  ON public.tanks FOR SELECT TO authenticated
  USING (
    (
      client_id = public.get_user_client_id() 
      AND (
        public.get_auth_level() < 7 
        OR site_id::text = ANY (SELECT unnest(site_ids) FROM public.profiles WHERE firebase_uid = public.firebase_uid())
      )
    )
    OR public.is_system_admin(4)
  );

-- 2. SENSOR_READINGS
DROP POLICY IF EXISTS "Users can view organization sensor readings" ON public.sensor_readings;
CREATE POLICY "Users can view organization sensor readings"
  ON public.sensor_readings FOR SELECT TO authenticated
  USING (
    tank_id IN (
      SELECT id FROM public.tanks 
      WHERE client_id = public.get_user_client_id()
      AND (
        public.get_auth_level() < 7 
        OR site_id::text = ANY (SELECT unnest(site_ids) FROM public.profiles WHERE firebase_uid = public.firebase_uid())
      )
    )
    OR public.is_system_admin(4)
  );

-- 3. ALERTS
DROP POLICY IF EXISTS "Users can view organization alerts" ON public.alerts;
CREATE POLICY "Users can view organization alerts"
  ON public.alerts FOR SELECT TO authenticated
  USING (
    (
      client_id = public.get_user_client_id()
      AND (
        public.get_auth_level() < 7 
        OR tank_id IN (
          SELECT id FROM public.tanks 
          WHERE site_id::text = ANY (SELECT unnest(site_ids) FROM public.profiles WHERE firebase_uid = public.firebase_uid())
        )
      )
    )
    OR public.is_system_admin(4)
  );

-- 4. DELIVERIES
DROP POLICY IF EXISTS "Users can view organization deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Users can view own deliveries" ON public.deliveries;
CREATE POLICY "Users can view organization deliveries"
  ON public.deliveries FOR SELECT TO authenticated
  USING (
    tank_id IN (SELECT id FROM public.tanks WHERE client_id = public.get_user_client_id())
    OR public.is_system_admin(4)
  );

-- 5. TRANSACTIONS (Financial - restrict to Level 5/Owner and System Admin)
DROP POLICY IF EXISTS "Owners can view organization transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
CREATE POLICY "Owners can view organization transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING (
    (client_id = public.get_user_client_id() AND public.get_auth_level() <= 5)
    OR public.is_system_admin(4)
  );

-- 6. CLIENT_BILLING (Restrict to Owner)
DROP POLICY IF EXISTS "Owners can view organization billing" ON public.client_billing;
DROP POLICY IF EXISTS "Users can view own billing record" ON public.client_billing;
CREATE POLICY "Owners can view organization billing"
  ON public.client_billing FOR SELECT TO authenticated
  USING (
    (id = public.get_user_client_id() AND public.get_auth_level() <= 5)
    OR public.is_system_admin(4)
  );

-- 7. SITES
DROP POLICY IF EXISTS "Users can view organization sites" ON public.sites;
DROP POLICY IF EXISTS "Users can view own sites" ON public.sites;
CREATE POLICY "Users can view organization sites"
  ON public.sites FOR SELECT TO authenticated
  USING (
    (
      client_id = public.get_user_client_id()
      AND (
        public.get_auth_level() < 7 
        OR id::text = ANY (SELECT unnest(site_ids) FROM public.profiles WHERE firebase_uid = public.firebase_uid())
      )
    )
    OR public.is_system_admin(4)
  );

-- 8. SHIFT_CLOSURES
DROP POLICY IF EXISTS "Users can manage organization shifts" ON public.shift_closures;
DROP POLICY IF EXISTS "Users can manage shifts in their organization" ON public.shift_closures;
CREATE POLICY "Users can manage organization shifts"
  ON public.shift_closures FOR ALL TO authenticated
  USING (
    (
      client_id = public.get_user_client_id()
      AND (
        public.get_auth_level() < 7 
        OR site_id::text = ANY (SELECT unnest(site_ids) FROM public.profiles WHERE firebase_uid = public.firebase_uid())
      )
    )
    OR public.is_system_admin(3)
  );

-- 9. USAGE_LOGS
DROP POLICY IF EXISTS "Users can view organization usage logs" ON public.usage_logs;
DROP POLICY IF EXISTS "Users can view own usage logs" ON public.usage_logs;
CREATE POLICY "Users can view organization usage logs"
  ON public.usage_logs FOR SELECT TO authenticated
  USING (
    (client_id = public.get_user_client_id() AND public.get_auth_level() <= 6)
    OR public.is_system_admin(4)
  );

-- 10. FUEL_TRANSACTIONS
DROP POLICY IF EXISTS "Users can view organization fuel transactions" ON public.fuel_transactions;
CREATE POLICY "Users can view organization fuel transactions"
  ON public.fuel_transactions FOR SELECT TO authenticated
  USING (
    (
      client_id = public.get_user_client_id()
      AND (
        public.get_auth_level() < 7 
        OR tank_id IN (
          SELECT id FROM public.tanks 
          WHERE site_id::text = ANY (SELECT unnest(site_ids) FROM public.profiles WHERE firebase_uid = public.firebase_uid())
        )
      )
    )
    OR public.is_system_admin(4)
  );

-- Grant execute
GRANT EXECUTE ON FUNCTION public.get_user_client_id() TO authenticated;
