-- supabase/migrations/20260421160000_harden_hardware_isolation.sql
-- ============================================================================
-- HARDENING: Forensic Hardware Isolation for Multiple Tanks
-- ============================================================================
-- Ensures that an ESP32 belonging to Station A cannot send data to tanks
-- belonging to Station B, even if the device sends its valid Station A JWT.
-- ============================================================================

-- 1. RE-DEFINE: update_tank_from_sensor with strict ownership verification
-- This is a SECURITY DEFINER function so it bypasses RLS, making this check critical.
CREATE OR REPLACE FUNCTION public.update_tank_from_sensor()
RETURNS TRIGGER AS $$
DECLARE
    v_tank_station_id UUID;
BEGIN
    -- [FORENSIC CHECK]: Verify that the tank being updated belongs to the station in the reading
    SELECT station_id INTO v_tank_station_id
    FROM public.tanks
    WHERE id = NEW.tank_id;

    -- If tank doesn't exist or station mismatch, block the entire operation
    IF v_tank_station_id IS NULL OR v_tank_station_id != NEW.station_id THEN
        RAISE EXCEPTION 'Hardware Authorization Failure: Tank ID % does not belong to Station ID %. Cross-station spoofing prevented.', NEW.tank_id, NEW.station_id;
    END IF;

    -- 2. Update the tank state
    UPDATE public.tanks t
    SET current_volume        = NEW.volume,
        current_temperature   = NEW.temperature,
        last_reading_at       = NOW(), 
        updated_at            = NOW()
    WHERE t.id = NEW.tank_id;
  
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. ADD: Constraint to sensor_readings for extra redundancy
-- Validates at the row level that the reading station matches the tank station.
CREATE OR REPLACE FUNCTION public.validate_reading_station_match()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.tanks
        WHERE id = NEW.tank_id AND station_id = NEW.station_id
    ) THEN
        RAISE EXCEPTION 'Telemetry Integrity Failure: Station ownership mismatch for tank %', NEW.tank_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_reading_station ON public.sensor_readings;
CREATE TRIGGER trigger_validate_reading_station
BEFORE INSERT ON public.sensor_readings
FOR EACH ROW EXECUTE FUNCTION public.validate_reading_station_match();

-- 3. AUDIT: (Skipped for manual check)
-- Reload PostgREST
NOTIFY pgrst, 'reload schema';

-- Reload PostgREST
NOTIFY pgrst, 'reload schema';
