-- supabase/migrations/20260409001900_multi_tank_esp_support.sql
-- ============================================================================
-- ARCHITECTURAL UPDATE: Multi-Tank ESP Support (4 Tanks per Device)
-- ============================================================================
-- Allows a single ESP (sensor_id) to manage up to 4 channels.
-- Implements strict hardware-to-station locking.
-- ============================================================================

DO $$ 
BEGIN
    -- 1. CORE COLUMN: sensor_channel
    -- Default to 1 (Legacy single-tank mode compatible)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tanks' AND table_schema = 'public' AND column_name = 'sensor_channel'
    ) THEN
        ALTER TABLE public.tanks ADD COLUMN sensor_channel INTEGER DEFAULT 1 CHECK (sensor_channel BETWEEN 1 AND 4);
        COMMENT ON COLUMN public.tanks.sensor_channel IS 'Identifies which ESP channel (1-4) this tank is connected to.';
    END IF;

    -- 2. CONSTRAINT PIVOT: Move from Single-Tank to Multi-Tank
    -- Remove the globally unique sensor_id constraint
    ALTER TABLE public.tanks DROP CONSTRAINT IF EXISTS tanks_sensor_id_key;
    
    -- Ensure (sensor_id, sensor_channel) is unique
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_tanks_sensor_channel_unique' AND schemaname = 'public'
    ) THEN
        CREATE UNIQUE INDEX idx_tanks_sensor_channel_unique ON public.tanks(sensor_id, sensor_channel);
    END IF;

END $$;


-- 3. HARDWARE LOCKING: Prevent Cross-Station Sensor Hijacking
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_sensor_station_lock()
RETURNS TRIGGER AS $$
BEGIN
    -- If the sensor_id is already used in a different station, block the insert/update
    IF EXISTS (
        SELECT 1 FROM public.tanks 
        WHERE sensor_id = NEW.sensor_id 
        AND station_id != NEW.station_id
    ) THEN
        RAISE EXCEPTION 'Hardware Violation: ESP ID % is already registered and locked to another station. Please contact support to transfer hardware.', NEW.sensor_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sensor_station_lock ON public.tanks;
CREATE TRIGGER trigger_sensor_station_lock
BEFORE INSERT OR UPDATE OF sensor_id, station_id ON public.tanks
FOR EACH ROW 
WHEN (NEW.sensor_id IS NOT NULL)
EXECUTE FUNCTION public.check_sensor_station_lock();


-- 4. UPDATE RLS: Hardware devices can now insert for their whole station
-- ============================================================================
-- This allows a single ESP token to manage all 4 of its tanks.
DROP POLICY IF EXISTS "Hardware devices can insert readings" ON public.sensor_readings;
CREATE POLICY "Hardware devices can insert readings" ON public.sensor_readings
FOR INSERT WITH CHECK (
    ((auth.jwt() ->> 'role'::text) = 'device'::text) AND 
    (((auth.jwt() ->> 'station_id'::text))::uuid = station_id)
);

-- Reload PostgREST
NOTIFY pgrst, 'reload schema';
