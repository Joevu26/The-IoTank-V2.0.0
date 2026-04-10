-- supabase/migrations/20260409001800_resolve_ambiguity_definitive.sql
-- ============================================================================
-- DEFINITIVE SYSTEM RESOLUTION: Function ambiguity and Schema Alignment
-- ============================================================================
-- This migration resolves the 'is_system_admin' ambiguity by migrating all 
-- dependent policies to the standardized text signature.
-- ============================================================================

-- 1. DROP ALL DEPENDENT POLICIES (To allow function removal)
-- ============================================================================
DO $$ 
BEGIN
    -- fuel_stations
    DROP POLICY IF EXISTS "Authorized admins can update organization billing" ON public.fuel_stations;
    -- audit_logs
    DROP POLICY IF EXISTS "Clients can view own audit logs" ON public.audit_logs;
    -- tanks
    DROP POLICY IF EXISTS "Tenant isolation" ON public.tanks;
    -- transactions
    DROP POLICY IF EXISTS "Tenant isolation" ON public.transactions;
    -- alerts
    DROP POLICY IF EXISTS "Tenant isolation" ON public.alerts;
    -- deliveries
    DROP POLICY IF EXISTS "Tenant isolation" ON public.deliveries;
    -- fuel_transactions
    DROP POLICY IF EXISTS "Tenant isolation" ON public.fuel_transactions;
    -- reports
    DROP POLICY IF EXISTS "Tenant isolation" ON public.reports;
    -- team_member_requests
    DROP POLICY IF EXISTS "Tenant isolation" ON public.team_member_requests;
    DROP POLICY IF EXISTS "Users can view own team requests" ON public.team_member_requests;
    -- pending_registrations
    DROP POLICY IF EXISTS "System admins can view all pending registrations" ON public.pending_registrations;
    
    -- sites
    DROP POLICY IF EXISTS "Users can view own sites" ON public.sites;
    DROP POLICY IF EXISTS "Users can create own sites" ON public.sites;
    DROP POLICY IF EXISTS "Users can update own sites" ON public.sites;
    DROP POLICY IF EXISTS "Users can delete own sites" ON public.sites;
END $$;


-- 2. RESOLVE AMBIGUITY: Drop ONLY the legacy integer version
-- The text version is in use by many newer policies and is our definitive version.
DO $$ 
BEGIN
    DROP FUNCTION IF EXISTS public.is_system_admin(INTEGER);
END $$;


-- 3. RE-ESTABLISH: Definitive is_system_admin (V2.0.0)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_system_admin(minimum_role TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_active BOOLEAN;
  v_role_order INT;
  v_required_order INT;
BEGIN
  IF v_uid IS NULL THEN RETURN FALSE; END IF;

  SELECT role, is_active INTO v_role, v_active
  FROM public.system_users
  WHERE auth_user_id = v_uid;

  IF v_role IS NULL OR NOT v_active THEN RETURN FALSE; END IF;
  IF minimum_role IS NULL THEN RETURN TRUE; END IF;

  -- HIERARCHY
  v_role_order := CASE v_role
    WHEN 'super_admin'   THEN 1
    WHEN 'admin_helper'  THEN 2
    WHEN 'support_staff' THEN 3
    WHEN 'analyst'       THEN 4
    ELSE 99
  END;

  v_required_order := CASE minimum_role
    WHEN 'super_admin'   THEN 1
    WHEN 'admin_helper'  THEN 2
    WHEN 'support_staff' THEN 3
    WHEN 'analyst'       THEN 4
    ELSE 99
  END;

  RETURN v_role_order <= v_required_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;


-- 4. MIGRATE POLICIES: Restore with Standardized Signature
-- ============================================================================

-- fuel_stations
CREATE POLICY "Authorized admins can update organization billing" ON public.fuel_stations FOR UPDATE
USING (((id = get_user_station_id()) AND (get_auth_level() <= 6)) OR is_system_admin('support_staff'::text));

-- audit_logs
-- Level 2 corresponds to admin_helper
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'audit_logs' AND schemaname = 'public') THEN
        CREATE POLICY "Clients can view own audit logs" ON public.audit_logs FOR SELECT
        USING ((station_id = get_user_station_id()) OR is_system_admin('admin_helper'::text));
    END IF;
END $$;

-- tanks
CREATE POLICY "Tenant isolation" ON public.tanks FOR ALL
USING ((station_id = get_user_station_id()) OR is_system_admin('support_staff'::text));

-- transactions
CREATE POLICY "Tenant isolation" ON public.transactions FOR ALL
USING ((station_id = get_user_station_id()) OR is_system_admin('support_staff'::text));

-- alerts
CREATE POLICY "Tenant isolation" ON public.alerts FOR ALL
USING ((station_id = get_user_station_id()) OR is_system_admin('support_staff'::text));

-- deliveries
CREATE POLICY "Tenant isolation" ON public.deliveries FOR ALL
USING ((station_id = get_user_station_id()) OR is_system_admin('support_staff'::text));

-- fuel_transactions
CREATE POLICY "Tenant isolation" ON public.fuel_transactions FOR ALL
USING ((station_id = get_user_station_id()) OR is_system_admin('support_staff'::text));

-- reports
CREATE POLICY "Tenant isolation" ON public.reports FOR ALL
USING ((station_id = get_user_station_id()) OR is_system_admin('support_staff'::text));

-- team_member_requests
CREATE POLICY "Tenant isolation" ON public.team_member_requests FOR ALL
USING ((station_id = get_user_station_id()) OR is_system_admin('support_staff'::text));

CREATE POLICY "Users can view own team requests" ON public.team_member_requests FOR SELECT
USING ((station_id = get_user_station_id()) OR (auth_user_id = auth.uid()) OR is_system_admin('support_staff'::text));

-- pending_registrations
CREATE POLICY "System admins can view all pending registrations" ON public.pending_registrations FOR SELECT
USING (is_system_admin('support_staff'::text));


-- 5. FINAL REPAIR: sites table re-standardization
-- ============================================================================
DO $$ 
BEGIN
    -- Rename supabase_uid to auth_user_id if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'supabase_uid') THEN
        ALTER TABLE public.sites RENAME COLUMN supabase_uid TO auth_user_id;
    END IF;

    -- Add auth_user_id if still missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'auth_user_id') THEN
        ALTER TABLE public.sites ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    -- Rename name to site_name if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'name') THEN
        ALTER TABLE public.sites RENAME COLUMN name TO site_name;
    END IF;

    -- Ensure uniqueness for provisioning
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sites_station_site_name_v2') THEN
        CREATE UNIQUE INDEX idx_sites_station_site_name_v2 ON public.sites(station_id, site_name);
    END IF;
END $$;

-- sites Policies (Definitive)
CREATE POLICY "Users can view own sites" ON public.sites FOR SELECT
USING (station_id = get_user_station_id() OR is_system_admin(NULL::text));

CREATE POLICY "Users can create own sites" ON public.sites FOR INSERT
WITH CHECK (station_id = get_user_station_id() OR is_system_admin(NULL::text));

CREATE POLICY "Users can update own sites" ON public.sites FOR UPDATE
USING (station_id = get_user_station_id() OR is_system_admin(NULL::text));

CREATE POLICY "Users can delete own sites" ON public.sites FOR DELETE
USING (station_id = get_user_station_id() OR is_system_admin(NULL::text));


-- 6. RELOAD PostgREST
-- ============================================================================
NOTIFY pgrst, 'reload schema';
