-- supabase/migrations/20260321000002_restore_admin_visibility.sql
-- ============================================================================
-- RESTORATION: Re-create RLS policies that were dropped by CASCADE when
--              is_system_admin was redefined.
-- ============================================================================

-- 1. system_users (Level 1 / super_admin only)
DROP POLICY IF EXISTS "Super Admins can manage all users" ON public.system_users;
CREATE POLICY "Super Admins can manage all users"
  ON public.system_users FOR ALL TO authenticated
  USING (public.is_system_admin(1))
  WITH CHECK (public.is_system_admin(1));

-- 2. admin_logs (Level 2 / admin_helper and above)
DROP POLICY IF EXISTS "System users can view audit logs" ON public.admin_logs;
CREATE POLICY "System users can view audit logs"
  ON public.admin_logs FOR SELECT TO authenticated
  USING (public.is_system_admin(2));

DROP POLICY IF EXISTS "System can insert audit logs" ON public.admin_logs;
CREATE POLICY "System can insert audit logs"
  ON public.admin_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_system_admin(3));

-- 3. tanks (Level 4 / analyst and above)
DROP POLICY IF EXISTS "System admins view all tanks" ON public.tanks;
CREATE POLICY "System admins view all tanks"
  ON public.tanks FOR SELECT TO authenticated
  USING (public.is_system_admin(4));

-- 4. sensor_readings (Level 4)
DROP POLICY IF EXISTS "System admins view all readings" ON public.sensor_readings;
CREATE POLICY "System admins view all readings"
  ON public.sensor_readings FOR SELECT TO authenticated
  USING (public.is_system_admin(4));

-- 5. alerts (Level 4)
DROP POLICY IF EXISTS "System admins view all alerts" ON public.alerts;
CREATE POLICY "System admins view all alerts"
  ON public.alerts FOR SELECT TO authenticated
  USING (public.is_system_admin(4));

-- 6. transactions (Level 4)
DROP POLICY IF EXISTS "System admins view all transactions" ON public.transactions;
CREATE POLICY "System admins view all transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING (public.is_system_admin(4));

-- 7. client_billing (Level 4 for SELECT)
DROP POLICY IF EXISTS "System admins view all billing" ON public.client_billing;
CREATE POLICY "System admins view all billing"
  ON public.client_billing FOR SELECT TO authenticated
  USING (public.is_system_admin(4));

-- 8. sites (Level 4)
DROP POLICY IF EXISTS "System admins view all sites" ON public.sites;
CREATE POLICY "System admins view all sites"
  ON public.sites FOR SELECT TO authenticated
  USING (public.is_system_admin(4));

-- 9. fuel_transactions (Level 4)
DROP POLICY IF EXISTS "System admins view all fuel transactions" ON public.fuel_transactions;
CREATE POLICY "System admins view all fuel transactions"
  ON public.fuel_transactions FOR SELECT TO authenticated
  USING (public.is_system_admin(4));

-- 10. shift_closures (Level 3)
DROP POLICY IF EXISTS "System admins manage shifts" ON public.shift_closures;
CREATE POLICY "System admins manage shifts"
  ON public.shift_closures FOR ALL TO authenticated
  USING (public.is_system_admin(3));
