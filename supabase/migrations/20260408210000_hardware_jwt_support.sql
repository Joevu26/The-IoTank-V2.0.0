-- supabase/migrations/20260408210000_hardware_jwt_support.sql
-- ============================================================================
-- HARDWARE SECURITY: Device-Bound JWT Ingestion & RLS
-- ============================================================================

-- 1. Create a policy to allow 'device' role to INSERT into sensor_readings
-- This policy checks the custom claims in the JWT issued by 'issue-device-token'
DROP POLICY IF EXISTS "Hardware devices can insert readings" ON public.sensor_readings;

CREATE POLICY "Hardware devices can insert readings" ON public.sensor_readings
FOR INSERT WITH CHECK (
  (auth.jwt() ->> 'role' = 'device') AND
  (auth.jwt() ->> 'station_id')::uuid = station_id AND
  (auth.jwt() ->> 'tank_id')::uuid = tank_id
);

-- 2. Allow 'device' role to INSERT into telemetry_history
-- This is for hardware health monitoring (CPU, RAM, Temp, etc.)
DROP POLICY IF EXISTS "Hardware devices can insert telemetry" ON public.telemetry_history;

CREATE POLICY "Hardware devices can insert telemetry" ON public.telemetry_history
FOR INSERT WITH CHECK (
  (auth.jwt() ->> 'role' = 'device') AND
  (auth.jwt() ->> 'station_id')::uuid = (
    SELECT station_id FROM public.devices d WHERE d.id = telemetry_history.device_id
  )
);

-- 3. Ensure tanks can be updated by devices for 'heartbeat' (optional, but good for real-time status)
DROP POLICY IF EXISTS "Devices can update last_reading_at for heartbeats" ON public.tanks;

CREATE POLICY "Devices can update last_reading_at for heartbeats" ON public.tanks
FOR UPDATE USING (
  (auth.jwt() ->> 'role' = 'device') AND
  (auth.jwt() ->> 'tank_id')::uuid = id
)
WITH CHECK (
  (auth.jwt() ->> 'role' = 'device') AND
  (auth.jwt() ->> 'tank_id')::uuid = id
);

-- 4. Enable RLS on devices and telemetry_history if not already
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_history ENABLE ROW LEVEL SECURITY;

-- 5. Add station_id to telemetry_history if missing (for better isolation)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'telemetry_history' AND column_name = 'station_id') THEN
        ALTER TABLE public.telemetry_history ADD COLUMN station_id UUID REFERENCES public.fuel_stations(id);
    END IF;
END $$;

-- 6. Re-apply the telemetry_history policy with the new column (more performant)
DROP POLICY IF EXISTS "Hardware devices can insert telemetry" ON public.telemetry_history;

CREATE POLICY "Hardware devices can insert telemetry" ON public.telemetry_history
FOR INSERT WITH CHECK (
  (auth.jwt() ->> 'role' = 'device') AND
  (auth.jwt() ->> 'station_id')::uuid = station_id
);

-- 7. Grant access to device role (handled by 'authenticated' in Supabase usually, but let's be explicit)
-- Since we use 'aud': 'authenticated' in the JWT, they are treated as authenticated users.
