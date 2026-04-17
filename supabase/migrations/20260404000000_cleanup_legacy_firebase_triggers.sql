-- supabase/migrations/20260404000000_cleanup_legacy_firebase_triggers.sql
-- ============================================================================
-- FIX: Purge broken legacy Firebase triggers and functions
-- ============================================================================

-- 1. Drop the broken tank linking trigger (Root cause of Add Tank failure)
DROP TRIGGER IF EXISTS auto_link_tank_to_client ON public.tanks;
DROP FUNCTION IF EXISTS public.link_tank_to_client() CASCADE;

-- 2. Fix the Threshold Checking trigger (Currently broken because it selects tanks.firebase_uid)
CREATE OR REPLACE FUNCTION public.check_tank_thresholds() 
RETURNS TRIGGER AS $$
DECLARE
    v_client_id UUID;
BEGIN
    -- Only proceed if it's a sensor_readings insert
    SELECT client_id INTO v_client_id FROM tanks WHERE id = NEW.tank_id;
    
    -- Check Low Level: Percentage-based comparison (ambient_volume <= % threshold of capacity)
    BEGIN
        IF NEW.ambient_volume <= (SELECT (low_level_threshold / 100.0) * tank_capacity FROM tanks WHERE id = NEW.tank_id) THEN
            INSERT INTO public.alerts (client_id, tank_id, alert_type, severity, title, message)
            VALUES (
                v_client_id, 
                NEW.tank_id, 
                'low_fuel', 
                'warning', 
                'Low Fuel Level Alert', 
                'Tank has reached low fuel threshold. Consider reordering.'
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Silent fail to prevent sensor readings from being blocked by alert bugs
        NULL;
    END;

    -- Check High Temp
    BEGIN
        IF NEW.temperature >= (SELECT high_temperature_threshold FROM tanks WHERE id = NEW.tank_id) THEN
            INSERT INTO public.alerts (client_id, tank_id, alert_type, severity, title, message)
            VALUES (
                v_client_id, 
                NEW.tank_id, 
                'high_temperature', 
                'critical', 
                'High Temperature Alert', 
                'Tank temperature has exceeded safety threshold!'
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Fix Dashboard Summary RPC (Currently broken because it filtered tanks by firebase_uid string)
CREATE OR REPLACE FUNCTION public.get_client_dashboard_summary(p_supabase_uid UUID)
RETURNS JSON AS $$
DECLARE
    v_summary JSON;
    v_client_id UUID;
BEGIN
    -- Get client_id from profile mapping
    SELECT client_id INTO v_client_id FROM public.profiles WHERE supabase_uid = p_supabase_uid;

    SELECT json_build_object(
        'billing', (
            SELECT json_build_object(
                'current_debt', current_debt, 
                'total_paid', total_paid, 
                'subscription_tier', subscription_tier,
                'account_status', account_status, 
                'next_billing_date', next_billing_date
            ) FROM client_billing WHERE id = v_client_id
        ),
        'tanks', (
            SELECT json_agg(
                json_build_object(
                    'id', id, 
                    'name', tank_name, 
                    'fuel_type', fuel_type, 
                    'current_volume', current_volume,
                    'capacity', tank_capacity, 
                    'fill_percentage', ROUND((current_volume / tank_capacity * 100)::NUMERIC, 2),
                    'temperature', current_temperature, 
                    'status', status
                )
            ) FROM tanks WHERE client_id = v_client_id AND status = 'active'
        ),
        'unread_alerts', (SELECT COALESCE(COUNT(*), 0) FROM alerts WHERE client_id = v_client_id AND is_read = FALSE),
        'critical_alerts', (SELECT COALESCE(COUNT(*), 0) FROM alerts WHERE client_id = v_client_id AND is_read = FALSE AND severity = 'critical')
    ) INTO v_summary;
    
    RETURN v_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 4. Audit Alerts Table (Remove NOT NULL constraint from firebase_uid if it still exists)
-- This allows inserts from triggers that don't know the firebase string anymore
-- We use DO blocks to avoid errors if columns were already removed or altered
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alerts' AND column_name = 'firebase_uid') THEN
        ALTER TABLE public.alerts ALTER COLUMN firebase_uid DROP NOT NULL;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'firebase_uid') THEN
        ALTER TABLE public.transactions ALTER COLUMN firebase_uid DROP NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usage_logs' AND column_name = 'firebase_uid') THEN
        ALTER TABLE public.usage_logs ALTER COLUMN firebase_uid DROP NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'firebase_uid') THEN
        ALTER TABLE public.deliveries ALTER COLUMN firebase_uid DROP NOT NULL;
    END IF;
END $$;
