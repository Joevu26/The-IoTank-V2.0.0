-- supabase/migrations/20260318000003_fix_security_warnings.sql
-- ============================================================================
-- FIX: Function Search Path Mutable Warnings (21 functions)
-- FIX: Overly Permissive RLS Policies (fuel_transactions, market_bookmarks)
-- ============================================================================

-- Each function is recreated with SET search_path = public to prevent
-- search_path injection attacks.

-- ============================
-- UTILITY FUNCTIONS
-- ============================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

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

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.firebase_uid() IN (
    SELECT firebase_uid FROM public.system_users
    WHERE role = 'super_admin' AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION user_owns_client(client_firebase_uid TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.firebase_uid() = client_firebase_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_client_id_from_auth()
RETURNS UUID AS $$
DECLARE
  client_uuid UUID;
BEGIN
  -- Firebase UID based identity was removed; prefer tenant resolution via profiles.
  SELECT client_id INTO client_uuid
  FROM public.profiles
  WHERE supabase_uid = auth.uid()
  LIMIT 1;
  RETURN client_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure tenant resolver exists before any RLS policies reference it.
CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS UUID
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
  RETURN COALESCE(v_client_id, '00000000-0000-0000-0000-000000000000'::uuid);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================
-- SYSTEM ADMIN UTILS
-- ============================

DROP FUNCTION IF EXISTS public.is_system_admin(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.is_system_admin(INTEGER) CASCADE;
CREATE OR REPLACE FUNCTION is_system_admin(required_role TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  user_active BOOLEAN;
BEGIN
  SELECT role, is_active INTO user_role, user_active
  FROM public.system_users
  WHERE firebase_uid = auth.uid()::text;
  
  IF NOT FOUND OR NOT user_active THEN
    RETURN FALSE;
  END IF;

  IF required_role IS NOT NULL THEN
    IF required_role = 'super_admin' AND user_role != 'super_admin' THEN
      RETURN FALSE;
    END IF;
    IF required_role = 'admin_helper' AND user_role NOT IN ('super_admin', 'admin_helper') THEN
      RETURN FALSE;
    END IF;
    IF required_role = 'support_staff' AND user_role NOT IN ('super_admin', 'admin_helper', 'support_staff') THEN
      RETURN FALSE;
    END IF;
    IF required_role = 'analyst' AND user_role NOT IN ('super_admin', 'admin_helper', 'support_staff', 'analyst') THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN TRUE;
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
  SELECT firebase_uid INTO v_firebase_uid
  FROM public.client_billing WHERE id = p_client_id;
  
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
  SELECT current_debt, firebase_uid INTO v_current_debt, v_firebase_uid
  FROM public.client_billing WHERE id = p_client_id;
  
  IF p_amount > v_current_debt THEN
    RAISE EXCEPTION 'Payment amount exceeds current debt';
  END IF;
  
  UPDATE public.client_billing
  SET current_debt = current_debt - p_amount,
      total_paid = total_paid + p_amount,
      last_payment_date = NOW(), updated_at = NOW(),
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
DECLARE
  v_summary JSON;
BEGIN
  SELECT json_build_object(
    'billing', (
      SELECT json_build_object(
        'current_debt', current_debt, 'total_paid', total_paid,
        'subscription_tier', subscription_tier, 'account_status', account_status,
        'next_billing_date', next_billing_date
      ) FROM public.client_billing WHERE firebase_uid = p_firebase_uid
    ),
    'tanks', (
      SELECT json_agg(
        json_build_object(
          'id', id, 'name', tank_name, 'fuel_type', fuel_type,
          'current_volume', current_volume, 'capacity', tank_capacity,
          'fill_percentage', ROUND((current_volume / tank_capacity * 100)::NUMERIC, 2),
          'temperature', current_temperature, 'status', status
        )
      ) FROM public.tanks WHERE firebase_uid = p_firebase_uid AND status = 'active'
    ),
    'unread_alerts', (SELECT COUNT(*) FROM public.alerts WHERE firebase_uid = p_firebase_uid AND is_read = FALSE),
    'critical_alerts', (SELECT COUNT(*) FROM public.alerts WHERE firebase_uid = p_firebase_uid AND is_read = FALSE AND severity = 'critical')
  ) INTO v_summary;
  RETURN v_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION calculate_monthly_usage_bill(
  p_client_id UUID,
  p_billing_period_start DATE,
  p_billing_period_end DATE
) RETURNS DECIMAL AS $$
DECLARE v_total_cost DECIMAL;
BEGIN
  SELECT COALESCE(SUM(total_cost), 0) INTO v_total_cost
  FROM public.usage_logs
  WHERE client_id = p_client_id
    AND timestamp >= p_billing_period_start
    AND timestamp <= p_billing_period_end
    AND is_billed = FALSE;
  RETURN v_total_cost;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Admin debt adjustment (Phase 2 super admin function)
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
BEGIN
  v_admin_uid := auth.uid()::text;
  SELECT id INTO v_system_user_id
  FROM public.system_users
  WHERE firebase_uid = v_admin_uid AND is_active = TRUE
    AND role IN ('super_admin', 'admin_helper');
  IF v_system_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Only active Super Admins and Admin Helpers can adjust debt.';
  END IF;
  SELECT current_debt INTO v_old_debt FROM public.client_billing WHERE id = p_client_id;
  IF v_old_debt IS NULL THEN RAISE EXCEPTION 'Client not found.'; END IF;
  v_new_debt := GREATEST(0, v_old_debt + p_adjustment_amount);
  UPDATE public.client_billing SET current_debt = v_new_debt, updated_at = NOW() WHERE id = p_client_id;
  INSERT INTO public.transactions (
    client_id, firebase_uid, transaction_type, amount, description, payment_status, created_by
  )
  SELECT p_client_id, firebase_uid, 'adjustment', ABS(p_adjustment_amount), p_reason, 'completed', v_admin_uid
  FROM public.client_billing WHERE id = p_client_id
  RETURNING id INTO v_transaction_id;
  INSERT INTO public.admin_logs (
    system_user_id, firebase_uid, action_type, affected_client_id, description, changes_made
  ) VALUES (
    v_system_user_id, v_admin_uid, 'debt_adjusted', p_client_id,
    'Manually adjusted debt: ' || p_reason,
    jsonb_build_object('before', jsonb_build_object('current_debt', v_old_debt), 'after', jsonb_build_object('current_debt', v_new_debt), 'transaction_id', v_transaction_id)
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
  v_admin_uid := auth.uid()::text;
  SELECT id INTO v_system_user_id
  FROM public.system_users
  WHERE firebase_uid = v_admin_uid AND is_active = TRUE
    AND role IN ('super_admin', 'admin_helper');
  IF v_system_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admins and Admin Helpers can suspend accounts.';
  END IF;
  SELECT account_status INTO v_old_status FROM public.client_billing WHERE id = p_client_id;
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
  thermal_expansion_coef DECIMAL;
  standard_temp DECIMAL := 15.5;
  standard_volume DECIMAL;
BEGIN
  thermal_expansion_coef := CASE fuel_type
    WHEN 'diesel' THEN 0.00085
    WHEN 'petrol' THEN 0.00120
    WHEN 'kerosene' THEN 0.00095
    ELSE 0.00100
  END;
  standard_volume := ambient_volume / (1 + thermal_expansion_coef * (current_temp - standard_temp));
  RETURN ROUND(standard_volume, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION detect_theft_anomaly(
  p_tank_id UUID,
  p_current_volume DECIMAL,
  p_time_window_minutes INTEGER DEFAULT 60
) RETURNS JSON AS $$
DECLARE
  v_baseline_mean DECIMAL;
  v_baseline_stddev DECIMAL;
  v_z_score DECIMAL;
  v_is_anomaly BOOLEAN;
  v_confidence DECIMAL;
BEGIN
  SELECT AVG(ambient_volume), STDDEV(ambient_volume)
  INTO v_baseline_mean, v_baseline_stddev
  FROM public.sensor_readings
  WHERE tank_id = p_tank_id
    AND timestamp >= NOW() - (p_time_window_minutes || ' minutes')::INTERVAL
    AND timestamp < NOW() - INTERVAL '5 minutes';
  IF v_baseline_stddev > 0 THEN
    v_z_score := (p_current_volume - v_baseline_mean) / v_baseline_stddev;
  ELSE v_z_score := 0; END IF;
  v_is_anomaly := v_z_score < -3.0;
  v_confidence := LEAST(100, ABS(v_z_score) * 25);
  RETURN json_build_object(
    'is_theft_detected', v_is_anomaly, 'confidence_score', ROUND(v_confidence, 2),
    'z_score', ROUND(v_z_score, 2), 'baseline_mean', ROUND(v_baseline_mean, 2),
    'current_volume', p_current_volume, 'volume_drop', ROUND(v_baseline_mean - p_current_volume, 2)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_supplier_reliability_score(p_supplier_name TEXT)
RETURNS JSON AS $$
DECLARE v_score JSON;
BEGIN
  SELECT json_build_object(
    'supplier_name', p_supplier_name, 'total_deliveries', COUNT(*),
    'verified_ok', COUNT(*) FILTER (WHERE verification_status = 'verified_ok'),
    'disputed_shortages', COUNT(*) FILTER (WHERE verification_status = 'disputed_shortage'),
    'avg_variance_percentage', ROUND(AVG(variance_percentage)::NUMERIC, 2),
    'reliability_score', ROUND((COUNT(*) FILTER (WHERE verification_status = 'verified_ok')::DECIMAL / NULLIF(COUNT(*), 0) * 100)::NUMERIC, 2)
  ) INTO v_score
  FROM public.deliveries WHERE supplier_name = p_supplier_name
    AND created_at >= NOW() - INTERVAL '12 months';
  RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION calculate_delivery_variance()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actual_received_volume := NEW.tank_after_volume - NEW.tank_before_volume;
  IF NEW.bol_claimed_volume > 0 THEN
    NEW.variance_percentage := ROUND(((NEW.bol_claimed_volume - NEW.actual_received_volume) / NEW.bol_claimed_volume * 100)::NUMERIC, 2);
  END IF;
  IF ABS(NEW.variance_percentage) <= 1.67 THEN
    NEW.verification_status := 'verified_ok'; NEW.is_accepted := TRUE;
  ELSIF NEW.variance_percentage > 1.67 THEN
    NEW.verification_status := 'disputed_shortage'; NEW.is_accepted := FALSE;
  ELSE
    NEW.verification_status := 'disputed_overage'; NEW.is_accepted := FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION check_tank_thresholds()
RETURNS TRIGGER AS $$
DECLARE
  v_client_id UUID;
  v_firebase_uid TEXT;
BEGIN
  SELECT client_id, firebase_uid INTO v_client_id, v_firebase_uid
  FROM public.tanks WHERE id = NEW.tank_id;
  IF NEW.ambient_volume <= (SELECT low_level_threshold FROM public.tanks WHERE id = NEW.tank_id) THEN
    INSERT INTO public.alerts (client_id, tank_id, firebase_uid, alert_type, severity, title, message, alert_data)
    VALUES (v_client_id, NEW.tank_id, v_firebase_uid, 'low_fuel', 'warning', 'Low Fuel Level Alert',
      'Tank has reached low fuel threshold. Consider reordering.',
      json_build_object('current_volume', NEW.ambient_volume, 'threshold', (SELECT low_level_threshold FROM public.tanks WHERE id = NEW.tank_id)));
  END IF;
  IF NEW.temperature >= (SELECT high_temperature_threshold FROM public.tanks WHERE id = NEW.tank_id) THEN
    INSERT INTO public.alerts (client_id, tank_id, firebase_uid, alert_type, severity, title, message, alert_data)
    VALUES (v_client_id, NEW.tank_id, v_firebase_uid, 'high_temperature', 'critical', 'High Temperature Alert',
      'Tank temperature has exceeded safety threshold!',
      json_build_object('current_temp', NEW.temperature, 'threshold', (SELECT high_temperature_threshold FROM public.tanks WHERE id = NEW.tank_id)));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION log_admin_action()
RETURNS TRIGGER AS $$
BEGIN
  IF public.is_admin() THEN
    INSERT INTO public.admin_logs (
      admin_firebase_uid, action_type, affected_client_id,
      affected_resource_type, affected_resource_id, description, changes_made
    )
    VALUES (
      public.firebase_uid(), TG_ARGV[0],
      CASE WHEN TG_TABLE_NAME = 'client_billing' THEN NEW.id
           WHEN TG_TABLE_NAME = 'transactions' THEN NEW.client_id
           ELSE NULL END,
      TG_TABLE_NAME, NEW.id, TG_ARGV[1],
      json_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW))
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION link_tank_to_client()
RETURNS TRIGGER AS $$
BEGIN
  SELECT id INTO NEW.client_id FROM public.client_billing WHERE firebase_uid = NEW.firebase_uid;
  IF NEW.client_id IS NULL THEN
    RAISE EXCEPTION 'Client billing record must exist before creating tank';
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
  UPDATE public.tanks
  SET current_volume = NEW.ambient_volume,
      current_temperature = NEW.temperature,
      standard_volume = NEW.standard_volume,
      last_reading_at = NEW.timestamp,
      updated_at = NOW()
  WHERE id = NEW.tank_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================
-- FIX: Overly Permissive RLS Policies
-- ============================

-- Fix fuel_transactions (drop the always-true policy)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'fuel_transactions'
  ) THEN
    ALTER TABLE public.fuel_transactions ENABLE ROW LEVEL SECURITY;

    -- Remove the overly-permissive fallback policy if present.
    DROP POLICY IF EXISTS "Public fuel_transactions access" ON public.fuel_transactions;

    -- Align policy to actual schema: this table does not have a firebase_uid column.
    DROP POLICY IF EXISTS "Clients can view own fuel transactions" ON public.fuel_transactions;
    CREATE POLICY "Clients can view own fuel transactions" ON public.fuel_transactions
      FOR SELECT TO authenticated
      USING (client_id = public.get_user_client_id());

    DROP POLICY IF EXISTS "Clients can insert own fuel transactions" ON public.fuel_transactions;
    CREATE POLICY "Clients can insert own fuel transactions" ON public.fuel_transactions
      FOR INSERT TO authenticated
      WITH CHECK (client_id = public.get_user_client_id());
  ELSE
    RAISE NOTICE 'Skipping policies: public.fuel_transactions table does not exist yet';
  END IF;
END
$$;

-- Fix market_bookmarks (drop the always-true policy)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'market_bookmarks'
  ) THEN
    ALTER TABLE public.market_bookmarks ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public market_bookmarks access" ON public.market_bookmarks;

    -- Align policy to actual schema: this table is scoped by client_id.
    DROP POLICY IF EXISTS "Clients can manage own market bookmarks" ON public.market_bookmarks;
    CREATE POLICY "Clients can manage own market bookmarks" ON public.market_bookmarks
      FOR ALL TO authenticated
      USING (client_id = public.get_user_client_id())
      WITH CHECK (client_id = public.get_user_client_id());
  ELSE
    RAISE NOTICE 'Skipping policies: public.market_bookmarks table does not exist yet';
  END IF;
END
$$;

-- Fix shift_closures (currently has RLS but may be missing its policy due to cascades)
ALTER TABLE IF EXISTS shift_closures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage organization shifts" ON public.shift_closures;
DROP POLICY IF EXISTS "Users can manage shifts in their organization" ON public.shift_closures;
CREATE POLICY "Users can manage shifts in their organization" ON public.shift_closures
  FOR ALL TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM public.profiles WHERE firebase_uid = public.firebase_uid()
    )
  );

-- Fix user_preferences
ALTER TABLE IF EXISTS user_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own preferences" ON public.user_preferences;
CREATE POLICY "Users can manage their own preferences" ON public.user_preferences
  FOR ALL TO authenticated
  USING (
    user_id IN (
      SELECT id FROM public.profiles WHERE firebase_uid = public.firebase_uid()
    )
  );
