-- supabase/migrations/20260405000004_identity_harmonization_fix.sql
-- ============================================================================
-- IDENTITY HARMONIZATION: Corrected Discovery Hub and Cleanup
-- ============================================================================

-- 1. DYNAMICALLY DISCOVER AND DROP ALL DEPENDENT POLICIES
-- ============================================================================
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    -- Search for all policies that reference 'supabase_uid' or 'firebase_uid' in their rules
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND (
            qual ILIKE '%supabase_uid%'
            OR with_check ILIKE '%supabase_uid%'
            OR qual ILIKE '%firebase_uid%'
            OR with_check ILIKE '%firebase_uid%'
            OR qual ILIKE '%auth.uid()%' -- Since it is compared to the column
        )
    ) LOOP
        RAISE NOTICE 'Dropping dependent policy % on table %', r.policyname, r.tablename;
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;


-- 2. HARMONIZE SYSTEM_USERS & PROFILES (Execute UUID Upgrade)
-- ============================================================================
DO $$ BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_users' AND column_name='supabase_uid') THEN
        ALTER TABLE public.system_users ALTER COLUMN supabase_uid TYPE UUID USING (supabase_uid::UUID);
    END IF;
END $$;

DO $$ BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='supabase_uid') THEN
        ALTER TABLE public.profiles ALTER COLUMN supabase_uid TYPE UUID USING (supabase_uid::UUID);
    END IF;
END $$;


-- 3. RE-CREATE HELPER FUNCTIONS (Update first so policies can use them)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.system_users 
        WHERE supabase_uid = auth.uid()
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_client_id_from_auth()
RETURNS UUID AS $$
DECLARE
    v_client_id UUID;
BEGIN
    SELECT client_id INTO v_client_id
    FROM public.profiles
    WHERE supabase_uid = auth.uid();
    
    RETURN v_client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 4. RE-APPLY FOUNDATIONAL POLICIES (Native UUID Support)
-- ============================================================================

-- SYSTEM USERS
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "System users can read their own profile" ON public.system_users;
CREATE POLICY "System users can read their own profile"
  ON public.system_users FOR SELECT TO authenticated
  USING (supabase_uid = auth.uid() OR LOWER(email) = LOWER(auth.jwt()->>'email'));

DROP POLICY IF EXISTS "System users can update their own profile" ON public.system_users;
CREATE POLICY "System users can update their own profile"
  ON public.system_users FOR UPDATE TO authenticated
  USING (supabase_uid = auth.uid())
  WITH CHECK (supabase_uid = auth.uid());

DROP POLICY IF EXISTS "Super Admins can manage all users" ON public.system_users;
CREATE POLICY "Super Admins can manage all users" 
  ON public.system_users FOR ALL TO authenticated 
  USING (public.is_admin());

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
CREATE POLICY "Users can read their own profile" 
  ON public.profiles FOR SELECT TO authenticated 
  USING (supabase_uid = auth.uid() OR (client_id = public.get_client_id_from_auth()) OR public.is_admin());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE TO authenticated 
  USING (supabase_uid = auth.uid());

-- TEAM MEMBER REQUESTS
ALTER TABLE public.team_member_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system_user_can_view_all_requests" ON public.team_member_requests;
CREATE POLICY "system_user_can_view_all_requests" 
  ON public.team_member_requests FOR SELECT TO authenticated 
  USING (public.is_admin());

DROP POLICY IF EXISTS "users_can_view_own_requests" ON public.team_member_requests;
CREATE POLICY "users_can_view_own_requests" 
  ON public.team_member_requests FOR SELECT TO authenticated 
  USING (email = auth.jwt()->>'email');

-- DEVICES
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clients view own devices" ON public.devices;
CREATE POLICY "Clients view own devices"
  ON public.devices FOR SELECT TO authenticated
  USING (client_id = public.get_client_id_from_auth() OR public.is_admin());

-- DELIVERIES & TANKS
DROP POLICY IF EXISTS "Tenant isolation for deliveries" ON public.deliveries;
CREATE POLICY "Tenant isolation for deliveries" 
  ON public.deliveries FOR ALL TO authenticated 
  USING (client_id = public.get_client_id_from_auth() OR public.is_admin());

DROP POLICY IF EXISTS "Tenant isolation for tanks" ON public.tanks;
CREATE POLICY "Tenant isolation for tanks" 
  ON public.tanks FOR ALL TO authenticated 
  USING (client_id = public.get_client_id_from_auth() OR public.is_admin());


-- Refresh the cache
NOTIFY pgrst, 'reload schema';
