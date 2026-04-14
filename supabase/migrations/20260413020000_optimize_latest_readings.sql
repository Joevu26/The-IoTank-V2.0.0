-- supabase/migrations/20260413020000_optimize_latest_readings.sql
-- Optimized view for fetching only the latest telemetry per tank

CREATE OR REPLACE VIEW public.latest_sensor_readings 
WITH (security_invoker = true) AS 
SELECT DISTINCT ON (tank_id) 
    *
FROM 
    public.sensor_readings
ORDER BY 
    tank_id, 
    timestamp DESC;

-- Grant access
GRANT SELECT ON public.latest_sensor_readings TO authenticated;
