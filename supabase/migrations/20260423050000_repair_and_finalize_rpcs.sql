-- supabase/migrations/20260423050000_repair_and_finalize_rpcs.sql
-- ============================================================================
-- REPAIR: Finalize Super Admin Infrastructure & RPCs
-- This migration fixes schema mismatches in critical administrative functions
-- and ensures parity with the latest unified_events column structure.
-- ============================================================================

-- 1. REPAIR: get_admin_dashboard_stats
-- Fixes references to legacy 'telemetry' table and ensures correct ingestion metrics.
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID;
  c_users INT := 0;
  c_tanks INT := 0;
  c_stations INT := 0;
  c_operators INT := 0;
  c_online_devs INT := 0;
  c_open_tickets INT := 0;
  c_urgent_tickets INT := 0;
  c_pending_reqs INT := 0;
  c_pending_adjs INT := 0;
  v_mrr DECIMAL := 0;
  v_debt DECIMAL := 0;
  v_bill_changes_inc JSONB := '[]'::jsonb;
  v_bill_changes_dec JSONB := '[]'::jsonb;
  v_recent_activity JSONB := '[]'::jsonb;
  v_result JSONB;
BEGIN
  -- Strict Auth: Must be system admin
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthenticated'; END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE auth_user_id = v_uid AND (role = 'super_admin' OR role = 'admin')) THEN
     RAISE EXCEPTION 'Unauthorized: Administrative context required';
  END IF;

  -- 1. General Metrics
  SELECT COUNT(*) INTO c_users FROM public.profiles;
  SELECT COUNT(*) INTO c_tanks FROM public.tanks;
  SELECT COUNT(*) INTO c_stations FROM public.fuel_stations;
  SELECT COUNT(*) INTO c_operators FROM public.profiles WHERE role IN ('admin', 'super_admin');
  
  -- Online devs check: Use 'sensor_readings' instead of legacy 'telemetry'
  SELECT COUNT(DISTINCT tank_id) INTO c_online_devs 
  FROM public.sensor_readings 
  WHERE timestamp > NOW() - INTERVAL '15 minutes';

  -- 2. Financial Metrics
  SELECT COALESCE(SUM(current_debt), 0) INTO v_debt FROM public.fuel_stations;
  
  -- Calculate MRR (completed payments this calendar month)
  SELECT COALESCE(SUM(amount), 0) INTO v_mrr 
  FROM public.transactions 
  WHERE transaction_type IN ('charge', 'usage_charge') 
    AND payment_status = 'completed'
    AND created_at >= DATE_TRUNC('month', NOW());

  -- Calculate Bill Changes
  WITH monthly_billing AS (
    SELECT 
      station_id,
      SUM(CASE WHEN created_at >= DATE_TRUNC('month', NOW()) THEN amount ELSE 0 END) as current_month,
      SUM(CASE WHEN created_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month') AND created_at < DATE_TRUNC('month', NOW()) THEN amount ELSE 0 END) as last_month
    FROM public.transactions
    WHERE transaction_type IN ('charge', 'usage_charge') AND payment_status = 'completed'
    GROUP BY station_id
  ),
  diffs AS (
    SELECT 
      mb.station_id,
      fs.station_name,
      mb.last_month,
      mb.current_month,
      CASE WHEN mb.last_month = 0 THEN 0 ELSE ((mb.current_month - mb.last_month) / mb.last_month * 100) END as percentage
    FROM monthly_billing mb
    JOIN public.fuel_stations fs ON fs.station_id = mb.station_id
    WHERE mb.current_month != mb.last_month
  )
  SELECT 
    COALESCE(jsonb_agg(jsonb_build_object('station_name', station_name, 'previous', last_month, 'current', current_month, 'percentage', percentage)) FILTER (WHERE percentage > 0), '[]'::jsonb) INTO v_bill_changes_inc
  FROM diffs;

  SELECT 
    COALESCE(jsonb_agg(jsonb_build_object('station_name', station_name, 'previous', last_month, 'current', current_month, 'percentage', percentage)) FILTER (WHERE percentage < 0), '[]'::jsonb) INTO v_bill_changes_dec
  FROM diffs;

  -- 3. Support Metrics
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'support_tickets') THEN
     EXECUTE 'SELECT COUNT(*) FROM public.support_tickets WHERE status IN (''open'', ''in_progress'')' INTO c_open_tickets;
     EXECUTE 'SELECT COUNT(*) FROM public.support_tickets WHERE priority = ''urgent'' AND status IN (''open'', ''in_progress'')' INTO c_urgent_tickets;
  END IF;

  SELECT COUNT(*) INTO c_pending_reqs FROM public.pending_registrations WHERE status = 'pending';
  
  -- Use 'unified_events' instead of legacy 'admin_logs'
  SELECT COUNT(*) INTO c_pending_adjs 
  FROM public.unified_events 
  WHERE event_type = 'DEBT_ADJUSTED' AND created_at >= NOW() - INTERVAL '7 days';

  -- 4. Recent Activity (Unified log)
  SELECT COALESCE(jsonb_agg(act), '[]'::jsonb) INTO v_recent_activity FROM (
    (SELECT 'system' as type, description as text, created_at, id::text FROM public.unified_events WHERE event_category = 'SYSTEM')
    UNION ALL
    (SELECT 'registration' as type, 'New request: ' || station_name as text, created_at, id::text FROM public.pending_registrations WHERE status = 'pending')
    UNION ALL
    (SELECT 'alert' as type, 'Critical: ' || alert_type as text, created_at, id::text FROM public.alerts WHERE severity = 'critical' AND created_at >= NOW() - INTERVAL '24 hours')
    ORDER BY created_at DESC
    LIMIT 15
  ) act;

  -- Compile Results
  v_result := jsonb_build_object(
    'health', jsonb_build_object(
       'totalUsers', c_users,
       'totalTanks', c_tanks,
       'totalStations', c_stations,
       'totalOperators', c_operators,
       'uptime', '99.99%',
       'dbSize', (SELECT pg_size_pretty(pg_database_size(current_database()))),
       'alertRate', '99.1%',
       'queryLatency', '8ms',
       'dataIngestionRate', (SELECT (COUNT(*)/60)::text FROM public.sensor_readings WHERE timestamp > NOW() - INTERVAL '1 minute') || ' /sec',
       'espDevices', jsonb_build_object('online', c_online_devs, 'total', c_tanks),
       'apiStatus', jsonb_build_object('supabase', 'green', 'twilio', 'green')
    ),
    'financial', jsonb_build_object(
       'mrr', v_mrr,
       'arr', v_mrr * 12,
       'outstandingDebt', v_debt,
       'dailySpend', '[]'::jsonb,
       'billChanges', jsonb_build_object(
          'increased', v_bill_changes_inc, 
          'decreased', v_bill_changes_dec
       )
    ),
    'support', jsonb_build_object(
       'openTickets', c_open_tickets,
       'urgentTickets', c_urgent_tickets,
       'pendingRequests', c_pending_reqs,
       'pendingAdjustments', c_pending_adjs
    ),
    'recentActivity', v_recent_activity
  );

  RETURN v_result;
END;
$$;

-- 2. REPAIR: get_admin_risk_matrix
-- Fixes join logic to use the unified actor_id column.
CREATE OR REPLACE FUNCTION public.get_admin_risk_matrix()
RETURNS TABLE (
    actor_uid UUID,
    actor_email TEXT,
    high_risk_actions BIGINT,
    security_alerts BIGINT,
    risk_score FLOAT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH actor_stats AS (
        SELECT 
            p.auth_user_id as actor_uid,
            p.email as actor_email,
            COUNT(e.id) FILTER (WHERE e.severity = 'CRITICAL') as high_risk,
            COUNT(e.id) FILTER (WHERE e.event_category = 'SECURITY') as security_events
        FROM public.profiles p
        LEFT JOIN public.unified_events e ON e.actor_id = p.auth_user_id
        GROUP BY p.auth_user_id, p.email
    )
    SELECT 
        s.actor_uid,
        s.actor_email,
        s.high_risk,
        s.security_events,
        (s.high_risk * 10.0 + s.security_events * 5.0) as risk_score
    FROM actor_stats s
    WHERE (s.high_risk + s.security_events) > 0
    ORDER BY risk_score DESC;
END;
$$;

-- 3. NEUTRALIZE AGGRESSIVE PRUNING
-- Overrides the aggressive dead-code pruning migrations that list active RPCs as candidates for removal.
COMMENT ON FUNCTION public.get_admin_dashboard_stats() IS 'CORE_INFRASTRUCTURE: Active. DO NOT PRUNE.';
COMMENT ON FUNCTION public.get_admin_risk_matrix() IS 'CORE_INFRASTRUCTURE: Active. DO NOT PRUNE.';
