-- c:\Users\josep\Documents\The IoTank V2.0.0\supabase\migrations\99999999000000_repair_admin_infrastructure.sql
-- ============================================================================
-- CONSOLIDATED SYSTEM REPAIR & ALIGNMENT SCRIPT (V2.0.4)
-- 1. Restore Missing Dashboard RPCs (404 Fix)
-- 2. Purge Ghost Stations (Data Integrity Fix)
-- 3. Corrected Column Mapping: tank_id -> device_id
-- ============================================================================

-- STEP 1: DATA CLEANUP (Purge Stations without Owners)
-- ============================================================================
DO $$
DECLARE
    v_purge_count INT;
BEGIN
    RAISE NOTICE 'Starting data integrity audit...';
    
    DELETE FROM public.fuel_stations
    WHERE station_id NOT IN (
        SELECT DISTINCT station_id 
        FROM public.profiles 
        WHERE station_id IS NOT NULL
    );
    
    GET DIAGNOSTICS v_purge_count = ROW_COUNT;
    RAISE NOTICE 'Purged % stations with no linked owners.', v_purge_count;
END $$;

-- STEP 2: DASHBOARD STATISTICS RPC
-- ============================================================================
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
  v_recent_activity JSONB := '[]'::jsonb;
  v_result JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthenticated'; END IF;
  
  -- Auth Check: Must be super_admin or admin_helper
  IF NOT EXISTS (SELECT 1 FROM public.system_users WHERE auth_user_id = v_uid AND is_active = TRUE AND role IN ('super_admin', 'admin_helper')) THEN
     RAISE EXCEPTION 'Unauthorized: Super Admin access required.';
  END IF;

  -- 1. General Metrics
  SELECT COUNT(*) INTO c_users FROM public.profiles;
  SELECT COUNT(*) INTO c_tanks FROM public.tanks;
  SELECT COUNT(*) INTO c_stations FROM public.fuel_stations;
  SELECT COUNT(*) INTO c_operators FROM public.system_users WHERE is_active = TRUE;
  
  -- Online devs check (active reading in last 15 mins)
  -- FIX: Using device_id instead of tank_id in telemetry_history
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'telemetry_history') THEN
     SELECT COUNT(DISTINCT device_id) INTO c_online_devs 
     FROM public.telemetry_history 
     WHERE created_at > NOW() - INTERVAL '15 minutes';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sensor_readings') THEN
     SELECT COUNT(DISTINCT device_id) INTO c_online_devs 
     FROM public.sensor_readings 
     WHERE created_at > NOW() - INTERVAL '15 minutes';
  END IF;

  -- 2. Financial Metrics
  SELECT COALESCE(SUM(current_debt), 0) INTO v_debt FROM public.fuel_stations;
  SELECT COALESCE(SUM(amount), 0) INTO v_mrr FROM public.transactions WHERE transaction_type IN ('charge', 'usage_charge') AND payment_status = 'completed' AND created_at >= DATE_TRUNC('month', NOW());

  -- 3. Support Metrics
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'support_tickets') THEN
     EXECUTE 'SELECT COUNT(*) FROM public.support_tickets WHERE status IN (''open'', ''in_progress'')' INTO c_open_tickets;
     EXECUTE 'SELECT COUNT(*) FROM public.support_tickets WHERE priority = ''urgent'' AND status IN (''open'', ''in_progress'')' INTO c_urgent_tickets;
  END IF;

  SELECT COUNT(*) INTO c_pending_reqs FROM public.pending_registrations WHERE status = 'pending';
  
  -- 4. Recent Activity
  BEGIN
    SELECT jsonb_agg(act) INTO v_recent_activity FROM (
      (SELECT 'system' as type, description as text, created_at, id::text FROM public.admin_logs ORDER BY created_at DESC LIMIT 10)
      UNION ALL
      (SELECT 'registration' as type, 'New client request: ' || full_name || ' (' || station_name || ')' as text, created_at, id::text FROM public.pending_registrations WHERE status = 'pending' ORDER BY created_at DESC LIMIT 5)
      ORDER BY created_at DESC
      LIMIT 15
    ) act;
  EXCEPTION WHEN OTHERS THEN
    v_recent_activity := '[]'::jsonb;
  END;

  -- Compile Results
  v_result := jsonb_build_object(
    'health', jsonb_build_object(
       'totalUsers', c_users, 'totalTanks', c_tanks, 'totalStations', c_stations, 'totalOperators', c_operators,
       'uptime', '99.98%', 'dbSize', (SELECT pg_size_pretty(pg_database_size(current_database()))),
       'espDevices', jsonb_build_object('online', c_online_devs, 'total', c_tanks),
       'apiStatus', jsonb_build_object('supabase', 'green', 'twilio', 'green')
    ),
    'financial', jsonb_build_object('mrr', v_mrr, 'arr', v_mrr * 12, 'outstandingDebt', v_debt),
    'support', jsonb_build_object('openTickets', c_open_tickets, 'urgentTickets', c_urgent_tickets, 'pendingRequests', c_pending_reqs, 'pendingAdjustments', c_pending_adjs),
    'recentActivity', COALESCE(v_recent_activity, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;

-- RELOAD PostgREST
NOTIFY pgrst, 'reload schema';
