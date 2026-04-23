-- supabase/migrations/20260423020000_definitive_identity_unification.sql
-- ============================================================================
-- OPERATION CLEAN IDENTITY: Final Phase
-- Unified renaming of all 'firebase_uid' variants to 'auth_user_id'
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. UNIVERSAL COLUMN RENAMING
    -- We target every table in public schema that still has firebase-related identity naming.
    
    -- Tanks
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tanks' AND column_name = 'firebase_uid') THEN
        ALTER TABLE public.tanks RENAME COLUMN firebase_uid TO auth_user_id;
    END IF;

    -- Alerts
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alerts' AND column_name = 'firebase_uid') THEN
        ALTER TABLE public.alerts RENAME COLUMN firebase_uid TO auth_user_id;
    END IF;

    -- Deliveries
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'firebase_uid') THEN
        ALTER TABLE public.deliveries RENAME COLUMN firebase_uid TO auth_user_id;
    END IF;

    -- Transactions
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'firebase_uid') THEN
        ALTER TABLE public.transactions RENAME COLUMN firebase_uid TO auth_user_id;
    END IF;

    -- Usage Logs
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usage_logs' AND column_name = 'firebase_uid') THEN
        ALTER TABLE public.usage_logs RENAME COLUMN firebase_uid TO auth_user_id;
    END IF;

    -- Shift Closures
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shift_closures' AND column_name = 'closed_by_uid') THEN
        ALTER TABLE public.shift_closures RENAME COLUMN closed_by_uid TO auth_user_id;
    END IF;

    -- Admin Logs
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_logs' AND column_name = 'admin_firebase_uid') THEN
        ALTER TABLE public.admin_logs RENAME COLUMN admin_firebase_uid TO auth_user_id;
    END IF;

    -- Client Billing
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_billing' AND column_name = 'firebase_uid') THEN
        ALTER TABLE public.client_billing RENAME COLUMN firebase_uid TO auth_user_id;
    END IF;

    -- Fuel Transactions (if exists)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_transactions' AND column_name = 'firebase_uid') THEN
        ALTER TABLE public.fuel_transactions RENAME COLUMN firebase_uid TO auth_user_id;
    END IF;

    -- Market Bookmarks (if exists)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_bookmarks' AND column_name = 'firebase_uid') THEN
        ALTER TABLE public.market_bookmarks RENAME COLUMN firebase_uid TO auth_user_id;
    END IF;

END $$;

-- 2. REFACTOR IDENTITY HELPER
-- Replaces the legacy firebase_uid() helper with a standardized one that works with Supabase Auth.
CREATE OR REPLACE FUNCTION public.firebase_uid() 
RETURNS TEXT AS $$
  -- Modern shim: returns the Supabase Auth UID (UUID) cast to TEXT
  -- to maintain compatibility with legacy STRING-based identity logic.
  SELECT auth.uid()::text;
$$ LANGUAGE SQL STABLE;

-- 3. RLS POLICY REPAIR (CORE TABLES)
-- We drop and recreate policies that were previously trying to join on profiles.firebase_uid.

-- Sites Visibility
DROP POLICY IF EXISTS "Users can see own sites" ON public.sites;
CREATE POLICY "Users can see own sites" ON public.sites
    FOR ALL USING (
        station_id IN (SELECT station_id FROM public.profiles WHERE auth_user_id = auth.uid())
    );

-- Tanks Visibility
DROP POLICY IF EXISTS "Users can see own tanks" ON public.tanks;
CREATE POLICY "Users can see own tanks" ON public.tanks
    FOR ALL USING (
        station_id IN (SELECT station_id FROM public.profiles WHERE auth_user_id = auth.uid())
    );

-- Alerts Visibility
DROP POLICY IF EXISTS "Users can see own alerts" ON public.alerts;
CREATE POLICY "Users can see own alerts" ON public.alerts
    FOR ALL USING (
        station_id IN (SELECT station_id FROM public.profiles WHERE auth_user_id = auth.uid())
    );

-- Deliveries Visibility
DROP POLICY IF EXISTS "Users can see own deliveries" ON public.deliveries;
CREATE POLICY "Users can see own deliveries" ON public.deliveries
    FOR ALL USING (
        station_id IN (SELECT station_id FROM public.profiles WHERE auth_user_id = auth.uid())
    );

-- Transactions Visibility
DROP POLICY IF EXISTS "Users can see own transactions" ON public.transactions;
CREATE POLICY "Users can see own transactions" ON public.transactions
    FOR ALL USING (
        station_id IN (SELECT station_id FROM public.profiles WHERE auth_user_id = auth.uid())
    );

-- Profiles Self-Visibility
DROP POLICY IF EXISTS "Users can see own profile" ON public.profiles;
CREATE POLICY "Users can see own profile" ON public.profiles
    FOR SELECT USING (auth_user_id = auth.uid());

-- Metadata Verification
COMMENT ON TABLE public.profiles IS 'Standardized User Profiles. auth_user_id is the source of truth.';
