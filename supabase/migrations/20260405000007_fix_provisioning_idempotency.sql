-- supabase/migrations/20260405000007_fix_provisioning_idempotency.sql

-- 1. Ensure 'profiles' has a unique constraint on supabase_uid for upserts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'profiles' AND constraint_type = 'UNIQUE' AND constraint_name = 'profiles_supabase_uid_key'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_supabase_uid_key UNIQUE (supabase_uid);
    END IF;
END $$;

-- 2. Ensure 'profiles' has a unique constraint on email for fallback upserts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'profiles' AND constraint_type = 'UNIQUE' AND constraint_name = 'profiles_email_key'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
    END IF;
END $$;

-- 3. Ensure 'client_billing' has a unique constraint on supabase_uid
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'client_billing' AND constraint_type = 'UNIQUE' AND constraint_name = 'client_billing_supabase_uid_key'
    ) THEN
        ALTER TABLE public.client_billing ADD CONSTRAINT client_billing_supabase_uid_key UNIQUE (supabase_uid);
    END IF;
END $$;

-- 4. Correct 'admin_logs' if it's missing columns used by Edge Functions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_logs' AND column_name = 'system_user_id') THEN
        ALTER TABLE public.admin_logs ADD COLUMN system_user_id UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_logs' AND column_name = 'supabase_uid') THEN
        ALTER TABLE public.admin_logs ADD COLUMN supabase_uid UUID;
    END IF;
END $$;

-- 5. Hardened Site Uniqueness for Idempotent Provisioning
DO $$
BEGIN
    -- This allows "re-provisioning" a site with the same name for the same client without errors.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'sites' AND constraint_type = 'UNIQUE' AND constraint_name = 'sites_client_id_site_name_key'
    ) THEN
        ALTER TABLE public.sites ADD CONSTRAINT sites_client_id_site_name_key UNIQUE (client_id, site_name);
    END IF;
END $$;
