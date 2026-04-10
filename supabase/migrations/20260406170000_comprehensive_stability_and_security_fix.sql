-- supabase/migrations/20260406170000_comprehensive_stability_and_security_fix.sql
-- ============================================================================
-- STABILITY & SECURITY: Unify RLS, Fix Admin Access, and Secure Sensor Ingestion
-- ============================================================================

-- 1. UNIFY CORE HELPER FUNCTIONS
-- ============================================================================

-- Ensure is_admin() is robust and used everywhere
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.system_users 
        WHERE supabase_uid = auth.uid()
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure get_client_id_from_auth() is robust
CREATE OR REPLACE FUNCTION public.get_client_id_from_auth()
RETURNS UUID AS $$
DECLARE
    v_client_id UUID;
BEGIN
    SELECT client_id INTO v_client_id
    FROM public.profiles
    WHERE supabase_uid = auth.uid();
    
    RETURN v_client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. SECURE SENSOR READINGS & TANK UPDATES
-- ============================================================================

-- Ensure sensor_readings has proper RLS for both Clients and Admins
ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sensor readings" ON public.sensor_readings;
DROP POLICY IF EXISTS "Tenant isolation for sensor_readings" ON public.sensor_readings;
CREATE POLICY "Tenant isolation for sensor_readings"
ON public.sensor_readings FOR SELECT TO authenticated
USING (
    client_id = public.get_client_id_from_auth() 
    OR public.is_admin()
    OR EXISTS (
        SELECT 1 FROM public.tanks 
        WHERE public.tanks.id = public.sensor_readings.tank_id 
        AND (public.tanks.client_id = public.get_client_id_from_auth() OR public.is_admin())
    )
);

-- Allow service role (Firebase Function) to insert sensor readings
-- (Note: Service role bypasses RLS, but we keep the policy for documentation and explicit control)
DROP POLICY IF EXISTS "Service role can insert sensor readings" ON public.sensor_readings;
CREATE POLICY "Service role can insert sensor readings"
ON public.sensor_readings FOR INSERT TO service_role
WITH CHECK (true);

-- 3. UNIFY ADMIN ACCESS ACROSS ALL CRITICAL TABLES
-- ============================================================================

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'tanks', 'sites', 'client_billing', 'deliveries', 'alerts', 
        'usage_logs', 'transactions', 'profiles', 'devices',
        'sensor_readings', 'analysis_history', 'audit_logs',
        'file_uploads', 'market_signals', 'raw_market_data',
        'regulatory_notices', 'shift_closures', 'support_tickets'
    ])
    LOOP
        -- Enable RLS just in case
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        
        -- Add/Update Admin "Super" Policy
        EXECUTE format('DROP POLICY IF EXISTS "Admin full access" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Admin full access" ON public.%I FOR ALL TO authenticated USING (public.is_admin())', t);
    END LOOP;
END $$;

-- 3b. Client Insert Permissions for Alerts (Required by Alert Engine)
DROP POLICY IF EXISTS "Clients can insert own alerts" ON public.alerts;
CREATE POLICY "Clients can insert own alerts"
ON public.alerts FOR INSERT TO authenticated
WITH CHECK (client_id = public.get_client_id_from_auth());

-- 4. FIX TANK UPDATE CONCURRENCY
-- ============================================================================

-- Add a locking mechanism or ensure the update function uses a row lock
CREATE OR REPLACE FUNCTION public.update_tank_state()
RETURNS TRIGGER AS $$
BEGIN
    -- Use a row lock to prevent race conditions during concurrent readings
    -- This ensures that only one process updates the tank's volume/level at a time
    PERFORM 1 FROM public.tanks WHERE id = NEW.tank_id FOR UPDATE;

    UPDATE public.tanks
    SET 
        current_volume = NEW.ambient_volume,
        current_temperature = NEW.temperature,
        last_reading_at = NEW.timestamp,
        updated_at = now()
    WHERE id = NEW.tank_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. STRENGTHEN RPC INPUT VALIDATION
-- ============================================================================

-- Example: Add validation to process_payment to prevent overflow or extreme values
-- (Assuming the function already exists, we redefine it with more checks)
CREATE OR REPLACE FUNCTION public.process_payment(
  p_client_id UUID,
  p_amount DECIMAL,
  p_payment_method TEXT,
  p_payment_reference TEXT,
  p_description TEXT DEFAULT 'Payment received'
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_transaction_id UUID;
  v_supabase_uid UUID;
  v_current_debt DECIMAL;
  v_caller_uid UUID := auth.uid();
BEGIN
  -- Authentication check
  IF v_caller_uid IS NULL THEN RAISE EXCEPTION 'Unauthenticated'; END IF;

  -- Authorization check: Caller must own the client_id OR be an admin_helper or higher
  IF NOT (
    EXISTS (SELECT 1 FROM public.client_billing WHERE id = p_client_id AND supabase_uid = v_caller_uid)
    OR public.is_admin() -- Use unified is_admin()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Access denied to client_billing record';
  END IF;

  -- Validation: Amount must be positive and reasonable
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be positive'; END IF;
  IF p_amount > 1000000 THEN RAISE EXCEPTION 'Payment amount exceeds maximum limit for single transaction'; END IF;

  SELECT cb.current_debt, cb.supabase_uid
  INTO v_current_debt, v_supabase_uid
  FROM public.client_billing cb WHERE cb.id = p_client_id;

  IF v_current_debt IS NULL THEN RAISE EXCEPTION 'Client not found'; END IF;

  IF p_amount > v_current_debt THEN
    RAISE EXCEPTION 'Payment amount % exceeds current debt %', p_amount, v_current_debt;
  END IF;

  UPDATE public.client_billing
  SET current_debt = ROUND((current_debt - p_amount)::NUMERIC, 2),
      total_paid = ROUND((total_paid + p_amount)::NUMERIC, 2),
      last_payment_date = NOW(),
      updated_at = NOW(),
      account_status = CASE WHEN (current_debt - p_amount) <= 0.01 THEN 'active' ELSE account_status END
  WHERE id = p_client_id;

  INSERT INTO public.transactions (
    client_id, supabase_uid, transaction_type, amount, description,
    payment_method, payment_reference, payment_status, completed_at
  ) VALUES (
    p_client_id, v_supabase_uid, 'payment', p_amount, LEFT(p_description, 255),
    p_payment_method, p_payment_reference, 'completed', NOW()
  ) RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

-- 6. REFRESH SCHEMA CACHE
-- ============================================================================
NOTIFY pgrst, 'reload schema';
