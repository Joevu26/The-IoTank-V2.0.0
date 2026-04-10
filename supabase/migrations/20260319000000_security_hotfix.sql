-- supabase/migrations/20260319000000_security_hotfix.sql
-- ============================================================================
-- SECURITY HOTFIX: Fix broken RLS policies, restore dropped policies,
--                  and resolve Search Path security warnings.
-- ============================================================================

-- 1. FIX BROKEN 'auth.uid()' REFERENCES
-- These tables were using auth.uid() which returns NULL for Firebase Auth.
-- Switched to public.firebase_uid() which correctly extracts the Firebase UID.

-- audit_logs
DROP POLICY IF EXISTS "Clients can view own audit logs" ON public.audit_logs;
CREATE POLICY "Clients can view own audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    client_id IN (SELECT id FROM public.client_billing WHERE firebase_uid = public.firebase_uid())
  );

DROP POLICY IF EXISTS "Clients can insert their own audit logs" ON public.audit_logs;
CREATE POLICY "Clients can insert their own audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id IN (SELECT id FROM public.client_billing WHERE firebase_uid = public.firebase_uid())
  );

-- file_uploads
DROP POLICY IF EXISTS "Clients can view own file uploads" ON public.file_uploads;
CREATE POLICY "Clients can view own file uploads" ON public.file_uploads
  FOR SELECT TO authenticated
  USING (
    client_id IN (SELECT id FROM public.client_billing WHERE firebase_uid = public.firebase_uid())
  );

DROP POLICY IF EXISTS "Clients can insert file uploads" ON public.file_uploads;
CREATE POLICY "Clients can insert file uploads" ON public.file_uploads
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id IN (SELECT id FROM public.client_billing WHERE firebase_uid = public.firebase_uid())
  );

DROP POLICY IF EXISTS "Clients can update own file uploads" ON public.file_uploads;
CREATE POLICY "Clients can update own file uploads" ON public.file_uploads
  FOR UPDATE TO authenticated
  USING (
    client_id IN (SELECT id FROM public.client_billing WHERE firebase_uid = public.firebase_uid())
  );

-- analysis_history
DROP POLICY IF EXISTS "Clients can view own analysis history" ON public.analysis_history;
CREATE POLICY "Clients can view own analysis history" ON public.analysis_history
  FOR SELECT TO authenticated
  USING (
    client_id IN (SELECT id FROM public.client_billing WHERE firebase_uid = public.firebase_uid())
  );

DROP POLICY IF EXISTS "Clients can insert own analysis history" ON public.analysis_history;
CREATE POLICY "Clients can insert own analysis history" ON public.analysis_history
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id IN (SELECT id FROM public.client_billing WHERE firebase_uid = public.firebase_uid())
  );

-- regulatory_notices
DROP POLICY IF EXISTS "Clients can view own regulatory notices" ON public.regulatory_notices;
CREATE POLICY "Clients can view own regulatory notices" ON public.regulatory_notices
  FOR SELECT TO authenticated
  USING (
    client_id IN (SELECT id FROM public.client_billing WHERE firebase_uid = public.firebase_uid())
    OR client_id IS NULL
  );

DROP POLICY IF EXISTS "Clients can insert regulatory notices" ON public.regulatory_notices;
CREATE POLICY "Clients can insert regulatory notices" ON public.regulatory_notices
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id IN (SELECT id FROM public.client_billing WHERE firebase_uid = public.firebase_uid())
    OR client_id IS NULL
  );

-- raw_market_data
DROP POLICY IF EXISTS "Clients can view own raw market data" ON public.raw_market_data;
CREATE POLICY "Clients can view own raw market data" ON public.raw_market_data
  FOR SELECT TO authenticated
  USING (
    client_id IN (SELECT id FROM public.client_billing WHERE firebase_uid = public.firebase_uid())
    OR client_id IS NULL
  );

DROP POLICY IF EXISTS "Clients can insert raw market data" ON public.raw_market_data;
CREATE POLICY "Clients can insert raw market data" ON public.raw_market_data
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id IN (SELECT id FROM public.client_billing WHERE firebase_uid = public.firebase_uid())
    OR client_id IS NULL
  );

-- 2. RESTORE POLICIES DROPPED BY CASCADE
-- These were removed when is_system_admin(text) was dropped in 20260318000005.

-- audit_logs (admin)
DROP POLICY IF EXISTS "System admins can view all audit logs" ON public.audit_logs;
CREATE POLICY "System admins can view all audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_system_admin('analyst'));

-- regulatory_notices (admin)
DROP POLICY IF EXISTS "System admins can manage regulatory notices" ON public.regulatory_notices;
CREATE POLICY "System admins can manage regulatory notices" ON public.regulatory_notices
  FOR ALL TO authenticated
  USING (public.is_system_admin('support_staff'))
  WITH CHECK (public.is_system_admin('support_staff'));

-- file_uploads (admin)
DROP POLICY IF EXISTS "System admins can view all file uploads" ON public.file_uploads;
CREATE POLICY "System admins can view all file uploads" ON public.file_uploads
  FOR SELECT TO authenticated
  USING (public.is_system_admin('support_staff'));

-- analysis_history (admin)
DROP POLICY IF EXISTS "System admins can view all analysis history" ON public.analysis_history;
CREATE POLICY "System admins can view all analysis history" ON public.analysis_history
  FOR SELECT TO authenticated
  USING (public.is_system_admin('analyst'));

-- 3. FIX SECURITY LEAK IN market_signals
-- Remove the 'OR TRUE' that allowed all authenticated users to see all signals.

DROP POLICY IF EXISTS "System admins can read all market signals" ON public.market_signals;
CREATE POLICY "System admins can read all market signals" ON public.market_signals
  FOR SELECT TO authenticated
  USING (public.is_system_admin('analyst'));

DROP POLICY IF EXISTS "Clients can view own market signals" ON public.market_signals;
CREATE POLICY "Clients can view own market signals" ON public.market_signals
  FOR SELECT TO authenticated
  USING (
    client_id IN (SELECT id FROM public.client_billing WHERE firebase_uid = public.firebase_uid())
    OR client_id IS NULL
  );

DROP POLICY IF EXISTS "Clients can insert market signals" ON public.market_signals;
CREATE POLICY "Clients can insert market signals" ON public.market_signals
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id IN (SELECT id FROM public.client_billing WHERE firebase_uid = public.firebase_uid())
    OR client_id IS NULL
  );

-- 4. RESOLVE SEARCH PATH MUTABLE WARNINGS (LINT 0011)
-- Re-declaring functions with explicit search_path = public.

CREATE OR REPLACE FUNCTION public.prevent_negative_debt()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_debt < 0 THEN
    RAISE EXCEPTION 'Debt cannot be negative. Current attempt: %', NEW.current_debt;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.link_tank_to_client()
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

CREATE OR REPLACE FUNCTION public.calculate_standard_volume(
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

CREATE OR REPLACE FUNCTION public.check_tank_thresholds()
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

CREATE OR REPLACE FUNCTION public.update_tank_from_sensor()
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

CREATE OR REPLACE FUNCTION public.calculate_delivery_variance()
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

-- 5. ENSURE RLS IS ENABLED ON ALL RELEVANT TABLES
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.file_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.analysis_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.market_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.regulatory_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.raw_market_data ENABLE ROW LEVEL SECURITY;
