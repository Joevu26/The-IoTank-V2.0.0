-- Unschedule the redundant connectivity-watchdog job
-- Its functionality has been consolidated into the alert-engine.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'connectivity-watchdog-30m') THEN
            PERFORM cron.unschedule('connectivity-watchdog-30m');
            RAISE NOTICE 'Unscheduled connectivity-watchdog-30m job.';
        END IF;
    END IF;
END $$;
