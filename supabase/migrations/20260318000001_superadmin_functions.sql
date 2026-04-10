-- supabase/migrations/20260318000001_superadmin_functions.sql
-- ============================================================================
-- SUPER ADMIN FUNCTIONS - SECURE ACTIONS
-- ============================================================================

-- Function 1: Securely adjust a client's debt
-- This guarantees the transaction logs, the debt change, and the admin log happen atomically.
CREATE OR REPLACE FUNCTION admin_adjust_client_debt(
  p_client_id UUID,
  p_adjustment_amount DECIMAL,
  p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_uid TEXT;
  v_system_user_id UUID;
  v_old_debt DECIMAL;
  v_new_debt DECIMAL;
  v_transaction_id UUID;
BEGIN
  -- 1. Identify and verify the admin
  v_admin_uid := auth.uid()::text;
  
  SELECT id INTO v_system_user_id
  FROM system_users
  WHERE firebase_uid = v_admin_uid
    AND is_active = TRUE
    AND role IN ('super_admin', 'admin_helper');

  IF v_system_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Only active Super Admins and Admin Helpers can adjust debt.';
  END IF;

  -- 2. Fetch current client data
  SELECT current_debt INTO v_old_debt
  FROM client_billing
  WHERE id = p_client_id;

  IF v_old_debt IS NULL THEN
    RAISE EXCEPTION 'Client not found.';
  END IF;

  -- 3. Calculate new debt
  v_new_debt := v_old_debt + p_adjustment_amount;
  IF v_new_debt < 0 THEN
    v_new_debt := 0; -- Floor at exactly 0
  END IF;

  -- 4. Update the client_billing table
  UPDATE client_billing
  SET current_debt = v_new_debt,
      updated_at = NOW()
  WHERE id = p_client_id;

  -- 5. Record the financial transaction
  INSERT INTO transactions (
    client_id, 
    firebase_uid, 
    transaction_type, 
    amount, 
    description, 
    payment_status,
    created_by
  )
  SELECT 
    p_client_id, 
    firebase_uid, 
    'adjustment', 
    ABS(p_adjustment_amount), 
    p_reason, 
    'completed',
    v_admin_uid
  FROM client_billing WHERE id = p_client_id
  RETURNING id INTO v_transaction_id;

  -- 6. Record in system admin_logs for audit
  INSERT INTO admin_logs (
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

  -- 7. Return success standard
  RETURN jsonb_build_object(
    'success', true,
    'old_debt', v_old_debt,
    'new_debt', v_new_debt
  );
END;
$$;

-- Function 2: Suspend a client account
CREATE OR REPLACE FUNCTION admin_suspend_client(
  p_client_id UUID,
  p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_uid TEXT;
  v_system_user_id UUID;
  v_old_status TEXT;
BEGIN
  -- 1. Identify and verify the admin
  v_admin_uid := auth.uid()::text;
  
  SELECT id INTO v_system_user_id
  FROM system_users
  WHERE firebase_uid = v_admin_uid
    AND is_active = TRUE
    AND role IN ('super_admin', 'admin_helper');

  IF v_system_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admins and Admin Helpers can suspend accounts.';
  END IF;

  -- 2. Update client_billing account tracking
  SELECT account_status INTO v_old_status FROM client_billing WHERE id = p_client_id;
  
  UPDATE client_billing
  SET account_status = 'suspended',
      suspension_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_client_id;

  -- 3. Audit trail
  INSERT INTO admin_logs (
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
$$;
