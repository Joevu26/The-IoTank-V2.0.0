-- Level 4: analyst

-- 0. COLUMN SYNCHRONIZATION
-- Ensure the supabase_uid column exists in all relevant tables before applying RLS.
DO $$
BEGIN
  -- List of tables that require supabase_uid for RLS or Admin functionality
  ALTER TABLE IF EXISTS public.system_users ADD COLUMN IF NOT EXISTS supabase_uid UUID;
  ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS supabase_uid UUID;
  ALTER TABLE IF EXISTS public.client_billing ADD COLUMN IF NOT EXISTS supabase_uid UUID;
  ALTER TABLE IF EXISTS public.tanks ADD COLUMN IF NOT EXISTS supabase_uid UUID;
  ALTER TABLE IF EXISTS public.transactions ADD COLUMN IF NOT EXISTS supabase_uid UUID;
  ALTER TABLE IF EXISTS public.alerts ADD COLUMN IF NOT EXISTS supabase_uid UUID;
  ALTER TABLE IF EXISTS public.fuel_transactions ADD COLUMN IF NOT EXISTS supabase_uid UUID;
  ALTER TABLE IF EXISTS public.deliveries ADD COLUMN IF NOT EXISTS supabase_uid UUID;
  
  -- Create indexes for performance if they don't exist
  CREATE INDEX IF NOT EXISTS idx_system_users_supabase_uid ON public.system_users(supabase_uid);
  CREATE INDEX IF NOT EXISTS idx_profiles_supabase_uid ON public.profiles(supabase_uid);
  CREATE INDEX IF NOT EXISTS idx_client_billing_supabase_uid ON public.client_billing(supabase_uid);
  CREATE INDEX IF NOT EXISTS idx_tanks_supabase_uid ON public.tanks(supabase_uid);
  CREATE INDEX IF NOT EXISTS idx_transactions_supabase_uid ON public.transactions(supabase_uid);
  CREATE INDEX IF NOT EXISTS idx_alerts_supabase_uid ON public.alerts(supabase_uid);
  CREATE INDEX IF NOT EXISTS idx_fuel_transactions_supabase_uid ON public.fuel_transactions(supabase_uid);
  CREATE INDEX IF NOT EXISTS idx_deliveries_supabase_uid ON public.deliveries(supabase_uid);
END $$;

-- 1. HARDEN HELPER FUNCTIONS
-- Use SECURITY DEFINER and strict search_path.

-- Redefine is_system_admin to be self-contained and secure
DROP FUNCTION IF EXISTS public.is_system_admin(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.is_system_admin(INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION public.is_system_admin(minimum_role TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_uid UUID;
  v_role TEXT;
  v_active BOOLEAN;
  v_role_order INT;
  v_required_order INT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN FALSE; END IF;

  SELECT su.role, su.is_active INTO v_role, v_active
  FROM public.system_users su
  WHERE su.supabase_uid::uuid = v_uid::uuid;

  IF NOT FOUND OR NOT v_active THEN RETURN FALSE; END IF;
  IF minimum_role IS NULL THEN RETURN TRUE; END IF;

  -- ALIGNED HIERARCHY (1 is highest)
  v_role_order := CASE v_role
    WHEN 'super_admin'   THEN 1
    WHEN 'admin_helper'  THEN 2
    WHEN 'support_staff' THEN 3
    WHEN 'analyst'       THEN 4
    ELSE 99
  END;

  v_required_order := CASE minimum_role
    WHEN 'super_admin'   THEN 1
    WHEN 'admin_helper'  THEN 2
    WHEN 'support_staff' THEN 3
    WHEN 'analyst'       THEN 4
    ELSE 99
  END;

  -- Logic: Level 1 (Super Admin) satisfies any requirement <= 1
  -- Level 4 (Analyst) only satisfies Level 4
  RETURN v_role_order <= v_required_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Redefine is_admin (super_admin check)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.is_system_admin('super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. TIGHTEN RLS POLICIES
-- Remove 'anon' from all critical tables except where public access is explicitly required.

-- a. system_users
ALTER TABLE public.system_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super Admins can manage all users" ON public.system_users;
CREATE POLICY "Super Admins can manage all users"
  ON public.system_users FOR ALL TO authenticated
  USING (public.is_system_admin('super_admin'))
  WITH CHECK (public.is_system_admin('super_admin'));

DROP POLICY IF EXISTS "System users can read their own profile" ON public.system_users;
CREATE POLICY "System users can read their own profile"
  ON public.system_users FOR SELECT TO authenticated
  USING (supabase_uid::uuid = auth.uid()::uuid);

-- b. admin_logs
ALTER TABLE public.admin_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super Admins can view all logs" ON public.admin_logs;
CREATE POLICY "Super Admins can view all logs"
  ON public.admin_logs FOR SELECT TO authenticated
  USING (public.is_system_admin('super_admin'));

DROP POLICY IF EXISTS "Admin Helpers can view audit logs" ON public.admin_logs;
CREATE POLICY "Admin Helpers can view audit logs"
  ON public.admin_logs FOR SELECT TO authenticated
  USING (public.is_system_admin('admin_helper'));

DROP POLICY IF EXISTS "System can insert audit logs" ON public.admin_logs;
CREATE POLICY "System can insert audit logs"
  ON public.admin_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_system_admin('support_staff'));

-- c. client_billing
ALTER TABLE public.client_billing DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_billing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "System users can read all client billing" ON public.client_billing;
CREATE POLICY "System users can read all client billing"
  ON public.client_billing FOR SELECT TO authenticated
  USING (
    public.is_system_admin('analyst')
    OR supabase_uid::uuid = auth.uid()::uuid
  );

DROP POLICY IF EXISTS "System users can update client billing" ON public.client_billing;
CREATE POLICY "System users can update client billing"
  ON public.client_billing FOR UPDATE TO authenticated
  USING (public.is_system_admin('admin_helper'))
  WITH CHECK (public.is_system_admin('admin_helper'));

-- d. tanks
ALTER TABLE public.tanks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tanks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "System users can read all tanks" ON public.tanks;
CREATE POLICY "System users can read all tanks"
  ON public.tanks FOR SELECT TO authenticated
  USING (
    public.is_system_admin('analyst')
    OR supabase_uid::uuid = auth.uid()::uuid
  );

DROP POLICY IF EXISTS "System users can update tanks" ON public.tanks;
CREATE POLICY "System users can update tanks"
  ON public.tanks FOR UPDATE TO authenticated
  USING (public.is_system_admin('support_staff'))
  WITH CHECK (public.is_system_admin('support_staff'));

-- e. pending_registrations
-- Maintain 'anon' insert but harden it.
ALTER TABLE public.pending_registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit a registration request" ON public.pending_registrations;
CREATE POLICY "Anyone can submit a registration request"
  ON public.pending_registrations FOR INSERT TO anon, authenticated
  WITH CHECK (
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND length(full_name) >= 2
    AND length(station_name) >= 2
  );

DROP POLICY IF EXISTS "System admins can view all pending registrations" ON public.pending_registrations;
CREATE POLICY "System admins can view all pending registrations"
  ON public.pending_registrations FOR SELECT TO authenticated
  USING (public.is_system_admin('support_staff'));

DROP POLICY IF EXISTS "System admins can update pending registrations" ON public.pending_registrations;
CREATE POLICY "System admins can update pending registrations"
  ON public.pending_registrations FOR UPDATE TO authenticated
  USING (public.is_system_admin('support_staff'))
  WITH CHECK (public.is_system_admin('support_staff'));

-- f. transactions
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "System users can read all transactions" ON public.transactions;
CREATE POLICY "System users can read all transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING (
    public.is_system_admin('analyst')
    OR supabase_uid::uuid = auth.uid()::uuid
  );

-- g. sensor_readings
ALTER TABLE public.sensor_readings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clients can view own sensor readings" ON public.sensor_readings;
CREATE POLICY "Clients can view own sensor readings"
  ON public.sensor_readings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tanks t
      WHERE t.id::uuid = tank_id::uuid
      AND t.supabase_uid::uuid = auth.uid()::uuid
    )
    OR public.is_system_admin('analyst')
  );

-- h. alerts
ALTER TABLE public.alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clients can view own alerts" ON public.alerts;
CREATE POLICY "Clients can view own alerts"
  ON public.alerts FOR SELECT TO authenticated
  USING (
    supabase_uid::uuid = auth.uid()::uuid
    OR public.is_system_admin('analyst')
  );

DROP POLICY IF EXISTS "Clients can update own alerts" ON public.alerts;
CREATE POLICY "Clients can update own alerts"
  ON public.alerts FOR UPDATE TO authenticated
  USING (supabase_uid::uuid = auth.uid()::uuid)
  WITH CHECK (supabase_uid::uuid = auth.uid()::uuid);

-- i. fuel_transactions
ALTER TABLE public.fuel_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clients can view own fuel transactions" ON public.fuel_transactions;
CREATE POLICY "Clients can view own fuel transactions"
  ON public.fuel_transactions FOR SELECT TO authenticated
  USING (supabase_uid::uuid = auth.uid()::uuid OR public.is_system_admin('analyst'));

-- j. deliveries
ALTER TABLE public.deliveries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clients can view own deliveries" ON public.deliveries;
CREATE POLICY "Clients can view own deliveries"
  ON public.deliveries FOR SELECT TO authenticated
  USING (supabase_uid::uuid = auth.uid()::uuid OR public.is_system_admin('analyst'));

-- k. market_signals
ALTER TABLE public.market_signals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "System admins can read all market signals" ON public.market_signals;
CREATE POLICY "System admins can read all market signals"
  ON public.market_signals FOR SELECT TO authenticated
  USING (public.is_system_admin('analyst') OR TRUE); -- Market signals remain publicly readable but via authenticated role

-- l. audit_logs
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "System admins can view all audit logs" ON public.audit_logs;
CREATE POLICY "System admins can view all audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_system_admin('admin_helper')); -- Restrict to admin_helper+ (Level 2)

-- 3. INPUT VALIDATION & INJECTION PREVENTION
-- Add check constraints to tables.

ALTER TABLE public.client_billing 
  DROP CONSTRAINT IF EXISTS chk_client_email_format,
  ADD CONSTRAINT chk_client_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE public.system_users
  DROP CONSTRAINT IF EXISTS chk_system_user_email_format,
  ADD CONSTRAINT chk_system_user_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE public.pending_registrations
  DROP CONSTRAINT IF EXISTS chk_pending_email_format,
  ADD CONSTRAINT chk_pending_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE public.tanks
  DROP CONSTRAINT IF EXISTS chk_tank_capacity_positive,
  ADD CONSTRAINT chk_tank_capacity_positive CHECK (tank_capacity > 0);

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS chk_transaction_amount_positive,
  ADD CONSTRAINT chk_transaction_amount_positive CHECK (amount >= 0);

-- 4. HARDEN RPCs
-- Ensure all administrative RPCs use SECURITY DEFINER and search_path public.

CREATE OR REPLACE FUNCTION public.admin_adjust_client_debt(
  p_client_id UUID,
  p_adjustment_amount DECIMAL,
  p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_uid UUID;
  v_system_user_id UUID;
  v_old_debt DECIMAL;
  v_new_debt DECIMAL;
  v_transaction_id UUID;
  v_client_supabase_uid UUID;
BEGIN
  -- Strict Auth Check
  v_admin_uid := auth.uid();
  IF v_admin_uid IS NULL THEN RAISE EXCEPTION 'Unauthenticated'; END IF;

  -- Level 2 (admin_helper) or higher required
  SELECT su.id INTO v_system_user_id
  FROM public.system_users su
  WHERE su.supabase_uid::uuid = v_admin_uid::uuid
    AND su.is_active = TRUE
    AND public.is_system_admin('admin_helper');

  IF v_system_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Only active Super Admins and Admin Helpers can adjust debt.';
  END IF;

  -- Input Sanitization/Validation
  IF p_adjustment_amount IS NULL OR p_adjustment_amount = 0 THEN
    RAISE EXCEPTION 'Invalid adjustment amount';
  END IF;

  SELECT cb.current_debt, cb.supabase_uid::uuid INTO v_old_debt, v_client_supabase_uid
  FROM public.client_billing cb WHERE cb.id = p_client_id;
  IF v_old_debt IS NULL THEN RAISE EXCEPTION 'Client not found.'; END IF;

  v_new_debt := GREATEST(0, v_old_debt + p_adjustment_amount);
  UPDATE public.client_billing SET current_debt = v_new_debt, updated_at = NOW() WHERE id = p_client_id;

  INSERT INTO public.transactions (
    client_id, supabase_uid, transaction_type, amount, description, payment_status, created_by
  ) VALUES (
    p_client_id, v_client_supabase_uid, 'adjustment', ABS(p_adjustment_amount), LEFT(p_reason, 255), 'completed', v_admin_uid::uuid
  ) RETURNING id INTO v_transaction_id;

  INSERT INTO public.admin_logs (
    system_user_id, action_type, affected_client_id, description, changes_made
  ) VALUES (
    v_system_user_id, 'debt_adjusted', p_client_id,
    'Manually adjusted debt: ' || LEFT(p_reason, 255),
    jsonb_build_object('before', jsonb_build_object('current_debt', v_old_debt),
                       'after', jsonb_build_object('current_debt', v_new_debt),
                       'transaction_id', v_transaction_id)
  );
  RETURN jsonb_build_object('success', true, 'old_debt', v_old_debt, 'new_debt', v_new_debt);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_suspend_client(
  p_client_id UUID,
  p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_uid UUID;
  v_system_user_id UUID;
  v_old_status TEXT;
BEGIN
  v_admin_uid := auth.uid();
  IF v_admin_uid IS NULL THEN RAISE EXCEPTION 'Unauthenticated'; END IF;

  -- Level 2 (admin_helper) or higher required
  SELECT su.id INTO v_system_user_id
  FROM public.system_users su
  WHERE su.supabase_uid::uuid = v_admin_uid::uuid
    AND su.is_active = TRUE
    AND public.is_system_admin('admin_helper');

  IF v_system_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admins and Admin Helpers can suspend accounts.';
  END IF;

  SELECT cb.account_status INTO v_old_status FROM public.client_billing cb WHERE cb.id = p_client_id;
  IF v_old_status IS NULL THEN RAISE EXCEPTION 'Client not found'; END IF;

  UPDATE public.client_billing
  SET account_status = 'suspended', suspension_reason = LEFT(p_reason, 500), updated_at = NOW()
  WHERE id = p_client_id;

  INSERT INTO public.admin_logs (
    system_user_id, action_type, affected_client_id, description, changes_made
  ) VALUES (
    v_system_user_id, 'client_suspended', p_client_id,
    'Suspended account. Reason: ' || LEFT(p_reason, 255),
    jsonb_build_object('before_status', v_old_status, 'after_status', 'suspended')
  );
  RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. HARDEN BOOTSTRAP
-- Only service_role can call bootstrap_super_admin if no super_admin exists
-- If one exists, only that super_admin can call it.
CREATE OR REPLACE FUNCTION public.bootstrap_super_admin(
  p_email TEXT,
  p_full_name TEXT,
  p_supabase_uid UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_request_role TEXT := auth.role();
  v_existing_id UUID;
  v_normalized_email TEXT;
  v_has_super_admin BOOLEAN;
BEGIN
  v_normalized_email := LOWER(TRIM(p_email));
  
  -- Check if any active super_admin exists (Level 1)
  SELECT EXISTS (SELECT 1 FROM public.system_users WHERE role = 'super_admin' AND is_active = TRUE)
  INTO v_has_super_admin;

  -- Security Gate
  IF v_has_super_admin THEN
    IF NOT public.is_system_admin('super_admin') THEN
      RAISE EXCEPTION 'Unauthorized: Only an active super_admin can bootstrap another.';
    END IF;
  ELSE
    IF v_request_role <> 'service_role' THEN
      RAISE EXCEPTION 'Unauthorized: Initial bootstrap requires service_role.';
    END IF;
  END IF;

  IF v_normalized_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format.';
  END IF;

  INSERT INTO public.system_users (
    email, full_name, role, supabase_uid, is_active
  )
  VALUES (
    v_normalized_email, TRIM(p_full_name), 'super_admin', p_supabase_uid, TRUE
  )
  ON CONFLICT (email) DO UPDATE SET
    role = 'super_admin',
    is_active = TRUE,
    supabase_uid = EXCLUDED.supabase_uid
  RETURNING id INTO v_existing_id;

  RETURN v_existing_id;
END;
$$;
