-- supabase/migrations/20260324170000_purge_firebase_completely.sql

-- 1. PURGE firebase_uid COLUMNS FROM ALL TABLES
DO $$
DECLARE
    t text;
    c text;
BEGIN
    FOR t, c IN SELECT table_name, column_name 
               FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND column_name IN ('firebase_uid', 'closed_by_uid', 'user_id', 'assigned_to', 'created_by')
    LOOP
        -- If it's the main firebase_uid, drop it.
        -- If it's a TEXT field likely containing a firebase UID and NOT named id/supabase_uid, drop it.
        IF c = 'firebase_uid' THEN
            EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS %I CASCADE', t, c);
        ELSIF c IN ('closed_by_uid', 'user_id', 'assigned_to', 'created_by') THEN
            -- Check if it is TEXT (indicative of legacy Firebase string IDs)
            IF EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = t AND column_name = c AND data_type = 'text') THEN
                EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS %I CASCADE', t, c);
            END IF;
        END IF;
    END LOOP;
END $$;

-- 2. DELETE ORPHANED AUTH DATA
-- Only keep profiles and system_users that have a valid Supabase UID.
-- (Warning: This will delete legacy placeholder accounts that haven't logged in via Supabase)
DELETE FROM public.profiles WHERE supabase_uid IS NULL;
DELETE FROM public.system_users WHERE supabase_uid IS NULL;

-- 3. ENSURE ALL TABLES ARE CLEANED OF LEGACY REFERENCES
ALTER TABLE IF EXISTS public.client_billing DROP COLUMN IF EXISTS firebase_uid CASCADE;
ALTER TABLE IF EXISTS public.tanks DROP COLUMN IF EXISTS firebase_uid CASCADE;
ALTER TABLE IF EXISTS public.transactions DROP COLUMN IF EXISTS firebase_uid CASCADE;
ALTER TABLE IF EXISTS public.usage_logs DROP COLUMN IF EXISTS firebase_uid CASCADE;
ALTER TABLE IF EXISTS public.alerts DROP COLUMN IF EXISTS firebase_uid CASCADE;
ALTER TABLE IF EXISTS public.deliveries DROP COLUMN IF EXISTS firebase_uid CASCADE;
ALTER TABLE IF EXISTS public.ai_recommendations DROP COLUMN IF EXISTS firebase_uid CASCADE;

-- 4. CLEAN UP LEGACY FUNCTIONS
DROP FUNCTION IF EXISTS public.firebase_uid() CASCADE;
DROP FUNCTION IF EXISTS public.link_firebase_to_supabase(TEXT, UUID) CASCADE;

-- 5. FINAL RE-DEFINITION OF COMPATIBILITY FUNCTION (STUB)
-- Some RLS policies or code might still expect this function. 
-- We re-define it as a simple wrapper around auth.uid() to prevent breaks.
CREATE OR REPLACE FUNCTION public.firebase_uid()
RETURNS TEXT AS $$
BEGIN
    RETURN auth.uid()::TEXT;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;
