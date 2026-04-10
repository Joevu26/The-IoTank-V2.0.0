-- supabase/migrations/20260405000006_finalize_firebase_purge_final.sql
-- ============================================================================
-- FINAL FIREBASE PURGE: Renaming the last lingering columns
-- ============================================================================

-- PENDING_REGISTRATIONS: Rename legacy UID column
DO $$ BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_registrations' AND column_name='approved_firebase_uid') THEN
        ALTER TABLE public.pending_registrations RENAME COLUMN approved_firebase_uid TO approved_supabase_uid;
    END IF;
END $$;

-- Refresh the cache
NOTIFY pgrst, 'reload schema';
