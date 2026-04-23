-- supabase/migrations/20260423060000_finalize_alerts_schema.sql
-- ============================================================================
-- FINALIZE ALERTS SCHEMA: Ensure metadata support and robust constraints
-- ============================================================================

-- 1. Ensure metadata column exists (for forensic details)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alerts' AND column_name = 'metadata') THEN
        ALTER TABLE public.alerts ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 2. Ensure alert_data column exists (for engine scores)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alerts' AND column_name = 'alert_data') THEN
        ALTER TABLE public.alerts ADD COLUMN alert_data jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 3. Harmonize Alert Type Constraints (Including missing forensic and intelligence types)
ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS alerts_alert_type_check;
ALTER TABLE public.alerts ADD CONSTRAINT alerts_alert_type_check 
    CHECK (alert_type IN (
        -- Operational (Legacy & New)
        'low-level', 'low_level', 'low_fuel', 'low-fuel',
        'overfill', 'high_temperature', 'high-temperature',
        'sensor-failure', 'sensor_failure', 'sensor_offline', 'sensor-offline',
        'telemetry-gap', 'telemetry_gap', 'connectivity-lost', 'connectivity_lost',
        'anomaly', 'system_error', 'system-error',
        'calibration_due', 'calibration-due', 'payment_overdue', 'payment-overdue',
        
        -- Forensic
        'leak', 'leak-detected', 'leak_detected',
        'refill', 'refill-detected', 'refill_detected',
        'unauthorized-refill', 'unauthorized_refill',
        'theft', 'theft-detected', 'theft_detected',
        
        -- Intelligence & Compliance
        'market-news', 'market_news',
        'regulatory-update', 'regulatory_update',
        'delivery-variance', 'delivery_variance',
        'compliance-deadline', 'compliance_deadline',
        'price_review', 'price-review',

        -- Miscellaneous / UI Support (Commonly misused or generic)
        'info', 'warning', 'error', 'critical', 'success', 'system',
        'anomaly', 'maintenance', 'test', 'composite',
        'operational-alert', 'operational_alert', 'theft', 'leak',
        'delivery', 'delivery_added', 'delivery-added',
        'shift_open', 'shift-open', 'shift_close', 'shift-close'
    ));

-- 4. Harmonize Severity Constraints
ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS alerts_severity_check;
ALTER TABLE public.alerts ADD CONSTRAINT alerts_severity_check 
    CHECK (severity IN ('low', 'medium', 'high', 'critical', 'info', 'warning'));

-- 5. Fix RLS for System Injections
-- Ensure that the system (or authenticated users acting as system) can always insert alerts
DROP POLICY IF EXISTS "System can insert alerts" ON public.alerts;
CREATE POLICY "System can insert alerts" ON public.alerts
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Ensure users can read alerts for their own station
DROP POLICY IF EXISTS "Users can view alerts for their station" ON public.alerts;
CREATE POLICY "Users can view alerts for their station" ON public.alerts
    FOR SELECT TO authenticated
    USING (
        station_id IN (SELECT get_station_id_from_auth())
        OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE auth_user_id = auth.uid() AND role IN ('super_admin', 'admin'))
        OR
        EXISTS (SELECT 1 FROM public.system_users WHERE auth_user_id = auth.uid() AND is_active = TRUE AND role IN ('super_admin', 'admin_helper'))
    );

-- 6. Grant Permissions
GRANT ALL ON TABLE public.alerts TO authenticated;
GRANT ALL ON TABLE public.alerts TO service_role;
