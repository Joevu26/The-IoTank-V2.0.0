-- supabase/migrations/20260409000400_master_purge.sql
-- ============================================================================
-- MASTER DATA PURGE: Delete all seed and demo data for production baseline
-- ============================================================================

DO $$ 
BEGIN
    -- 1. Truncate operational history (CASCADE handles foreign key dependencies)
    -- This clears everything except the CORE identities (Profiles, Stations, Tanks).
    TRUNCATE TABLE 
        public.sensor_readings,
        public.alerts,
        public.deliveries,
        public.fuel_transactions,
        public.transactions,
        public.shift_closures,
        public.telemetry_history,
        public.security_telemetry_events,
        public.audit_logs,
        public.ai_recommendations,
        public.usage_logs,
        public.event_logs,
        public.registration_events,
        public.data_access_logs,
        public.file_uploads,
        public.analysis_history
    RESTART IDENTITY CASCADE;

    -- 2. Clear status from cores (reset to baseline)
    -- Reset tank volumes and last reading dates
    UPDATE public.tanks 
    SET current_volume = 0, 
        current_temperature = NULL, 
        last_reading_at = NULL, 
        status = 'active';

    -- 3. Notify schema reload
    NOTIFY pgrst, 'reload schema';
END $$;
