-- supabase/migrations/20260417000002_admin_client_tools.sql
-- ============================================================================
-- FEATURE: Administrative Client Management Tools
-- ============================================================================

-- 1. admin_record_external_payment
CREATE OR REPLACE FUNCTION public.admin_record_external_payment(
  p_station_id UUID,
  p_amount DECIMAL,
  p_method TEXT,
  p_reference TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_uid UUID;
  v_system_user_id UUID;
  v_old_debt DECIMAL;
  v_new_debt DECIMAL;
  v_old_paid DECIMAL;
  v_new_paid DECIMAL;
  v_transaction_id UUID;
BEGIN
  v_admin_uid := auth.uid();
  SELECT id INTO v_system_user_id FROM system_users WHERE auth_user_id = v_admin_uid AND is_active = TRUE AND role IN ('super_admin', 'admin_helper');

  IF v_system_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT current_debt, total_paid INTO v_old_debt, v_old_paid FROM fuel_stations WHERE station_id = p_station_id;
  
  IF v_old_debt IS NULL THEN RAISE EXCEPTION 'Station not found.'; END IF;

  v_new_debt := v_old_debt - p_amount;
  IF v_new_debt < 0 THEN v_new_debt := 0; END IF;
  
  v_new_paid := v_old_paid + p_amount;

  -- Update station
  UPDATE fuel_stations 
  SET current_debt = v_new_debt, 
      total_paid = v_new_paid,
      updated_at = NOW() 
  WHERE station_id = p_station_id;

  -- Record transaction
  INSERT INTO transactions (station_id, transaction_type, amount, description, payment_status, created_by)
  VALUES (p_station_id, 'payment', p_amount, 'External Payment via ' || p_method || ' (Ref: ' || p_reference || ')', 'completed', v_admin_uid::text)
  RETURNING id INTO v_transaction_id;

  -- Audit log
  INSERT INTO admin_logs (system_user_id, auth_user_id, action_type, affected_station_id, description, detail_json)
  VALUES (v_system_user_id, v_admin_uid, 'payment_recorded', p_station_id, 'Recorded external payment of ' || p_amount || ' via ' || p_method, 
          jsonb_build_object('amount', p_amount, 'method', p_method, 'reference', p_reference, 'transaction_id', v_transaction_id));

  RETURN jsonb_build_object('success', true, 'new_debt', v_new_debt, 'new_paid', v_new_paid);
END;
$$;

-- 2. admin_update_station_profile
CREATE OR REPLACE FUNCTION public.admin_update_station_profile(
  p_station_id UUID,
  p_updates JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_uid UUID;
  v_system_user_id UUID;
BEGIN
  v_admin_uid := auth.uid();
  SELECT id INTO v_system_user_id FROM system_users WHERE auth_user_id = v_admin_uid AND is_active = TRUE AND role IN ('super_admin', 'admin_helper');

  IF v_system_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  UPDATE fuel_stations
  SET 
    station_name = COALESCE((p_updates->>'station_name'), station_name),
    email = COALESCE((p_updates->>'email'), email),
    phone = COALESCE((p_updates->>'phone'), phone),
    station_location = COALESCE((p_updates->>'station_location'), station_location),
    county = COALESCE((p_updates->>'county'), county),
    updated_at = NOW()
  WHERE station_id = p_station_id;

  INSERT INTO admin_logs (system_user_id, auth_user_id, action_type, affected_station_id, description, detail_json)
  VALUES (v_system_user_id, v_admin_uid, 'profile_updated', p_station_id, 'Updated station profile metadata', p_updates);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. admin_reactivate_station
CREATE OR REPLACE FUNCTION public.admin_reactivate_station(
  p_station_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_uid UUID;
  v_system_user_id UUID;
BEGIN
  v_admin_uid := auth.uid();
  SELECT id INTO v_system_user_id FROM system_users WHERE auth_user_id = v_admin_uid AND is_active = TRUE AND role IN ('super_admin', 'admin_helper');

  IF v_system_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  UPDATE fuel_stations
  SET account_status = 'active',
      suspension_reason = NULL,
      updated_at = NOW()
  WHERE station_id = p_station_id;

  INSERT INTO admin_logs (system_user_id, auth_user_id, action_type, affected_station_id, description)
  VALUES (v_system_user_id, v_admin_uid, 'station_reactivated', p_station_id, 'Reactivated station account');

  RETURN jsonb_build_object('success', true);
END;
$$;
