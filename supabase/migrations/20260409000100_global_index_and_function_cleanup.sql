-- supabase/migrations/20260409000100_global_index_and_function_cleanup.sql
-- ============================================================================
-- GLOBAL CLEANUP: Rename remaining legacy indices and update functions
-- ============================================================================

DO $$ 
DECLARE
    t TEXT;
    c TEXT;
BEGIN
    -- 1. Rename Indices
    -- reports
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_reports_client' AND tablename = 'reports') THEN
        ALTER INDEX public.idx_reports_client RENAME TO idx_reports_station;
    END IF;

    -- team_member_requests
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tmr_client_id' AND tablename = 'team_member_requests') THEN
        ALTER INDEX public.idx_tmr_client_id RENAME TO idx_tmr_station_id;
    END IF;

    -- data_access_logs
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_data_access_logs_client_id' AND tablename = 'data_access_logs') THEN
        ALTER INDEX public.idx_data_access_logs_client_id RENAME TO idx_data_access_logs_station_id;
    END IF;

    -- event_logs
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_event_logs_client_created' AND tablename = 'event_logs') THEN
        ALTER INDEX public.idx_event_logs_client_created RENAME TO idx_event_logs_station_created;
    END IF;

    -- fuel_stations (formerly client_billing)
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_client_billing_supabase_uid' AND tablename = 'fuel_stations') THEN
        ALTER INDEX public.idx_client_billing_supabase_uid RENAME TO idx_fuel_stations_supabase_uid;
    END IF;

    -- 2. Global Station ID Rename (Standardizing Tenant Identifier)
    -- ========================================================================
    -- Core & Profiles
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'client_id') THEN
        ALTER TABLE public.profiles RENAME COLUMN client_id TO station_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'client_id') THEN
        ALTER TABLE public.sites RENAME COLUMN client_id TO station_id;
    END IF;

    -- Operational Tables
    FOREACH t IN ARRAY ARRAY['tanks', 'transactions', 'alerts', 'deliveries', 'fuel_transactions', 'reports', 'team_member_requests', 'audit_logs', 'shift_closures', 'devices', 'support_tickets', 'telemetry_history', 'file_uploads', 'analysis_history', 'usage_logs', 'ai_recommendations', 'event_logs', 'registration_events', 'data_access_logs']
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'client_id') THEN
            EXECUTE format('ALTER TABLE public.%I RENAME COLUMN client_id TO station_id', t);
        END IF;
    END LOOP;

    -- 3. Sensor Readings Simplification (Volume, Temp, RSSI ONLY)
    -- ========================================================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sensor_readings' AND table_schema = 'public') THEN
        -- Rename existing columns to standard names if needed
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sensor_readings' AND column_name = 'ambient_volume') THEN
            ALTER TABLE public.sensor_readings RENAME COLUMN ambient_volume TO volume;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sensor_readings' AND column_name = 'signal_strength') THEN
            ALTER TABLE public.sensor_readings RENAME COLUMN signal_strength TO rssi;
        END IF;
        
        -- Add 'volume' and 'rssi' if they don't exist yet (safety)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sensor_readings' AND column_name = 'volume') THEN
            ALTER TABLE public.sensor_readings ADD COLUMN volume DECIMAL(10,2);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sensor_readings' AND column_name = 'rssi') THEN
            ALTER TABLE public.sensor_readings ADD COLUMN rssi INTEGER;
        END IF;

        -- Ensure 'temperature' exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sensor_readings' AND column_name = 'temperature') THEN
            ALTER TABLE public.sensor_readings ADD COLUMN temperature DECIMAL(5,2);
        END IF;

        -- Drop ALL legacy/redundant columns
        FOREACH c IN ARRAY ARRAY['raw_distance', 'corrected_distance', 'standard_volume', 'fill_percentage', 'reading_quality', 'error_code']
        LOOP
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sensor_readings' AND column_name = c) THEN
                EXECUTE format('ALTER TABLE public.sensor_readings DROP COLUMN %I CASCADE', c);
            END IF;
        END LOOP;

        -- Update constraints
        ALTER TABLE public.sensor_readings DROP CONSTRAINT IF EXISTS check_ambient_volume_non_negative;
        ALTER TABLE public.sensor_readings DROP CONSTRAINT IF EXISTS check_standard_volume_non_negative;
        ALTER TABLE public.sensor_readings DROP CONSTRAINT IF EXISTS check_volume_non_negative;
        ALTER TABLE public.sensor_readings ADD CONSTRAINT check_volume_non_negative CHECK (volume >= 0);
    END IF;

END $$;

-- 2. Update Functions with legacy parameter names
-- ============================================================================

-- A. process_payment
DROP FUNCTION IF EXISTS public.process_payment(UUID, DECIMAL, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.process_payment(
  p_station_id UUID,        -- Renamed from p_client_id
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
  IF v_caller_uid IS NULL THEN RAISE EXCEPTION 'Unauthenticated'; END IF;

  -- Authorization check: Caller must own the station OR be an admin
  IF NOT (
    EXISTS (SELECT 1 FROM public.fuel_stations WHERE id = p_station_id AND owner_id = v_caller_uid)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Access denied to fuel_stations record';
  END IF;

  IF p_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be positive'; END IF;

  -- Fetch the latest volume reading using the new simplified column name
  SELECT fs.current_debt, (SELECT auth_user_id FROM profiles WHERE station_id = p_station_id LIMIT 1)
  INTO v_current_debt, v_supabase_uid
  FROM public.fuel_stations fs WHERE fs.id = p_station_id;

  IF v_current_debt IS NULL THEN RAISE EXCEPTION 'Station not found'; END IF;

  UPDATE public.fuel_stations
  SET current_debt = ROUND((current_debt - p_amount)::NUMERIC, 2),
      total_paid = ROUND((total_paid + p_amount)::NUMERIC, 2),
      last_payment_date = NOW(),
      updated_at = NOW(),
      account_status = CASE WHEN (current_debt - p_amount) <= 0.01 THEN 'active' ELSE account_status END
  WHERE id = p_station_id;

  INSERT INTO public.transactions (
    station_id, auth_user_id, transaction_type, amount, description,
    payment_method, payment_reference, payment_status, completed_at
  ) VALUES (
    p_station_id, v_supabase_uid, 'payment', p_amount, LEFT(p_description, 255),
    p_payment_method, p_payment_reference, 'completed', NOW()
  ) RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

-- B. get_user_client_id -> get_user_station_id
DROP FUNCTION IF EXISTS public.get_user_client_id() CASCADE;
CREATE OR REPLACE FUNCTION public.get_user_station_id()
RETURNS UUID
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_station_id UUID;
BEGIN
  -- Updated to use auth_user_id and station_id
  SELECT station_id INTO v_station_id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1;
  RETURN v_station_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Cleanup Legacy Aliases
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_client_id_from_auth() CASCADE;
DROP FUNCTION IF EXISTS public.admin_adjust_client_debt(UUID, DECIMAL, TEXT);
DROP FUNCTION IF EXISTS public.admin_suspend_client(UUID, TEXT);

-- Final instruction for PostgREST
NOTIFY pgrst, 'reload schema';
