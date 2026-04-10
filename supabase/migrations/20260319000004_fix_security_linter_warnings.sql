-- supabase/migrations/20260319000004_fix_security_linter_warnings.sql
-- ============================================================================
-- SECURITY HOTFIX: Resolve Search Path Mutable Warnings (Lint 0011)
--
-- This migration re-declares the functions flagged by the Supabase Security Linter
-- with an explicit 'SET search_path = public' to prevent hijacking via 
-- mutable search paths in SECURITY DEFINER functions.
-- ============================================================================

-- 1. public.is_system_admin
CREATE OR REPLACE FUNCTION public.is_system_admin(required_level INTEGER DEFAULT 4)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Returns true if the user's level is less than or equal to the required system level (1-4)
  -- Note: Lower number = higher priority
  RETURN public.get_auth_level() <= required_level AND public.get_auth_level() > 0;
END;
$$ LANGUAGE plpgsql;

-- 2. public.has_client_access
CREATE OR REPLACE FUNCTION public.has_client_access(required_level INTEGER DEFAULT 7)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  u_level INTEGER := public.get_auth_level();
BEGIN
  -- System admins (1-4) have access to everything
  IF u_level <= 4 THEN
    RETURN TRUE;
  END IF;
  
  -- Client users (5-7) must have a level <= required
  RETURN u_level <= required_level;
END;
$$ LANGUAGE plpgsql;

-- 3. public.admin_adjust_client_debt
CREATE OR REPLACE FUNCTION public.admin_adjust_client_debt(
  p_client_id UUID,
  p_adjustment_amount DECIMAL,
  p_reason TEXT
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth
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

  IF v_old_debt IS NULL THEN
    RAISE EXCEPTION 'Client not found.';
  END IF;

  v_new_debt := GREATEST(0, v_old_debt + p_adjustment_amount);
  
  UPDATE public.client_billing
  SET current_debt = v_new_debt,
      updated_at = NOW()
  WHERE id = p_client_id;

  INSERT INTO public.transactions (
    client_id, 
    firebase_uid, 
    transaction_type, 
    amount, 
    description, 
    payment_status,
    created_by
  ) VALUES (
    p_client_id, 
    v_fb_uid, 
    'adjustment', 
    ABS(p_adjustment_amount), 
    p_reason, 
    'completed',
    v_admin_uid
  ) RETURNING id INTO v_transaction_id;

  INSERT INTO public.admin_logs (
    system_user_id,
    firebase_uid,
    action_type,
    affected_client_id,
    description,
    changes_made
  ) VALUES (
    v_system_user_id,
    v_admin_uid,
    'debt_adjusted',
    p_client_id,
    'Manually adjusted debt: ' || p_reason,
    jsonb_build_object(
      'before', jsonb_build_object('current_debt', v_old_debt),
      'after', jsonb_build_object('current_debt', v_new_debt),
      'transaction_id', v_transaction_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'old_debt', v_old_debt,
    'new_debt', v_new_debt
  );
END;
$$ LANGUAGE plpgsql;

-- 4. public.admin_suspend_client
CREATE OR REPLACE FUNCTION public.admin_suspend_client(
  p_client_id UUID,
  p_reason TEXT
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth
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

  SELECT account_status INTO v_old_status FROM public.client_billing WHERE id = p_client_id;
  
  UPDATE public.client_billing
  SET account_status = 'suspended',
      suspension_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_client_id;

  INSERT INTO public.admin_logs (
    system_user_id,
    firebase_uid,
    action_type,
    affected_client_id,
    description,
    changes_made
  ) VALUES (
    v_system_user_id,
    v_admin_uid,
    'client_suspended',
    p_client_id,
    'Suspended account. Reason: ' || p_reason,
    jsonb_build_object('before_status', v_old_status, 'after_status', 'suspended')
  );

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;
