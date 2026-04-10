-- supabase/migrations/20260325000000_security_remediation.sql
-- ============================================================================
-- SECURITY REMEDIATION: Fix Profile Escalation & Admin Visibility
-- ============================================================================

-- 1. HARDEN PROFILE UPDATES
-- Users should NOT be able to change their own role or client_id
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles 
FOR UPDATE TO authenticated 
USING (supabase_uid = auth.uid())
WITH CHECK (
  supabase_uid = auth.uid() 
  AND (
    -- Prevent changing role OR client_id unless the user is already a Super Admin
    (role = (SELECT role FROM public.profiles WHERE supabase_uid = auth.uid()) OR public.is_system_admin(1))
    AND (client_id = (SELECT client_id FROM public.profiles WHERE supabase_uid = auth.uid()) OR public.is_system_admin(1))
  )
);

-- Note: The above policy is slightly recursive. A cleaner way is using a trigger.
-- Let's use a trigger for maximum safety.
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow the service_role (used by Edge Functions) to bypass these checks
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- If not a super_admin (Level 1), block changes to privilege fields
  IF public.get_auth_level() > 1 THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.role := OLD.role;
    END IF;
    IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
      NEW.client_id := OLD.client_id;
    END IF;
    IF NEW.supabase_uid IS DISTINCT FROM OLD.supabase_uid THEN
      NEW.supabase_uid := OLD.supabase_uid;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_protect_profile_fields ON public.profiles;
CREATE TRIGGER tr_protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();


-- 2. RESTRICT PROFILE VISIBILITY
-- Level 4 (Analysts) and below (5-8) should only see profiles in their own organization.
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
CREATE POLICY "Users can read their own profile" ON public.profiles 
FOR SELECT TO authenticated 
USING (
  supabase_uid = auth.uid() 
  OR public.is_system_admin(3) -- Support Staff and above can see all
  OR (client_id = public.get_user_client_id()) -- Users can see members of their own org
);


-- 3. FIX BROKEN ADMIN FUNCTIONS
-- Update functions to use supabase_uid since firebase_uid was dropped from system_users
CREATE OR REPLACE FUNCTION admin_adjust_client_debt(
  p_client_id UUID,
  p_adjustment_amount DECIMAL,
  p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_uid UUID := auth.uid();
  v_system_user_id UUID;
  v_old_debt DECIMAL;
  v_new_debt DECIMAL;
  v_transaction_id UUID;
BEGIN
  -- Identify and verify the admin using supabase_uid
  SELECT id INTO v_system_user_id
  FROM system_users
  WHERE supabase_uid = v_admin_uid
    AND is_active = TRUE
    AND role IN ('super_admin', 'admin_helper');

  IF v_system_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Only active Super Admins and Admin Helpers can adjust debt.';
  END IF;

  SELECT current_debt INTO v_old_debt FROM client_billing WHERE id = p_client_id;
  IF v_old_debt IS NULL THEN RAISE EXCEPTION 'Client not found.'; END IF;

  v_new_debt := v_old_debt + p_adjustment_amount;
  IF v_new_debt < 0 THEN v_new_debt := 0; END IF;

  UPDATE client_billing SET current_debt = v_new_debt, updated_at = NOW() WHERE id = p_client_id;

  INSERT INTO transactions (client_id, transaction_type, amount, description, payment_status, created_by)
  VALUES (p_client_id, 'adjustment', ABS(p_adjustment_amount), p_reason, 'completed', v_admin_uid::text)
  RETURNING id INTO v_transaction_id;

  INSERT INTO admin_logs (system_user_id, action_type, affected_client_id, description, changes_made)
  VALUES (v_system_user_id, 'debt_adjusted', p_client_id, 'Manually adjusted debt: ' || p_reason, 
    jsonb_build_object('before', v_old_debt, 'after', v_new_debt, 'transaction_id', v_transaction_id));

  RETURN jsonb_build_object('success', true, 'new_debt', v_new_debt);
END;
$$;

CREATE OR REPLACE FUNCTION admin_suspend_client(
  p_client_id UUID,
  p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_uid UUID := auth.uid();
  v_system_user_id UUID;
  v_old_status TEXT;
BEGIN
  SELECT id INTO v_system_user_id
  FROM system_users
  WHERE supabase_uid = v_admin_uid
    AND is_active = TRUE
    AND role IN ('super_admin', 'admin_helper');

  IF v_system_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admins and Admin Helpers can suspend accounts.';
  END IF;

  SELECT account_status INTO v_old_status FROM client_billing WHERE id = p_client_id;
  
  UPDATE client_billing
  SET account_status = 'suspended', suspension_reason = p_reason, updated_at = NOW()
  WHERE id = p_client_id;

  INSERT INTO admin_logs (system_user_id, action_type, affected_client_id, description, changes_made)
  VALUES (v_system_user_id, 'client_suspended', p_client_id, 'Suspended account: ' || p_reason,
    jsonb_build_object('before_status', v_old_status, 'after_status', 'suspended'));

  RETURN jsonb_build_object('success', true);
END;
$$;


-- 4. REINFORCE AUDIT LOG INTEGRITY
-- Ensure client_id in audit_logs always matches get_user_client_id() for non-admins
CREATE OR REPLACE FUNCTION public.stamp_audit_log_client()
RETURNS TRIGGER AS $$
BEGIN
  -- For regular users (Level 4+), always force their own client_id
  IF public.get_auth_level() >= 4 THEN
    NEW.client_id := public.get_user_client_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_stamp_audit_log_client ON public.audit_logs;
CREATE TRIGGER tr_stamp_audit_log_client
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.stamp_audit_log_client();
