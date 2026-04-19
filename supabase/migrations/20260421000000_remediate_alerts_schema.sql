-- supabase/migrations/20260421000000_remediate_alerts_schema.sql
-- ============================================================================
-- REMEDIATE ALERTS SCHEMA: Align identifiers with app state and relax constraints
-- ============================================================================

-- 1. Check if column 'client_id' exists and rename to 'station_id'
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alerts' AND column_name = 'client_id') THEN
        ALTER TABLE public.alerts RENAME COLUMN client_id TO station_id;
    END IF;
END $$;

-- 2. Check if column 'firebase_uid' exists and rename to 'auth_user_id'
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alerts' AND column_name = 'firebase_uid') THEN
        ALTER TABLE public.alerts RENAME COLUMN firebase_uid TO auth_user_id;
    END IF;
END $$;

-- 3. Relax NOT NULL constraint on auth_user_id (for system alerts)
ALTER TABLE public.alerts ALTER COLUMN auth_user_id DROP NOT NULL;

-- 4. Update alert_type and severity check constraints if they exist
-- We drop and recreate them to ensure they include 'refill', 'telemetry-gap', etc.

ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS alerts_severity_check;
ALTER TABLE public.alerts ADD CONSTRAINT alerts_severity_check 
    CHECK (severity IN ('low', 'medium', 'high', 'critical', 'info', 'warning'));

ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS alerts_alert_type_check;
-- Making it more flexible, but including current known types
ALTER TABLE public.alerts ADD CONSTRAINT alerts_alert_type_check 
    CHECK (alert_type IN (
        'low-level', 'leak', 'overfill', 'refill', 'sensor-failure', 
        'telemetry-gap', 'connectivity-lost', 'compliance-deadline', 
        'delivery-variance', 'anomaly', 'theft-detected', 'leak-detected'
    ));

-- 5. Ensure indices exist for performance
CREATE INDEX IF NOT EXISTS idx_alerts_station_id ON public.alerts(station_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_resolved ON public.alerts(is_resolved) WHERE is_resolved = false;

-- 6. Grant permissions (just in case)
GRANT ALL ON TABLE public.alerts TO postgres;
GRANT ALL ON TABLE public.alerts TO authenticated;
GRANT ALL ON TABLE public.alerts TO service_role;

-- 🔴 FORENSIC CLEANUP: If there are existing alerts with no station_id but matching auth_user_ids in profiles
UPDATE public.alerts a
SET station_id = p.station_id
FROM public.profiles p
WHERE a.auth_user_id = p.auth_user_id
AND a.station_id IS NULL;
