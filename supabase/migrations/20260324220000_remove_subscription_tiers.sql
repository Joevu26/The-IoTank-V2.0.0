-- supabase/migrations/20260324220000_remove_subscription_tiers.sql
-- ============================================================================
-- REMOVE SUBSCRIPTION TIERS: Moving to a fixed $25 monthly fee model.
-- This migration drops the subscription_tier column and simplifies billing.
-- ============================================================================

-- 1. DROP COLUMN FROM client_billing
ALTER TABLE public.client_billing DROP COLUMN IF EXISTS subscription_tier CASCADE;

-- 2. UPDATE RPC FUNCTION
CREATE OR REPLACE FUNCTION get_client_dashboard_summary(p_supabase_uid UUID)
RETURNS JSON AS $$
DECLARE v_summary JSON;
BEGIN
  SELECT json_build_object(
    'billing', (
      SELECT json_build_object(
        'current_debt', cb.current_debt,
        'total_paid', cb.total_paid,
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
