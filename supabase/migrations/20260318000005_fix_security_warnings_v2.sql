-- supabase/migrations/20260318000005_fix_security_warnings_v2.sql
-- ============================================================================
-- FIX v2: All functions correctly use public.firebase_uid() instead of
--          auth.uid() because this project uses Firebase Auth JWTs.
--          auth.uid() returns NULL with Firebase — only firebase_uid() works.
-- ============================================================================

-- ============================
-- CORE HELPERS & SCHEMA SAFEGUARDS
-- ============================

-- Ensure the firebase_uid column exists on tables we explicitly reference
ALTER TABLE IF EXISTS public.client_billing ADD COLUMN IF NOT EXISTS firebase_uid TEXT;
ALTER TABLE IF EXISTS public.transactions ADD COLUMN IF NOT EXISTS firebase_uid TEXT;
ALTER TABLE IF EXISTS public.tanks ADD COLUMN IF NOT EXISTS firebase_uid TEXT;
ALTER TABLE IF EXISTS public.alerts ADD COLUMN IF NOT EXISTS firebase_uid TEXT;
ALTER TABLE IF EXISTS public.market_bookmarks ADD COLUMN IF NOT EXISTS firebase_uid TEXT;
ALTER TABLE IF EXISTS public.fuel_transactions ADD COLUMN IF NOT EXISTS firebase_uid TEXT;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Extracts the Firebase UID from the JWT 'sub' or 'user_id' claim
CREATE OR REPLACE FUNCTION firebase_uid()
RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(
    COALESCE(
      current_setting('request.jwt.claims', true)::json->>'sub',
      current_setting('request.jwt.claims', true)::json->>'user_id'
    ),
    ''
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Returns TRUE if the caller is an active super_admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.firebase_uid() IN (
    SELECT su.firebase_uid
    FROM public.system_users su
    WHERE su.role = 'super_admin'
      AND su.is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Gets the client_billing UUID for the calling user
CREATE OR REPLACE FUNCTION get_client_id_from_auth()
RETURNS UUID AS $$
DECLARE
  client_uuid UUID;
BEGIN
  SELECT id INTO client_uuid
  FROM public.client_billing
  WHERE firebase_uid = public.firebase_uid();
  RETURN client_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================
-- ROLE HIERARCHY CHECKER
-- ============================
-- 'minimum_role' = the lowest access level required
-- super_admin > admin_helper > support_staff > analyst
-- CASCADE required: 14 RLS policies depend on the old function signature.
-- We drop with CASCADE, redefine the function, then recreate all policies below.
DROP FUNCTION IF EXISTS public.is_system_admin(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.is_system_admin(INTEGER) CASCADE;
CREATE OR REPLACE FUNCTION is_system_admin(minimum_role TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_uid TEXT;
  v_role TEXT;
  v_active BOOLEAN;
  role_order INT;
  required_order INT;
BEGIN
  v_uid := public.firebase_uid();
  IF v_uid IS NULL THEN RETURN FALSE; END IF;

  SELECT su.role, su.is_active INTO v_role, v_active
  FROM public.system_users su
  WHERE su.firebase_uid = v_uid;

  IF NOT FOUND OR NOT v_active THEN RETURN FALSE; END IF;
  IF minimum_role IS NULL THEN RETURN TRUE; END IF;

  -- Map roles to numeric order (higher = more privileged)
  role_order := CASE v_role
    WHEN 'super_admin'   THEN 4
    WHEN 'admin_helper'  THEN 3
    WHEN 'support_staff' THEN 2
    WHEN 'analyst'       THEN 1
    ELSE 0
  END;

  required_order := CASE minimum_role
    WHEN 'super_admin'   THEN 4
    WHEN 'admin_helper'  THEN 3
    WHEN 'support_staff' THEN 2
    WHEN 'analyst'       THEN 1
    ELSE 0
  END;

  RETURN role_order >= required_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================
-- FINANCIAL FUNCTIONS
-- ============================

CREATE OR REPLACE FUNCTION add_debt_to_client(
  p_client_id UUID,
  p_amount DECIMAL,
  p_description TEXT,
  p_transaction_type TEXT DEFAULT 'charge'
) RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_firebase_uid TEXT;
BEGIN
  SELECT cb.firebase_uid INTO v_firebase_uid
  FROM public.client_billing cb WHERE cb.id = p_client_id;

  UPDATE public.client_billing
  SET current_debt = current_debt + p_amount, updated_at = NOW()
  WHERE id = p_client_id;

  INSERT INTO public.transactions (
    client_id, firebase_uid, transaction_type, amount, description, payment_status
  ) VALUES (
    p_client_id, v_firebase_uid, p_transaction_type, p_amount, p_description, 'completed'
  ) RETURNING id INTO v_transaction_id;
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION process_payment(
  p_client_id UUID,
  p_amount DECIMAL,
  p_payment_method TEXT,
  p_payment_reference TEXT,
  p_description TEXT DEFAULT 'Payment received'
) RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_firebase_uid TEXT;
  v_current_debt DECIMAL;
BEGIN
  SELECT cb.current_debt, cb.firebase_uid
  INTO v_current_debt, v_firebase_uid
  FROM public.client_billing cb WHERE cb.id = p_client_id;

  IF p_amount > v_current_debt THEN
    RAISE EXCEPTION 'Payment amount exceeds current debt';
  END IF;

  UPDATE public.client_billing
  SET current_debt = current_debt - p_amount,
      total_paid = total_paid + p_amount,
      last_payment_date = NOW(),
      updated_at = NOW(),
      account_status = CASE WHEN (current_debt - p_amount) <= 0 THEN 'active' ELSE account_status END
  WHERE id = p_client_id;

  INSERT INTO public.transactions (
    client_id, firebase_uid, transaction_type, amount, description,
    payment_method, payment_reference, payment_status, completed_at
  ) VALUES (
    p_client_id, v_firebase_uid, 'payment', p_amount, p_description,
    p_payment_method, p_payment_reference, 'completed', NOW()
  ) RETURNING id INTO v_transaction_id;
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_client_dashboard_summary(p_firebase_uid TEXT)
RETURNS JSON AS $$
DECLARE v_summary JSON;
BEGIN
  SELECT json_build_object(
    'billing', (
      SELECT json_build_object(
        'current_debt', cb.current_debt,
        'total_paid', cb.total_paid,
        'subscription_tier', cb.subscription_tier,
        'account_status', cb.account_status,
        'next_billing_date', cb.next_billing_date
      ) FROM public.client_billing cb WHERE cb.firebase_uid = p_firebase_uid
    ),
    'tanks', (
      SELECT json_agg(
        json_build_object(
          'id', t.id, 'name', t.tank_name, 'fuel_type', t.fuel_type,
          'current_volume', t.current_volume, 'capacity', t.tank_capacity,
          'fill_percentage', ROUND((t.current_volume / NULLIF(t.tank_capacity, 0) * 100)::NUMERIC, 2),
          'temperature', t.current_temperature, 'status', t.status
        )
      ) FROM public.tanks t WHERE t.firebase_uid = p_firebase_uid AND t.status = 'active'
    ),
    'unread_alerts', (
      SELECT COUNT(*) FROM public.alerts a
      WHERE a.firebase_uid = p_firebase_uid AND a.is_read = FALSE
    ),
    'critical_alerts', (
      SELECT COUNT(*) FROM public.alerts a
      WHERE a.firebase_uid = p_firebase_uid AND a.is_read = FALSE AND a.severity = 'critical'
    )
  ) INTO v_summary;
  RETURN v_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION admin_adjust_client_debt(
  p_client_id UUID,
  p_adjustment_amount DECIMAL,
  p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_uid TEXT;
  v_system_user_id UUID;
  v_old_debt DECIMAL;
  v_new_debt DECIMAL;
  v_transaction_id UUID;
  v_fb_uid TEXT;
BEGIN
  v_admin_uid := public.firebase_uid();
  SELECT su.id INTO v_system_user_id
  FROM public.system_users su
  WHERE su.firebase_uid = v_admin_uid
    AND su.is_active = TRUE
    AND su.role IN ('super_admin', 'admin_helper');
  IF v_system_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Only active Super Admins and Admin Helpers can adjust debt.';
  END IF;

  SELECT cb.current_debt, cb.firebase_uid INTO v_old_debt, v_fb_uid
  FROM public.client_billing cb WHERE cb.id = p_client_id;
  IF v_old_debt IS NULL THEN RAISE EXCEPTION 'Client not found.'; END IF;

  v_new_debt := GREATEST(0, v_old_debt + p_adjustment_amount);
  UPDATE public.client_billing SET current_debt = v_new_debt, updated_at = NOW() WHERE id = p_client_id;

  INSERT INTO public.transactions (
    client_id, firebase_uid, transaction_type, amount, description, payment_status, created_by
  ) VALUES (
    p_client_id, v_fb_uid, 'adjustment', ABS(p_adjustment_amount), p_reason, 'completed', v_admin_uid
  ) RETURNING id INTO v_transaction_id;

  INSERT INTO public.admin_logs (
    system_user_id, firebase_uid, action_type, affected_client_id, description, changes_made
  ) VALUES (
    v_system_user_id, v_admin_uid, 'debt_adjusted', p_client_id,
    'Manually adjusted debt: ' || p_reason,
    jsonb_build_object('before', jsonb_build_object('current_debt', v_old_debt),
                       'after', jsonb_build_object('current_debt', v_new_debt),
                       'transaction_id', v_transaction_id)
  );
  RETURN jsonb_build_object('success', true, 'old_debt', v_old_debt, 'new_debt', v_new_debt);
END;
$$;

CREATE OR REPLACE FUNCTION admin_suspend_client(
  p_client_id UUID,
  p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_uid TEXT;
  v_system_user_id UUID;
  v_old_status TEXT;
BEGIN
  v_admin_uid := public.firebase_uid();
  SELECT su.id INTO v_system_user_id
  FROM public.system_users su
  WHERE su.firebase_uid = v_admin_uid
    AND su.is_active = TRUE
    AND su.role IN ('super_admin', 'admin_helper');
  IF v_system_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admins and Admin Helpers can suspend accounts.';
  END IF;

  SELECT cb.account_status INTO v_old_status FROM public.client_billing cb WHERE cb.id = p_client_id;
  UPDATE public.client_billing
  SET account_status = 'suspended', suspension_reason = p_reason, updated_at = NOW()
  WHERE id = p_client_id;

  INSERT INTO public.admin_logs (
    system_user_id, firebase_uid, action_type, affected_client_id, description, changes_made
  ) VALUES (
    v_system_user_id, v_admin_uid, 'client_suspended', p_client_id,
    'Suspended account. Reason: ' || p_reason,
    jsonb_build_object('before_status', v_old_status, 'after_status', 'suspended')
  );
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================
-- TANK & SENSOR FUNCTIONS
-- ============================

CREATE OR REPLACE FUNCTION calculate_standard_volume(
  ambient_volume DECIMAL,
  current_temp DECIMAL,
  fuel_type TEXT
) RETURNS DECIMAL AS $$
DECLARE
  thermal_coef DECIMAL;
  std_temp DECIMAL := 15.5;
BEGIN
  thermal_coef := CASE fuel_type
    WHEN 'diesel'   THEN 0.00085
    WHEN 'petrol'   THEN 0.00120
    WHEN 'kerosene' THEN 0.00095
    ELSE 0.00100
  END;
  RETURN ROUND((ambient_volume / (1 + thermal_coef * (current_temp - std_temp)))::NUMERIC, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION detect_theft_anomaly(
  p_tank_id UUID,
  p_current_volume DECIMAL,
  p_time_window_minutes INTEGER DEFAULT 60
) RETURNS JSON AS $$
DECLARE
  v_mean DECIMAL;
  v_stddev DECIMAL;
  v_z DECIMAL;
BEGIN
  SELECT AVG(sr.ambient_volume), STDDEV(sr.ambient_volume)
  INTO v_mean, v_stddev
  FROM public.sensor_readings sr
  WHERE sr.tank_id = p_tank_id
    AND sr.timestamp >= NOW() - (p_time_window_minutes || ' minutes')::INTERVAL
    AND sr.timestamp < NOW() - INTERVAL '5 minutes';

  v_z := CASE WHEN v_stddev > 0 THEN (p_current_volume - v_mean) / v_stddev ELSE 0 END;

  RETURN json_build_object(
    'is_theft_detected', v_z < -3.0,
    'confidence_score', ROUND(LEAST(100, ABS(v_z) * 25)::NUMERIC, 2),
    'z_score', ROUND(v_z::NUMERIC, 2),
    'baseline_mean', ROUND(v_mean::NUMERIC, 2),
    'current_volume', p_current_volume,
    'volume_drop', ROUND((v_mean - p_current_volume)::NUMERIC, 2)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_supplier_reliability_score(p_supplier_name TEXT)
RETURNS JSON AS $$
DECLARE v_score JSON;
BEGIN
  SELECT json_build_object(
    'supplier_name', p_supplier_name,
    'total_deliveries', COUNT(*),
    'verified_ok', COUNT(*) FILTER (WHERE d.verification_status = 'verified_ok'),
    'disputed_shortages', COUNT(*) FILTER (WHERE d.verification_status = 'disputed_shortage'),
    'avg_variance_percentage', ROUND(AVG(d.variance_percentage)::NUMERIC, 2),
    'reliability_score', ROUND((
      COUNT(*) FILTER (WHERE d.verification_status = 'verified_ok')::DECIMAL
      / NULLIF(COUNT(*), 0) * 100
    )::NUMERIC, 2)
  ) INTO v_score
  FROM public.deliveries d
  WHERE d.supplier_name = p_supplier_name
    AND d.created_at >= NOW() - INTERVAL '12 months';
  RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION calculate_delivery_variance()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actual_received_volume := NEW.tank_after_volume - NEW.tank_before_volume;
  IF NEW.bol_claimed_volume > 0 THEN
    NEW.variance_percentage := ROUND(
      ((NEW.bol_claimed_volume - NEW.actual_received_volume) / NEW.bol_claimed_volume * 100)::NUMERIC, 2
    );
  END IF;
  NEW.verification_status := CASE
    WHEN ABS(NEW.variance_percentage) <= 1.67 THEN 'verified_ok'
    WHEN NEW.variance_percentage > 1.67       THEN 'disputed_shortage'
    ELSE 'disputed_overage'
  END;
  NEW.is_accepted := ABS(NEW.variance_percentage) <= 1.67;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION check_tank_thresholds()
RETURNS TRIGGER AS $$
DECLARE
  v_client_id UUID;
  v_firebase_uid TEXT;
  v_low_threshold DECIMAL;
  v_high_temp DECIMAL;
BEGIN
  SELECT t.client_id, t.firebase_uid, t.low_level_threshold, t.high_temperature_threshold
  INTO v_client_id, v_firebase_uid, v_low_threshold, v_high_temp
  FROM public.tanks t WHERE t.id = NEW.tank_id;

  IF NEW.ambient_volume <= v_low_threshold THEN
    INSERT INTO public.alerts (
      client_id, tank_id, firebase_uid, alert_type, severity, title, message, alert_data
    ) VALUES (
      v_client_id, NEW.tank_id, v_firebase_uid, 'low_fuel', 'warning',
      'Low Fuel Level Alert', 'Tank has reached low fuel threshold. Consider reordering.',
      json_build_object('current_volume', NEW.ambient_volume, 'threshold', v_low_threshold)
    );
  END IF;

  IF NEW.temperature >= v_high_temp THEN
    INSERT INTO public.alerts (
      client_id, tank_id, firebase_uid, alert_type, severity, title, message, alert_data
    ) VALUES (
      v_client_id, NEW.tank_id, v_firebase_uid, 'high_temperature', 'critical',
      'High Temperature Alert', 'Tank temperature has exceeded safety threshold!',
      json_build_object('current_temp', NEW.temperature, 'threshold', v_high_temp)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION link_tank_to_client()
RETURNS TRIGGER AS $$
BEGIN
  SELECT cb.id INTO NEW.client_id
  FROM public.client_billing cb WHERE cb.firebase_uid = NEW.firebase_uid;
  IF NEW.client_id IS NULL THEN
    RAISE EXCEPTION 'Client billing record must exist before creating a tank';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION prevent_negative_debt()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_debt < 0 THEN
    RAISE EXCEPTION 'Debt cannot be negative. Current attempt: %', NEW.current_debt;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION update_tank_from_sensor()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.tanks t
  SET current_volume        = NEW.ambient_volume,
      current_temperature   = NEW.temperature,
      standard_volume       = NEW.standard_volume,
      last_reading_at       = NEW.timestamp,
      updated_at            = NOW()
  WHERE t.id = NEW.tank_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================
-- FIX: Overly Permissive RLS on fuel_transactions & market_bookmarks
-- ============================

-- fuel_transactions
ALTER TABLE IF EXISTS fuel_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public fuel_transactions access"         ON fuel_transactions;
DROP POLICY IF EXISTS "Clients can view own fuel transactions"  ON fuel_transactions;
DROP POLICY IF EXISTS "Clients can insert own fuel transactions" ON fuel_transactions;

CREATE POLICY "Clients can view own fuel transactions"
  ON fuel_transactions FOR SELECT TO authenticated
  USING (firebase_uid = public.firebase_uid());

CREATE POLICY "Clients can insert own fuel transactions"
  ON fuel_transactions FOR INSERT TO authenticated
  WITH CHECK (firebase_uid = public.firebase_uid());

-- market_bookmarks
ALTER TABLE IF EXISTS market_bookmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public market_bookmarks access"        ON market_bookmarks;
DROP POLICY IF EXISTS "Clients can manage own market bookmarks" ON market_bookmarks;

CREATE POLICY "Clients can manage own market bookmarks"
  ON market_bookmarks FOR ALL TO authenticated
  USING (firebase_uid = public.firebase_uid())
  WITH CHECK (firebase_uid = public.firebase_uid());

-- ============================
-- RECREATE POLICIES DROPPED BY CASCADE
-- (is_system_admin was dropped with CASCADE, removing 14 dependent policies)
-- ============================

-- system_users
DROP POLICY IF EXISTS "Super Admins can manage all users" ON public.system_users;
CREATE POLICY "Super Admins can manage all users"
  ON public.system_users FOR ALL TO authenticated
  USING (public.is_system_admin('super_admin'))
  WITH CHECK (public.is_system_admin('super_admin'));

-- admin_logs
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

-- client_billing
DROP POLICY IF EXISTS "System users can read all client billing" ON public.client_billing;
CREATE POLICY "System users can read all client billing"
  ON public.client_billing FOR SELECT TO authenticated
  USING (
    public.is_system_admin('analyst')
    OR firebase_uid = public.firebase_uid()
  );

DROP POLICY IF EXISTS "System users can update client billing" ON public.client_billing;
CREATE POLICY "System users can update client billing"
  ON public.client_billing FOR UPDATE TO authenticated
  USING (public.is_system_admin('admin_helper'))
  WITH CHECK (public.is_system_admin('admin_helper'));

-- tanks
DROP POLICY IF EXISTS "System users can read all tanks" ON public.tanks;
CREATE POLICY "System users can read all tanks"
  ON public.tanks FOR SELECT TO authenticated
  USING (
    public.is_system_admin('analyst')
    OR firebase_uid = public.firebase_uid()
  );

DROP POLICY IF EXISTS "System users can update tanks" ON public.tanks;
CREATE POLICY "System users can update tanks"
  ON public.tanks FOR UPDATE TO authenticated
  USING (public.is_system_admin('support_staff'))
  WITH CHECK (public.is_system_admin('support_staff'));

-- transactions
DROP POLICY IF EXISTS "System users can read all transactions" ON public.transactions;
CREATE POLICY "System users can read all transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING (
    public.is_system_admin('analyst')
    OR firebase_uid = public.firebase_uid()
  );

-- audit_logs
DROP POLICY IF EXISTS "System admins can view all audit logs" ON public.audit_logs;
CREATE POLICY "System admins can view all audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_system_admin('analyst'));

-- market_signals
DROP POLICY IF EXISTS "System admins can read all market signals" ON public.market_signals;
CREATE POLICY "System admins can read all market signals"
  ON public.market_signals FOR SELECT TO authenticated
  USING (
    public.is_system_admin('analyst')
    OR TRUE  -- market signals are publicly readable
  );

-- raw_market_data
DROP POLICY IF EXISTS "System admins can read all raw market data" ON public.raw_market_data;
CREATE POLICY "System admins can read all raw market data"
  ON public.raw_market_data FOR SELECT TO authenticated
  USING (public.is_system_admin('analyst'));

-- pending_registrations
DROP POLICY IF EXISTS "System admins can view all pending registrations" ON public.pending_registrations;
CREATE POLICY "System admins can view all pending registrations"
  ON public.pending_registrations FOR SELECT TO authenticated
  USING (public.is_system_admin('support_staff'));

DROP POLICY IF EXISTS "System admins can update pending registrations" ON public.pending_registrations;
CREATE POLICY "System admins can update pending registrations"
  ON public.pending_registrations FOR UPDATE TO authenticated
  USING (public.is_system_admin('support_staff'))
  WITH CHECK (public.is_system_admin('support_staff'));

