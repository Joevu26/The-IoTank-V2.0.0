-- supabase/migrations/20260403000000_final_security_hardening_audit.sql
-- ============================================================================
-- AUDIT FIXES: Final hardening for Authentication, Authorization, and Validation
-- ============================================================================

-- 1. HARDEN process_payment: Ensure caller owns the client_id or is a super_admin
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
    OR public.is_system_admin('admin_helper')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Access denied to client_billing record';
  END IF;

  -- Validation: Amount must be positive
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be positive'; END IF;

  SELECT cb.current_debt, cb.supabase_uid
  INTO v_current_debt, v_supabase_uid
  FROM public.client_billing cb WHERE cb.id = p_client_id;

  IF v_current_debt IS NULL THEN RAISE EXCEPTION 'Client not found'; END IF;

  IF p_amount > v_current_debt THEN
    RAISE EXCEPTION 'Payment amount % exceeds current debt %', p_amount, v_current_debt;
  END IF;

  UPDATE public.client_billing
  SET current_debt = current_debt - p_amount,
      total_paid = total_paid + p_amount,
      last_payment_date = NOW(),
      updated_at = NOW(),
      account_status = CASE WHEN (current_debt - p_amount) <= 0 THEN 'active' ELSE account_status END
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

-- 2. HARDEN get_client_dashboard_summary: Ensure p_supabase_uid == auth.uid() or admin
CREATE OR REPLACE FUNCTION public.get_client_dashboard_summary(p_supabase_uid UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE 
  v_summary JSON;
  v_caller_uid UUID := auth.uid();
BEGIN
  -- Authorization check
  IF v_caller_uid IS NULL THEN RAISE EXCEPTION 'Unauthenticated'; END IF;
  
  IF v_caller_uid <> p_supabase_uid AND NOT public.is_system_admin('analyst') THEN
    RAISE EXCEPTION 'Unauthorized: Access denied to other user''s dashboard';
  END IF;

  SELECT json_build_object(
    'billing', (
      SELECT json_build_object(
        'current_debt', cb.current_debt,
        'total_paid', cb.total_paid,
        'subscription_tier', cb.subscription_tier,
        'account_status', cb.account_status,
        'next_billing_date', cb.next_billing_date
      ) FROM public.client_billing cb WHERE cb.supabase_uid = p_supabase_uid
    ),
    'tanks', (
      SELECT json_agg(
        json_build_object(
          'id', t.id, 'name', t.tank_name, 'fuel_type', t.fuel_type,
          'current_volume', t.current_volume, 'capacity', t.tank_capacity,
          'fill_percentage', ROUND((t.current_volume / NULLIF(t.tank_capacity, 0) * 100)::NUMERIC, 2),
          'temperature', t.current_temperature, 'status', t.status
        )
      ) FROM public.tanks t WHERE t.supabase_uid = p_supabase_uid AND t.status = 'active'
    ),
    'unread_alerts', (
      SELECT COUNT(*) FROM public.alerts a
      WHERE a.supabase_uid = p_supabase_uid AND a.is_read = FALSE
    ),
    'critical_alerts', (
      SELECT COUNT(*) FROM public.alerts a
      WHERE a.supabase_uid = p_supabase_uid AND a.is_read = FALSE AND a.severity = 'critical'
    )
  ) INTO v_summary;
  RETURN v_summary;
END;
$$;

-- 3. HARDEN repair_my_identity: Ensure email in JWT is verified before linking
CREATE OR REPLACE FUNCTION public.repair_my_identity()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_email TEXT;
    v_uid UUID;
    v_email_verified BOOLEAN;
    v_updated BOOLEAN := FALSE;
BEGIN
    v_uid := auth.uid();
    v_email := LOWER(TRIM(auth.jwt() ->> 'email'));
    v_email_verified := (auth.jwt() ->> 'email_verified')::BOOLEAN;
    
    -- Security Check: Do not link if email is NULL or NOT verified (prevent impersonation)
    IF v_uid IS NULL OR v_email IS NULL OR v_email_verified IS NOT TRUE THEN
        RETURN FALSE;
    END IF;

    -- Link profile if not linked and emails match
    UPDATE public.profiles 
    SET supabase_uid = v_uid
    WHERE supabase_uid IS NULL AND LOWER(TRIM(email)) = v_email;
    
    IF FOUND THEN v_updated := TRUE; END IF;

    -- Link system user if not linked and emails match
    UPDATE public.system_users 
    SET supabase_uid = v_uid
    WHERE supabase_uid IS NULL AND LOWER(TRIM(email)) = v_email;

    IF FOUND THEN v_updated := TRUE; END IF;

    RETURN v_updated;
END;
$$;

-- 4. ADDITIONAL INPUT VALIDATION: Site IDs and Roles
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS chk_valid_role,
  ADD CONSTRAINT chk_valid_role CHECK (role IN ('admin', 'supervisor', 'operator', 'viewer'));

ALTER TABLE public.system_users
  DROP CONSTRAINT IF EXISTS chk_valid_system_role,
  ADD CONSTRAINT chk_valid_system_role CHECK (role IN ('super_admin', 'admin_helper', 'support_staff', 'analyst'));

-- 5. ENSURE RLS FOR ALL RECENT TABLES
-- Verify that new tables like usage_logs or market_bookmarks have RLS enabled if they don't.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'usage_logs') THEN
    ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'market_bookmarks') THEN
    ALTER TABLE public.market_bookmarks ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
