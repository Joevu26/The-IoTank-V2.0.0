-- supabase/migrations/20260405000003_global_firebase_purge_final.sql
-- ============================================================================
-- GLOBAL FIREBASE PURGE: Renaming legacy columns to Supabase UUIDs
-- ============================================================================

-- 1. RENAME COLUMNS & CONVERT TO UUID
-- ============================================================================

-- DELIVERIES: Rename and cast to UUID
DO $$ BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='firebase_uid') THEN
        -- First drop the NOT NULL constraint if it exists to allow the cast
        ALTER TABLE public.deliveries ALTER COLUMN firebase_uid DROP NOT NULL;
        -- Rename the column
        ALTER TABLE public.deliveries RENAME COLUMN firebase_uid TO supabase_uid;
        -- Attempt to cast to UUID (preserving data if it's already a valid UUID string)
        ALTER TABLE public.deliveries ALTER COLUMN supabase_uid TYPE UUID USING (supabase_uid::UUID);
    END IF;
END $$;

-- TANKS: Rename and cast to UUID
DO $$ BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tanks' AND column_name='firebase_uid') THEN
        ALTER TABLE public.tanks ALTER COLUMN firebase_uid DROP NOT NULL;
        ALTER TABLE public.tanks RENAME COLUMN firebase_uid TO supabase_uid;
        ALTER TABLE public.tanks ALTER COLUMN supabase_uid TYPE UUID USING (supabase_uid::UUID);
    END IF;
END $$;

-- CLIENT BILLING: Rename and cast to UUID
DO $$ BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='client_billing' AND column_name='firebase_uid') THEN
        ALTER TABLE public.client_billing ALTER COLUMN firebase_uid DROP NOT NULL;
        ALTER TABLE public.client_billing RENAME COLUMN firebase_uid TO supabase_uid;
        ALTER TABLE public.client_billing ALTER COLUMN supabase_uid TYPE UUID USING (supabase_uid::UUID);
    END IF;
END $$;

-- PROFILES & SYSTEM_USERS: Drop legacy firebase_uid (redundant)
DO $$ BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='firebase_uid') THEN
        ALTER TABLE public.profiles DROP COLUMN firebase_uid;
    END IF;
END $$;

DO $$ BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_users' AND column_name='firebase_uid') THEN
        ALTER TABLE public.system_users DROP COLUMN firebase_uid;
    END IF;
END $$;


-- 2. UPDATE REMAINING POLICIES
-- ============================================================================

-- Ensure all policies use supabase_uid OR client_id
DROP POLICY IF EXISTS "Users can manage their own deliveries" ON public.deliveries;
CREATE POLICY "Users can manage their own deliveries"
ON public.deliveries FOR ALL
USING (supabase_uid::UUID = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can manage their own tanks" ON public.tanks;
CREATE POLICY "Users can manage their own tanks"
ON public.tanks FOR ALL
USING (supabase_uid::UUID = auth.uid() OR public.is_admin());


-- 3. REFRESH SCHEMA CACHE
-- ============================================================================
NOTIFY pgrst, 'reload schema';
