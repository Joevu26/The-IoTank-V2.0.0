-- supabase/migrations/20260409000300_global_function_refactor.sql
-- ============================================================================
-- GLOBAL FUNCTION REFACTOR: Standardize on 'auth_user_id' and 'station_id'
-- Part 2: Functions, Triggers, and RLS Helpers
-- ============================================================================

-- 1. AUTH HELPERS
-- ============================================================================

-- get_auth_level
CREATE OR REPLACE FUNCTION public.get_auth_level()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  n_uid UUID := auth.uid();
  sys_role TEXT;
  prof_role TEXT;
BEGIN
  IF n_uid IS NULL THEN RETURN 99; END IF;

  -- 1. Check system_users
  SELECT role INTO sys_role FROM public.system_users WHERE auth_user_id = n_uid AND is_active = TRUE LIMIT 1;
  IF sys_role IS NOT NULL THEN
    RETURN CASE sys_role
      WHEN 'super_admin'   THEN 1
      WHEN 'admin_helper'  THEN 2
      WHEN 'support_staff' THEN 3
      WHEN 'analyst'       THEN 4
      ELSE 99
    END;
  END IF;

  -- 2. Check profiles
  SELECT role INTO prof_role FROM public.profiles WHERE auth_user_id = n_uid LIMIT 1;
  IF prof_role IS NOT NULL THEN
    RETURN CASE prof_role
      WHEN 'admin'      THEN 5
      WHEN 'owner'      THEN 5
      WHEN 'supervisor' THEN 6
      WHEN 'operator'   THEN 7
      WHEN 'viewer'     THEN 8
      ELSE 99
    END;
  END IF;

  RETURN 99;
END;
$$ LANGUAGE plpgsql;

-- is_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.system_users 
        WHERE auth_user_id = auth.uid()
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- is_system_admin
DROP FUNCTION IF EXISTS public.is_system_admin(INTEGER) CASCADE;
CREATE OR REPLACE FUNCTION public.is_system_admin(minimum_level INTEGER DEFAULT 3)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.get_auth_level() <= minimum_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. TENANT HELPERS
-- ============================================================================

-- get_station_id_from_auth
CREATE OR REPLACE FUNCTION public.get_station_id_from_auth()
RETURNS UUID AS $$
DECLARE
    v_station_id UUID;
BEGIN
    SELECT station_id INTO v_station_id
    FROM public.profiles
    WHERE auth_user_id = auth.uid();
    
    RETURN v_station_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. TRIGGER FUNCTIONS
-- ============================================================================

-- handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (auth_user_id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'viewer'
  )
  ON CONFLICT (email) DO UPDATE SET
    auth_user_id = EXCLUDED.auth_user_id,
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: Failed to create profile for %. Error: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- provision_approved_registration
CREATE OR REPLACE FUNCTION public.provision_approved_registration()
RETURNS TRIGGER AS $$
DECLARE
    v_fuel_station_id UUID;
BEGIN
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        
        IF NEW.approved_auth_user_id IS NULL THEN
            RETURN NEW;
        END IF;

        -- Create or get fuel_station record
        SELECT id INTO v_fuel_station_id 
        FROM public.fuel_stations 
        WHERE station_name = NEW.station_name 
        LIMIT 1;

        IF v_fuel_station_id IS NULL THEN
            INSERT INTO public.fuel_stations (
                station_name, created_at, email
            ) VALUES (
                NEW.station_name, NOW(), NEW.email
            ) RETURNING id INTO v_fuel_station_id;
        END IF;
        
        NEW.approved_station_id = v_fuel_station_id;
        NEW.approved_at = NOW();
        
        -- Create the owner profile
        INSERT INTO public.profiles (
            auth_user_id,
            email,
            display_name,
            station_id,
            role,
            created_at
        ) VALUES (
            NEW.approved_auth_user_id,
            NEW.email,
            NEW.full_name,
            v_fuel_station_id,
            'admin',
            NOW()
        );
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 4. UTILITY & MAINTENANCE
-- ============================================================================

-- repair_my_identity
CREATE OR REPLACE FUNCTION public.repair_my_identity()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_email TEXT;
    v_uid UUID;
BEGIN
    v_uid := auth.uid();
    v_email := LOWER(TRIM(auth.jwt() ->> 'email'));
    
    IF v_uid IS NULL OR v_email IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Link profile
    UPDATE public.profiles 
    SET auth_user_id = v_uid,
        updated_at = NOW()
    WHERE auth_user_id IS NULL 
      AND LOWER(TRIM(email)) = v_email;
    
    -- Link system user
    UPDATE public.system_users 
    SET auth_user_id = v_uid,
        updated_at = NOW()
    WHERE auth_user_id IS NULL 
      AND LOWER(TRIM(email)) = v_email;

    RETURN FOUND;
END;
$$;

-- 5. DECOMMISSION LEGACY (Final Cleanup)
-- ============================================================================
DROP FUNCTION IF EXISTS public.firebase_uid() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_client_id() CASCADE;
DROP FUNCTION IF EXISTS public.get_client_id_from_auth() CASCADE;

-- 6. RESTORE RLS POLICIES (Dropped by CASCADE in previous migration)
-- ============================================================================

-- fuel_stations (formerly client_billing)
DROP POLICY IF EXISTS "Authorized admins can update organization billing" ON public.fuel_stations;
CREATE POLICY "Authorized admins can update organization billing"
  ON public.fuel_stations FOR UPDATE
  TO authenticated
  USING (
    (id = public.get_station_id_from_auth() AND public.get_auth_level() <= 6)
    OR public.is_system_admin(3) -- support_staff (level 3)
  )
  WITH CHECK (
    (id = public.get_station_id_from_auth() AND public.get_auth_level() <= 6)
    OR public.is_system_admin(3)
  );

-- audit_logs
DROP POLICY IF EXISTS "Clients can view own audit logs" ON public.audit_logs;
CREATE POLICY "Clients can view own audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
    station_id = public.get_station_id_from_auth() OR
    public.is_system_admin(2) -- admin_helper (level 2) OR super_admin (level 1)
);

-- Operational Tables: Standard Tenant Isolation
-- Tables: tanks, transactions, alerts, deliveries, fuel_transactions, reports, team_member_requests
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY['tanks', 'transactions', 'alerts', 'deliveries', 'fuel_transactions', 'reports', 'team_member_requests'])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Tenant isolation" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Tenant isolation" ON public.%I FOR ALL TO authenticated USING (station_id = public.get_station_id_from_auth() OR public.is_system_admin(3))', t);
    END LOOP;
END $$;

-- 7. STANDARDIZED TELEMETRY LOGIC
-- ============================================================================

-- update_tank_state: Sync tank levels with simplified sensor_readings
CREATE OR REPLACE FUNCTION public.update_tank_state()
RETURNS TRIGGER AS $$
BEGIN
    -- Use a row lock to prevent race conditions during concurrent readings
    PERFORM 1 FROM public.tanks WHERE id = NEW.tank_id FOR UPDATE;

    UPDATE public.tanks
    SET 
        current_volume = NEW.volume,        -- Updated from ambient_volume
        current_temperature = NEW.temperature,
        last_reading_at = NEW.timestamp,
        updated_at = NOW()
    WHERE id = NEW.tank_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- get_station_dashboard_summary: Standardized for station_id
DROP FUNCTION IF EXISTS get_client_dashboard_summary(UUID);
DROP FUNCTION IF EXISTS get_station_dashboard_summary(UUID);

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

-- 8. Final notification for PostgREST
NOTIFY pgrst, 'reload schema';
