-- supabase/migrations/20260422140000_expand_alerts_enum.sql
-- ============================================================================
-- EXPAND ALERTS ENUM: Harmonize database constraints with application state
-- ============================================================================

-- 1. Drop old constraints
ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS alerts_alert_type_check;
ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS alerts_severity_check;

-- 2. Add expanded Severity Check
ALTER TABLE public.alerts ADD CONSTRAINT alerts_severity_check 
    CHECK (severity IN ('low', 'medium', 'high', 'critical', 'info', 'warning'));

-- 3. Add expanded Alert Type Check (Unifying underscores and dashes for robustness)
ALTER TABLE public.alerts ADD CONSTRAINT alerts_alert_type_check 
    CHECK (alert_type IN (
        -- Core Operational
        'low-level', 'overfill', 'high-temperature', 'sensor-failure',
        'telemetry-gap', 'connectivity-lost', 'anomaly',
        
        -- Forensic & Security (Supporting both underscore and dash versions for transition safety)
        'leak', 'leak-detected', 'leak_detected',
        'theft', 'theft-detected', 'theft_detected',
        'refill', 'refill-detected', 'refill_detected',
        'unauthorized-refill', 'unauthorized_refill',
        
        -- Compliance & Reporting
        'delivery-variance', 'delivery_variance',
        'compliance-deadline', 'compliance_deadline',
        'composite', 'info',
        
        -- Intelligence
        'market-news', 'market_news',
        'regulatory-update', 'regulatory_update'
    ));

-- 4. Verify Column Existence (Defensive check for 400 errors)
DO $$ 
BEGIN
    -- Ensure metadata column exists (should be jsonb)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alerts' AND column_name = 'metadata') THEN
        ALTER TABLE public.alerts ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
    END IF;

    -- Ensure alert_data column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alerts' AND column_name = 'alert_data') THEN
        ALTER TABLE public.alerts ADD COLUMN alert_data jsonb DEFAULT '{}'::jsonb;
    END IF;

    -- Ensure auth_user_id exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alerts' AND column_name = 'auth_user_id') THEN
        ALTER TABLE public.alerts ADD COLUMN auth_user_id text;
    END IF;
END $$;

-- 5. Grant Permissions
GRANT ALL ON TABLE public.alerts TO authenticated;
GRANT ALL ON TABLE public.alerts TO service_role;
