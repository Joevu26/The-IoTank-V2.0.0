-- supabase/migrations/20260408000000_remove_raw_distance.sql

-- Drop the dependent view first
DROP VIEW IF EXISTS public.tank_readings;

-- Drop the columns
ALTER TABLE public.sensor_readings DROP COLUMN IF EXISTS raw_distance;

-- Safely drop from daily_summaries only if the table exists (it appears missing in some environments)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_summaries' AND table_schema = 'public') THEN
        EXECUTE 'ALTER TABLE public.daily_summaries DROP COLUMN IF EXISTS avg_raw_distance';
    END IF;
END $$;

-- Recreate the view (it will automatically pick up the new sensor_readings schema)
-- Use SECURITY INVOKER to ensure it respects RLS of the querying user
CREATE VIEW public.tank_readings WITH (security_invoker = true) AS SELECT * FROM public.sensor_readings;

-- Update any comments for clarity
COMMENT ON COLUMN public.sensor_readings.ambient_volume IS 'The raw volume reading from the sensor (uncompensated)';
