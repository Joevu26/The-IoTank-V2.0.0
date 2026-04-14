-- supabase/migrations/20260413000000_add_severity_to_unified_events.sql
-- ============================================================================
-- FIX: Missing severity column in unified_events discovered during security audit
-- ============================================================================

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unified_events' AND column_name = 'severity') THEN
        ALTER TABLE public.unified_events ADD COLUMN severity TEXT DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL'));
    END IF;
END $$;

-- Notify PostgREST to refresh schema
NOTIFY pgrst, 'reload schema';
