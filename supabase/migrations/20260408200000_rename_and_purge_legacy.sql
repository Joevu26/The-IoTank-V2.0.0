-- supabase/migrations/20260408200000_rename_and_purge_legacy.sql
-- ============================================================================
-- CORE INFRASTRUCTURE REFACTOR: Station-Centric Renaming & Legacy Purge
-- ============================================================================
-- 1. Rename 'client_billing' to 'fuel_stations'
-- 2. Rename all 'client_id' columns to 'station_id'
-- 3. Drop all legacy 'firebase_uid' columns
-- 4. Update core security functions and RLS policies
-- ============================================================================

DO $$ 
BEGIN
    -- 1. Rename Tables
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_billing' AND table_schema = 'public') THEN
        ALTER TABLE public.client_billing RENAME TO fuel_stations;
        -- Ensure fuel_stations has a link to the auth user who owns it
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_stations' AND column_name = 'owner_id') THEN
            ALTER TABLE public.fuel_stations ADD COLUMN owner_id UUID REFERENCES auth.users(id);
        END IF;
    END IF;

    -- 2. Rename affected_client_id in admin_logs
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_logs' AND column_name = 'affected_client_id') THEN
        ALTER TABLE public.admin_logs RENAME COLUMN affected_client_id TO affected_station_id;
    END IF;
    
    -- 3. DROP old tank_readings if it exists as either table or view to prevent collision
    DROP VIEW IF EXISTS public.tank_readings;
    DROP TABLE IF EXISTS public.tank_readings;

    -- 4. Rename client_id to station_id across all tables
    -- profiles
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'client_id') THEN
        ALTER TABLE public.profiles RENAME COLUMN client_id TO station_id;
    END IF;
    
    -- sites
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'client_id') THEN
        ALTER TABLE public.sites RENAME COLUMN client_id TO station_id;
    END IF;
    
    -- tanks
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tanks' AND column_name = 'client_id') THEN
        ALTER TABLE public.tanks RENAME COLUMN client_id TO station_id;
    END IF;
    
    -- sensor_readings
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sensor_readings' AND column_name = 'client_id') THEN
        ALTER TABLE public.sensor_readings RENAME COLUMN client_id TO station_id;
    END IF;
    
    -- alerts
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alerts' AND column_name = 'client_id') THEN
        ALTER TABLE public.alerts RENAME COLUMN client_id TO station_id;
    END IF;
    
    -- deliveries
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'client_id') THEN
        ALTER TABLE public.deliveries RENAME COLUMN client_id TO station_id;
    END IF;
    
    -- transactions
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'client_id') THEN
        ALTER TABLE public.transactions RENAME COLUMN client_id TO station_id;
    END IF;
    
    -- usage_logs
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usage_logs' AND column_name = 'client_id') THEN
        ALTER TABLE public.usage_logs RENAME COLUMN client_id TO station_id;
    END IF;
    
    -- ai_recommendations
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_recommendations' AND column_name = 'client_id') THEN
        ALTER TABLE public.ai_recommendations RENAME COLUMN client_id TO station_id;
    END IF;
    
    -- team_member_requests
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_member_requests' AND column_name = 'client_id') THEN
        ALTER TABLE public.team_member_requests RENAME COLUMN client_id TO station_id;
    END IF;
    
    -- event_logs
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_logs' AND column_name = 'client_id') THEN
        ALTER TABLE public.event_logs RENAME COLUMN client_id TO station_id;
    END IF;

    -- reports
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'client_id') THEN
        ALTER TABLE public.reports RENAME COLUMN client_id TO station_id;
    END IF;

    -- shift_closures
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shift_closures' AND column_name = 'client_id') THEN
        ALTER TABLE public.shift_closures RENAME COLUMN client_id TO station_id;
    END IF;

    -- devices (Hardware)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'client_id') THEN
        ALTER TABLE public.devices RENAME COLUMN client_id TO station_id;
    END IF;

    -- support_tickets
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'support_tickets' AND column_name = 'client_id') THEN
        ALTER TABLE public.support_tickets RENAME COLUMN client_id TO station_id;
    END IF;

    -- telemetry_history
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'telemetry_history' AND column_name = 'client_id') THEN
        ALTER TABLE public.telemetry_history RENAME COLUMN client_id TO station_id;
    END IF;

    -- file_uploads
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'file_uploads' AND column_name = 'client_id') THEN
        ALTER TABLE public.file_uploads RENAME COLUMN client_id TO station_id;
    END IF;

    -- analysis_history
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analysis_history' AND column_name = 'client_id') THEN
        ALTER TABLE public.analysis_history RENAME COLUMN client_id TO station_id;
    END IF;

    -- security_telemetry_events
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_telemetry_events' AND column_name = 'client_id') THEN
        ALTER TABLE public.security_telemetry_events RENAME COLUMN client_id TO station_id;
    END IF;

    -- 5. Purge remaining firebase_uid columns
    ALTER TABLE public.fuel_stations DROP COLUMN IF EXISTS firebase_uid;
    ALTER TABLE public.profiles DROP COLUMN IF EXISTS firebase_uid;
    ALTER TABLE public.tanks DROP COLUMN IF EXISTS firebase_uid;
    ALTER TABLE public.alerts DROP COLUMN IF EXISTS firebase_uid;
    ALTER TABLE public.deliveries DROP COLUMN IF EXISTS firebase_uid;
    ALTER TABLE public.usage_logs DROP COLUMN IF EXISTS firebase_uid;
    ALTER TABLE public.transactions DROP COLUMN IF EXISTS firebase_uid;
    ALTER TABLE public.team_member_requests DROP COLUMN IF EXISTS firebase_uid;

END $$;

-- 6. Update Core Security Functions
-- ============================================================================

-- 6. Update Core Security Functions
-- ============================================================================

-- Create the new function first
CREATE OR REPLACE FUNCTION public.get_station_id_from_auth()
RETURNS UUID AS $$
DECLARE
    v_station_id UUID;
BEGIN
    SELECT station_id INTO v_station_id
    FROM public.profiles
    WHERE supabase_uid = auth.uid();
    
    RETURN v_station_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop dependent policies before dropping the old function
-- We use a DO block to safely drop policies that might not exist or were already renamed
DO $$ 
BEGIN
    -- Drop policies from ALL tables mentioned in the dependency error
    -- AI Recommendations
    DROP POLICY IF EXISTS "Users can update own recommendation actions" ON public.ai_recommendations;
    
    -- Tanks
    DROP POLICY IF EXISTS "Users can view own tanks" ON public.tanks;
    DROP POLICY IF EXISTS "Users can create own tanks" ON public.tanks;
    DROP POLICY IF EXISTS "Users can update own tanks" ON public.tanks;
    DROP POLICY IF EXISTS "Users can delete own tanks" ON public.tanks;
    DROP POLICY IF EXISTS "Tenant isolation for tanks" ON public.tanks;
    
    -- Sites
    DROP POLICY IF EXISTS "Users can view own sites" ON public.sites;
    DROP POLICY IF EXISTS "Users can create own sites" ON public.sites;
    DROP POLICY IF EXISTS "Users can update own sites" ON public.sites;
    DROP POLICY IF EXISTS "Users can delete own sites" ON public.sites;
    
    -- Alerts
    DROP POLICY IF EXISTS "Users can view own alerts" ON public.alerts;
    DROP POLICY IF EXISTS "Users can update own alerts" ON public.alerts;
    DROP POLICY IF EXISTS "Clients can insert own alerts" ON public.alerts;
    
    -- Files & Analysis
    DROP POLICY IF EXISTS "Users can manage their own file uploads" ON public.file_uploads;
    DROP POLICY IF EXISTS "Users can view analysis for their files" ON public.analysis_history;
    
    -- Operations
    DROP POLICY IF EXISTS "Users can manage shifts in their organization" ON public.shift_closures;
    DROP POLICY IF EXISTS "Tenant isolation for deliveries" ON public.deliveries;
    DROP POLICY IF EXISTS "Tenant isolation for sensor_readings" ON public.sensor_readings;
    DROP POLICY IF EXISTS "Users can view own sensor readings" ON public.sensor_readings;
    
    -- Support
    DROP POLICY IF EXISTS "Users can view own tickets" ON public.support_tickets;
    DROP POLICY IF EXISTS "Users can create tickets" ON public.support_tickets;
    
    -- Telemetry & Logs
    DROP POLICY IF EXISTS "Users can view own telemetry history" ON public.telemetry_history;
    DROP POLICY IF EXISTS "Users can view own security events" ON public.security_telemetry_events;
    DROP POLICY IF EXISTS "Tenant isolation for event_logs" ON public.event_logs;
    DROP POLICY IF EXISTS "Tenant isolation for usage_logs" ON public.usage_logs;
    DROP POLICY IF EXISTS "Tenant isolation for reports" ON public.reports;
    
    -- Profiles & Teams
    DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
    DROP POLICY IF EXISTS "client_can_insert_own_requests" ON public.team_member_requests;
    
    -- Devices
    DROP POLICY IF EXISTS "Clients view own devices" ON public.devices;
    
    -- Billing
    DROP POLICY IF EXISTS "Users can see own billing" ON public.fuel_stations;

END $$;

-- Now safe to drop the old function
DROP FUNCTION IF EXISTS public.get_client_id_from_auth();

-- 7. Re-create RLS Policies with station_id and get_station_id_from_auth()
-- ============================================================================

-- TANKS
CREATE POLICY "Users can view own tanks" ON public.tanks FOR SELECT
USING (station_id = get_station_id_from_auth() OR is_admin());

CREATE POLICY "Users can create own tanks" ON public.tanks FOR INSERT
WITH CHECK (station_id = get_station_id_from_auth() OR is_admin());

CREATE POLICY "Users can update own tanks" ON public.tanks FOR UPDATE
USING (station_id = get_station_id_from_auth() OR is_admin());

CREATE POLICY "Users can delete own tanks" ON public.tanks FOR DELETE
USING (station_id = get_station_id_from_auth() OR is_admin());

-- SITES
CREATE POLICY "Users can view own sites" ON public.sites FOR SELECT
USING (station_id = get_station_id_from_auth() OR is_admin());

CREATE POLICY "Users can create own sites" ON public.sites FOR INSERT
WITH CHECK (station_id = get_station_id_from_auth() OR is_admin());

-- SENSOR READINGS
CREATE POLICY "Users can view own sensor readings" ON public.sensor_readings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tanks
    WHERE tanks.id = sensor_readings.tank_id 
    AND (tanks.station_id = get_station_id_from_auth() OR is_admin())
  )
);

-- FUEL STATIONS
ALTER TABLE public.fuel_stations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see own station info" ON public.fuel_stations FOR SELECT
USING (id = get_station_id_from_auth() OR is_admin());

-- PROFILES
CREATE POLICY "Users can read their own profile" ON public.profiles FOR SELECT
USING (supabase_uid = auth.uid());

-- DELIVERIES
CREATE POLICY "Tenant isolation for deliveries" ON public.deliveries FOR ALL
USING (station_id = get_station_id_from_auth() OR is_admin());

-- ALERTS
CREATE POLICY "Users can view own alerts" ON public.alerts FOR SELECT
USING (station_id = get_station_id_from_auth() OR is_admin());

-- SHIFT CLOSURES
CREATE POLICY "Users can manage shifts in their station" ON public.shift_closures FOR ALL
USING (station_id = get_station_id_from_auth() OR is_admin());

-- EVENT LOGS
CREATE POLICY "Tenant isolation for event_logs" ON public.event_logs FOR SELECT
USING (station_id = get_station_id_from_auth() OR is_admin());

-- 8. Re-create Views
-- ============================================================================
CREATE VIEW public.tank_readings WITH (security_invoker = true) AS SELECT * FROM public.sensor_readings;

-- 9. Update Dashboard Summary RPC
-- ============================================================================
DROP FUNCTION IF EXISTS get_client_dashboard_summary(UUID);
DROP FUNCTION IF EXISTS get_client_dashboard_summary(text);

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
      ) FROM public.fuel_stations fs WHERE fs.id = p_station_id
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

-- 10. Update Admin Action RPCs
-- ============================================================================

-- Function 1: Securely adjust a station's debt
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
  -- 1. Identify and verify the admin
  v_admin_uid := auth.uid();
  
  SELECT id INTO v_system_user_id
  FROM system_users
  WHERE supabase_uid = v_admin_uid
    AND is_active = TRUE
    AND role IN ('super_admin', 'admin_helper');

  IF v_system_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Only active Super Admins and Admin Helpers can adjust debt.';
  END IF;

  -- 2. Fetch current station data
  SELECT current_debt INTO v_old_debt
  FROM fuel_stations
  WHERE id = p_station_id;

  IF v_old_debt IS NULL THEN
    RAISE EXCEPTION 'Station not found.';
  END IF;

  -- 3. Calculate new debt
  v_new_debt := v_old_debt + p_adjustment_amount;
  IF v_new_debt < 0 THEN
    v_new_debt := 0; -- Floor at exactly 0
  END IF;

  -- 4. Update the fuel_stations table
  UPDATE fuel_stations
  SET current_debt = v_new_debt,
      updated_at = NOW()
  WHERE id = p_station_id;

  -- 5. Record the financial transaction
  INSERT INTO transactions (
    station_id, 
    transaction_type, 
    amount, 
    description, 
    payment_status,
    created_by
  ) VALUES (
    p_station_id, 
    'adjustment', 
    ABS(p_adjustment_amount), 
    p_reason, 
    'completed',
    v_admin_uid::text
  ) RETURNING id INTO v_transaction_id;

  -- 6. Record in system admin_logs for audit
  INSERT INTO admin_logs (
    system_user_id,
    supabase_uid,
    action_type,
    affected_station_id,
    description,
    changes_made
  ) VALUES (
    v_system_user_id,
    v_admin_uid,
    'debt_adjusted',
    p_station_id,
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

-- Function 2: Suspend a station account
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
  -- 1. Identify and verify the admin
  v_admin_uid := auth.uid();
  
  SELECT id INTO v_system_user_id
  FROM system_users
  WHERE supabase_uid = v_admin_uid
    AND is_active = TRUE
    AND role IN ('super_admin', 'admin_helper');

  IF v_system_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admins and Admin Helpers can suspend accounts.';
  END IF;

  -- 2. Update fuel_stations account tracking
  SELECT account_status INTO v_old_status FROM fuel_stations WHERE id = p_station_id;
  
  UPDATE fuel_stations
  SET account_status = 'suspended',
      suspension_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_station_id;

  -- 3. Audit trail
  INSERT INTO admin_logs (
    system_user_id,
    supabase_uid,
    action_type,
    affected_station_id,
    description,
    changes_made
  ) VALUES (
    v_system_user_id,
    v_admin_uid,
    'station_suspended',
    p_station_id,
    'Suspended station account. Reason: ' || p_reason,
    jsonb_build_object('before_status', v_old_status, 'after_status', 'suspended')
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 10. Cleanup Stale Legacy Helpers
DROP FUNCTION IF EXISTS public.firebase_uid();
DROP FUNCTION IF EXISTS public.admin_adjust_client_debt(UUID, DECIMAL, TEXT);
DROP FUNCTION IF EXISTS public.admin_suspend_client(UUID, TEXT);
