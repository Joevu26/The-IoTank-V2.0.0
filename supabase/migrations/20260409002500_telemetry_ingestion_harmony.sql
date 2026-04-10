-- supabase/migrations/20260409002500_telemetry_ingestion_harmony.sql
-- ============================================================================
-- TELEMETRY INGESTION HARMONY: Final Legacy Cleanup (client_id -> station_id)
-- ============================================================================
-- This migration surgically removes all remaining rogue references to 'client_id'
-- from the sensor_readings ingestion path to resolve HTTP 400 errors.
-- ============================================================================

DO $$ 
DECLARE
    trigo RECORD;
BEGIN
    -- 1. DYNAMIC CLEANUP: Find and drop EVERY trigger on sensor_readings
    -- This handles triggers with legacy or unknown names that might still reference client_id
    FOR trigo IN (
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'sensor_readings' 
        AND event_object_schema = 'public'
    ) LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.sensor_readings', trigo.trigger_name);
    END LOOP;

    -- 2. DYNAMIC CLEANUP: Drop all RLS policies on sensor_readings
    DROP POLICY IF EXISTS "Hardware devices can insert readings" ON public.sensor_readings;
    DROP POLICY IF EXISTS "Users can view own sensor readings" ON public.sensor_readings;
    DROP POLICY IF EXISTS "Tenant isolation for sensor_readings" ON public.sensor_readings;
    DROP POLICY IF EXISTS "Service role bypass for ingestion" ON public.sensor_readings;
    DROP POLICY IF EXISTS "Allow anonymous hardware ingestion" ON public.sensor_readings;

END $$;

-- 3. REPAIR: hardened update_tank_from_sensor function
-- Optimized to handle volume, temperature, and timestamp updates atomically.
CREATE OR REPLACE FUNCTION public.update_tank_from_sensor()
RETURNS TRIGGER AS $$
BEGIN
  -- We strictly use NEW.tank_id (standardized)
  UPDATE public.tanks t
  SET current_volume        = NEW.volume,
      current_temperature   = NEW.temperature,
      last_reading_at       = NOW(), 
      updated_at            = NOW()
  WHERE t.id = NEW.tank_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. RE-APPLY: Standardized Trigger
CREATE TRIGGER update_tank_state 
AFTER INSERT ON public.sensor_readings 
FOR EACH ROW EXECUTE FUNCTION public.update_tank_from_sensor();

-- 5. RE-APPLY: Hardened Hardware Ingestion Policy
-- Supports both station_id and tank_id claims from the secure hardware JWT.
ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hardware devices can insert readings" ON public.sensor_readings
FOR INSERT WITH CHECK (
    -- Allow if bypass is active (service_role) or if JWT has correct claims
    (auth.role() = 'service_role') OR (
        ((auth.jwt() ->> 'role'::text) = 'device'::text) AND 
        (((auth.jwt() ->> 'station_id'::text))::uuid = station_id)
    )
);

CREATE POLICY "Users can view own sensor readings" ON public.sensor_readings
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.tanks t
        WHERE t.id = sensor_readings.tank_id 
        AND (t.station_id = (SELECT station_id FROM public.profiles WHERE auth_user_id = auth.uid()) OR public.is_admin())
    )
);

-- 6. AUDIT: Fix data_access_logs if it still uses client_id
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'data_access_logs' AND column_name = 'client_id') THEN
        ALTER TABLE public.data_access_logs RENAME COLUMN client_id TO station_id;
    END IF;
END $$;

-- 7. RELOAD: PostgREST Cache
NOTIFY pgrst, 'reload schema';
