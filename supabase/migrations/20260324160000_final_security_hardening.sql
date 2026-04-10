-- supabase/migrations/20260324160000_final_security_hardening.sql

-- 1. DROP FIREBASE DEPENDENCIES WITH CASCADE
ALTER TABLE IF EXISTS public.system_users DROP COLUMN IF EXISTS firebase_uid CASCADE;
ALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS firebase_uid CASCADE;

-- 2. DROP EXISTING FUNCTIONS TO AVOID SIGNATURE CONFLICTS
DROP FUNCTION IF EXISTS public.is_system_admin(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.is_system_admin(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.get_auth_level() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_client_id() CASCADE;

-- 3. RE-DEFINE CORE FUNCTIONS (SUPABASE ONLY)
CREATE OR REPLACE FUNCTION public.firebase_uid()
RETURNS TEXT AS $$
BEGIN
  RETURN auth.uid()::TEXT;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

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
  -- 1. Check system_users (Levels 1-4)
  SELECT role INTO sys_role 
  FROM system_users 
  WHERE supabase_uid = n_uid 
  AND is_active = TRUE
  LIMIT 1;
  
  IF sys_role IS NOT NULL THEN
    CASE sys_role
      WHEN 'super_admin' THEN RETURN 1;
      WHEN 'admin_helper' THEN RETURN 2;
      WHEN 'support_staff' THEN RETURN 3;
      WHEN 'analyst' THEN RETURN 4;
      ELSE RETURN 99;
    END CASE;
  END IF;

  -- 2. Check profiles (Levels 5-8)
  SELECT role INTO prof_role 
  FROM profiles 
  WHERE supabase_uid = n_uid
  LIMIT 1;
  
  IF prof_role IS NOT NULL THEN
    CASE prof_role
      WHEN 'owner' THEN RETURN 5;
      WHEN 'supervisor' THEN RETURN 6;
      WHEN 'operator' THEN RETURN 7;
      WHEN 'viewer' THEN RETURN 8;
      ELSE RETURN 99;
    END CASE;
  END IF;

  RETURN 99;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_system_admin(required_level INTEGER)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN public.get_auth_level() <= required_level;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.is_system_admin(required_role TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
  v_req_order INT;
  v_role_order INT;
BEGIN
  SELECT role INTO v_role FROM system_users WHERE supabase_uid = auth.uid() AND is_active = TRUE;
  
  v_role_order := CASE v_role
    WHEN 'super_admin'   THEN 4
    WHEN 'admin_helper'  THEN 3
    WHEN 'support_staff' THEN 2
    WHEN 'analyst'       THEN 1
    ELSE 0
  END;

  v_req_order := CASE required_role
    WHEN 'super_admin'   THEN 4
    WHEN 'admin_helper'  THEN 3
    WHEN 'support_staff' THEN 2
    WHEN 'analyst'       THEN 1
    ELSE 0
  END;

  RETURN v_role_order >= v_req_order;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS UUID
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_client_id UUID;
BEGIN
  SELECT client_id INTO v_client_id FROM profiles WHERE supabase_uid = auth.uid() LIMIT 1;
  RETURN v_client_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. RE-APPLY HARDENED RLS POLICIES FOR ALL TABLES
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super Admins can manage all users" ON public.system_users;
CREATE POLICY "Super Admins can manage all users" ON public.system_users FOR ALL TO authenticated USING (public.is_system_admin('super_admin'));
DROP POLICY IF EXISTS "System users can read their own identity" ON public.system_users;
CREATE POLICY "System users can read their own identity" ON public.system_users FOR SELECT TO authenticated USING (supabase_uid = auth.uid());

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
CREATE POLICY "Users can read their own profile" ON public.profiles FOR SELECT TO authenticated USING (supabase_uid = auth.uid() OR public.is_system_admin(4));
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (supabase_uid = auth.uid());

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['alerts', 'analysis_history', 'audit_logs', 'deliveries', 'file_uploads', 'market_signals', 'raw_market_data', 'regulatory_notices', 'sensor_readings', 'shift_closures', 'tanks', 'usage_logs', 'support_tickets'])
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "Tenant isolation" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Tenant isolation" ON public.%I FOR ALL TO authenticated USING (client_id = public.get_user_client_id() OR public.is_system_admin(3))', t);
    END LOOP;
END $$;

ALTER TABLE public.telemetry_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Telemetry tenant access" ON public.telemetry_history;
CREATE POLICY "Telemetry tenant access" ON public.telemetry_history FOR SELECT TO authenticated
USING (
  device_id IN (SELECT id FROM public.devices WHERE client_id = public.get_user_client_id())
  OR public.is_system_admin(4)
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Device tenant access" ON public.devices;
CREATE POLICY "Device tenant access" ON public.devices FOR ALL TO authenticated
USING (client_id = public.get_user_client_id() OR public.is_system_admin(3));

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own preferences" ON public.user_preferences;
CREATE POLICY "Users manage own preferences" ON public.user_preferences FOR ALL TO authenticated
USING (user_id IN (SELECT id FROM public.profiles WHERE supabase_uid = auth.uid()));

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super admins only logs" ON public.admin_logs;
CREATE POLICY "Super admins only logs" ON public.admin_logs FOR ALL TO authenticated
USING (public.is_system_admin(1));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (supabase_uid, email, display_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'viewer');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
