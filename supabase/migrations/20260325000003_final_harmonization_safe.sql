-- supabase/migrations/20260325000003_final_harmonization_safe.sql
-- ============================================================================
-- SAFE HARMONIZATION: Complete transition to Supabase Auth
-- ============================================================================

-- Function to safely add supabase_uid and make firebase_uid nullable
CREATE OR REPLACE FUNCTION public.safe_harden_table(p_table_name text, p_firebase_col text DEFAULT 'firebase_uid')
RETURNS void AS $$
BEGIN
    -- Add supabase_uid if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = p_table_name AND column_name = 'supabase_uid') THEN
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN supabase_uid UUID REFERENCES auth.users(id)', p_table_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(supabase_uid)', 'idx_' || p_table_name || '_supabase_uid', p_table_name);
    END IF;

    -- Make firebase column nullable if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = p_table_name AND column_name = p_firebase_col) THEN
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', p_table_name, p_firebase_col);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply to all relevant tables
SELECT public.safe_harden_table('client_billing');
SELECT public.safe_harden_table('sites');
SELECT public.safe_harden_table('tanks');
SELECT public.safe_harden_table('transactions');
SELECT public.safe_harden_table('usage_logs');
SELECT public.safe_harden_table('alerts');
SELECT public.safe_harden_table('deliveries');
SELECT public.safe_harden_table('shift_closures', 'closed_by_uid');

-- Special check for sites site_name
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'name') THEN
        ALTER TABLE public.sites RENAME COLUMN "name" TO "site_name";
    END IF;
END $$;

DROP FUNCTION public.safe_harden_table(text, text);

-- Update Audit Log trigger
CREATE OR REPLACE FUNCTION public.stamp_audit_log_client()
RETURNS TRIGGER AS $$
BEGIN
  IF public.get_auth_level() >= 4 THEN
    NEW.client_id := public.get_user_client_id();
    -- Update the record to include the native UID if column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'supabase_uid') THEN
        NEW.supabase_uid := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
