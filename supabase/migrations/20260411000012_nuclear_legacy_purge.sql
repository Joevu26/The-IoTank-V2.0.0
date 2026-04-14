-- supabase/migrations/20260411000012_nuclear_legacy_purge.sql
-- ============================================================================
-- NUCLEAR LEGACY PURGE: Definitive removal of Firebase & old schema vestiges
-- ============================================================================

DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- 1. DROP LEGACY TABLES (CASCADE handles policies and triggers)
    -- These have been replaced by the public.unified_events timeline
    DROP TABLE IF EXISTS public.admin_logs CASCADE;
    DROP TABLE IF EXISTS public.event_logs CASCADE;
    DROP TABLE IF EXISTS public.usage_logs CASCADE;
    DROP TABLE IF EXISTS public.registration_events CASCADE;
    DROP TABLE IF EXISTS public.data_access_logs CASCADE;

    -- 2. DROP LEGACY COLUMNS (Firebase / Old Supabase standards)
    -- Profiles cleanup
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'firebase_uid') THEN
        ALTER TABLE public.profiles DROP COLUMN firebase_uid;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'supabase_uid') THEN
        ALTER TABLE public.profiles DROP COLUMN supabase_uid;
    END IF;

    -- Fuel Stations cleanup (Standardizing on station_id)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_stations' AND column_name = 'firebase_uid') THEN
        ALTER TABLE public.fuel_stations DROP COLUMN firebase_uid;
    END IF;
    
    -- Tanks cleanup
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tanks' AND column_name = 'firebase_uid') THEN
        ALTER TABLE public.tanks DROP COLUMN firebase_uid;
    END IF;

    -- Deliveries cleanup
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'firebase_uid') THEN
        ALTER TABLE public.deliveries DROP COLUMN firebase_uid;
    END IF;

    -- 3. DROP LEGACY VIEWS OR SYNONYMS
    DROP VIEW IF EXISTS public.station_overview_v1 CASCADE;
    
    -- 4. CLEANUP ORPHANED INDEXES AND CONSTRAINTS
    -- Rename the primary key constraint if it still carries the old name
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_billing_pkey') THEN
        ALTER TABLE public.fuel_stations RENAME CONSTRAINT client_billing_pkey TO fuel_stations_pkey;
    END IF;

    -- Drop other arbitrary indexes that have legacy names, ignoring primary/foreign keys
    FOR r IN (
        SELECT i.indexname 
        FROM pg_indexes i
        LEFT JOIN pg_constraint c ON c.conname = i.indexname
        WHERE i.schemaname = 'public' 
        AND (i.indexname LIKE '%firebase%' OR i.indexname LIKE '%client_billing%')
        AND c.conname IS NULL -- Do not drop constraint-backed indexes directly
    ) LOOP
        EXECUTE 'DROP INDEX IF EXISTS public.' || quote_ident(r.indexname);
    END LOOP;

END $$;

-- 5. RE-VALIDATE IDENTITY BUNDLE
-- Ensure get_user_bundle_v2 is the definitive RPC
COMMENT ON FUNCTION public.get_user_bundle_v2() IS 'Definitive identity resolver. Replaces all legacy firebase_uid lookups.';
