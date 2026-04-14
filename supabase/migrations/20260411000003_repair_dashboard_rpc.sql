-- supabase/migrations/20260411000003_repair_dashboard_rpc.sql
-- ============================================================================
-- RPC REPAIR: Fix 'id' to 'station_id' mapping in fuel_stations
-- ============================================================================

-- 1. get_station_dashboard_summary
CREATE OR REPLACE FUNCTION get_station_dashboard_summary(p_station_id UUID)
RETURNS JSON AS $$
DECLARE v_summary JSON;
BEGIN
  SELECT json_build_object(
    'station', (
      SELECT json_build_object(
        'current_debt', fs.current_debt,
        'total_paid', fs.total_paid,
        'account_status', fs.account_status,
        'next_billing_date', fs.next_billing_date
      ) FROM public.fuel_stations fs WHERE fs.station_id = p_station_id  -- FIXED
    ),
    'tanks', (
      SELECT json_agg(
        json_build_object(
          'id', t.id, 'name', t.tank_name, 'fuel_type', t.fuel_type,
          'current_volume', t.current_volume, 'capacity', t.tank_capacity,
          'fill_percentage', ROUND((t.current_volume / NULLIF(t.tank_capacity, 0) * 100)::NUMERIC, 2),
          'temperature', t.current_temperature, 'status', t.status
        )
      ) FROM public.tanks t WHERE t.station_id = p_station_id AND t.status = 'active'
    ),
    'unread_alerts', (
      SELECT COUNT(*) FROM public.alerts a
      WHERE a.station_id = p_station_id AND a.is_read = FALSE
    ),
    'critical_alerts', (
      SELECT COUNT(*) FROM public.alerts a
      WHERE a.station_id = p_station_id AND a.is_read = FALSE AND a.severity = 'critical'
    )
  ) INTO v_summary;
  RETURN v_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. admin_adjust_station_debt
CREATE OR REPLACE FUNCTION admin_adjust_station_debt(
  p_station_id UUID,
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
BEGIN
  v_admin_uid := auth.uid();
  SELECT id INTO v_system_user_id FROM system_users WHERE auth_user_id = v_admin_uid AND is_active = TRUE AND role IN ('super_admin', 'admin_helper');

  IF v_system_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT current_debt INTO v_old_debt FROM fuel_stations WHERE station_id = p_station_id; -- FIXED

  IF v_old_debt IS NULL THEN
    RAISE EXCEPTION 'Station not found.';
  END IF;

  v_new_debt := v_old_debt + p_adjustment_amount;
  IF v_new_debt < 0 THEN v_new_debt := 0; END IF;

  UPDATE fuel_stations SET current_debt = v_new_debt, updated_at = NOW() WHERE station_id = p_station_id; -- FIXED

  INSERT INTO transactions (station_id, transaction_type, amount, description, payment_status, created_by)
  VALUES (p_station_id, 'adjustment', ABS(p_adjustment_amount), p_reason, 'completed', v_admin_uid::text)
  RETURNING id INTO v_transaction_id;

  INSERT INTO admin_logs (system_user_id, auth_user_id, action_type, affected_station_id, description, changes_made)
  VALUES (v_system_user_id, v_admin_uid, 'debt_adjusted', p_station_id, 'Manually adjusted debt: ' || p_reason, 
          jsonb_build_object('before', jsonb_build_object('current_debt', v_old_debt), 'after', jsonb_build_object('current_debt', v_new_debt)));

  RETURN jsonb_build_object('success', true, 'old_debt', v_old_debt, 'new_debt', v_new_debt);
END;
$$;

-- 3. admin_suspend_station
CREATE OR REPLACE FUNCTION admin_suspend_station(
  p_station_id UUID,
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
  SELECT id INTO v_system_user_id FROM system_users WHERE auth_user_id = v_admin_uid AND is_active = TRUE AND role IN ('super_admin', 'admin_helper');

  IF v_system_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT account_status INTO v_old_status FROM fuel_stations WHERE station_id = p_station_id; -- FIXED
  
  UPDATE fuel_stations
  SET account_status = 'suspended',
      suspension_reason = p_reason,
      updated_at = NOW()
  WHERE station_id = p_station_id; -- FIXED

  INSERT INTO admin_logs (system_user_id, auth_user_id, action_type, affected_station_id, description, changes_made)
  VALUES (v_system_user_id, v_admin_uid, 'station_suspended', p_station_id, 'Suspended station account. Reason: ' || p_reason, 
          jsonb_build_object('before_status', v_old_status, 'after_status', 'suspended'));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. RELOAD SCHEMA
NOTIFY pgrst, 'reload schema';
