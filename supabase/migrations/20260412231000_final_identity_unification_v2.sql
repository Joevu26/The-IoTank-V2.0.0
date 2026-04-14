-- supabase/migrations/20260412231000_final_identity_unification_v2.sql
-- ============================================================================
-- FINAL IDENTITY UNIFICATION: Purging last remaining '_uid' holdovers
-- Standardizing on '_auth_id' for operational users and 'auth_user_id' for primary owners.
-- ============================================================================

DO $$ 
BEGIN
    -- 1. shift_closures
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shift_closures' AND column_name = 'closed_by_uid') THEN
        ALTER TABLE public.shift_closures RENAME COLUMN closed_by_uid TO closed_by_auth_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shift_closures' AND column_name = 'client_id') THEN
        ALTER TABLE public.shift_closures RENAME COLUMN client_id TO station_id;
    END IF;

    -- 2. fuel_transactions
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_transactions' AND column_name = 'performed_by_uid') THEN
        ALTER TABLE public.fuel_transactions RENAME COLUMN performed_by_uid TO performed_by_auth_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_transactions' AND column_name = 'client_id') THEN
        ALTER TABLE public.fuel_transactions RENAME COLUMN client_id TO station_id;
    END IF;

    -- 3. audit_logs (Checking for actor_uid)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'actor_uid') THEN
        ALTER TABLE public.audit_logs RENAME COLUMN actor_uid TO actor_auth_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'client_id') THEN
        ALTER TABLE public.audit_logs RENAME COLUMN client_id TO station_id;
    END IF;

    -- 4. reports
    -- Currently using 'generated_by', which is fine, but checking for any legacy 'station_id' vs 'client_id' holdovers
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'client_id') THEN
        ALTER TABLE public.reports RENAME COLUMN client_id TO station_id;
    END IF;

END $$;

-- 5. Update RLS policies to reflect new column names
-- ============================================================================

-- reports
DROP POLICY IF EXISTS "Users can view reports for their organization" ON public.reports;
DROP POLICY IF EXISTS "Users can view reports for their station" ON public.reports;
CREATE POLICY "Users can view reports for their station"
ON public.reports FOR SELECT
USING (station_id = (SELECT station_id FROM profiles WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can create reports for their organization" ON public.reports;
DROP POLICY IF EXISTS "Users can create reports for their station" ON public.reports;
CREATE POLICY "Users can create reports for their station"
ON public.reports FOR INSERT
WITH CHECK (station_id = (SELECT station_id FROM profiles WHERE auth_user_id = auth.uid()));

-- Notify PostgREST
NOTIFY pgrst, 'reload schema';
