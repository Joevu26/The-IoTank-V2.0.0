-- ============================================================================
-- FIX: Legacy Telemetry Trigger Stabilization (client_id -> station_id)
-- ============================================================================
-- This migration repairs the remaining rogue references to 'client_id' and 
-- 'ambient_volume' which were causing ESP32 ingestion failures (HTTP 400).
-- ============================================================================

-- 1. REPAIR: update_tank_from_sensor (Final v2)
-- Corrects 'ambient_volume' -> 'volume' and ensures 'station_id' parity.
CREATE OR REPLACE FUNCTION public.update_tank_from_sensor()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.tanks t
  SET current_volume        = NEW.volume,
      current_temperature   = NEW.temperature,
      last_reading_at       = NOW(), 
      updated_at            = NOW()
  WHERE t.id = NEW.tank_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 2. REPAIR: log_admin_action (Standardization)
-- Fixes the 'client_id' reference in the audit logger which was causing crashes
-- during financial record creation for tanks and transactions.
CREATE OR REPLACE FUNCTION public.log_admin_action()
RETURNS TRIGGER AS $$
DECLARE
  v_action_type TEXT := TG_ARGV[0];
  v_description TEXT := TG_ARGV[1];
BEGIN
  INSERT INTO public.admin_logs (
    system_user_id,
    auth_user_id,  -- Standardized from 'supabase_uid'
    action_type,
    affected_station_id,
    description,
    changes_made
  ) VALUES (
    (SELECT id FROM public.system_users WHERE auth_user_id = auth.uid() LIMIT 1),
    auth.uid(),
    v_action_type,
    CASE 
      WHEN TG_TABLE_NAME = 'fuel_stations' THEN NEW.id
      -- Standardized from 'client_id' to 'station_id'
      WHEN TG_TABLE_NAME = 'transactions' THEN (NEW.station_id)::uuid
      WHEN TG_TABLE_NAME = 'tanks' THEN (NEW.station_id)::uuid
      ELSE NULL 
    END,
    v_description,
    jsonb_build_object('new', row_to_json(NEW))
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 3. RE-APPLY: Standardized Trigger on sensor_readings
DROP TRIGGER IF EXISTS update_tank_state ON public.sensor_readings;
CREATE TRIGGER update_tank_state 
AFTER INSERT ON public.sensor_readings 
FOR EACH ROW EXECUTE FUNCTION public.update_tank_from_sensor();


-- 4. RE-APPLY: Standardized Trigger on transactions (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') THEN
        DROP TRIGGER IF EXISTS log_transaction_creation ON public.transactions;
        CREATE TRIGGER log_transaction_creation 
        AFTER INSERT ON public.transactions 
        FOR EACH ROW EXECUTE FUNCTION public.log_admin_action('payment_manually_recorded', 'Transaction created');
    END IF;
END $$;


-- 5. RELOAD: PostgREST Schema
NOTIFY pgrst, 'reload schema';
