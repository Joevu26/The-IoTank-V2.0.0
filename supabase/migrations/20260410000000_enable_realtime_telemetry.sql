-- supabase/migrations/20260410000000_enable_realtime_telemetry.sql
-- ============================================================================
-- REALTIME ENABLEMENT: Live Telemetry & Alerts
-- ============================================================================
-- Enables Supabase Realtime for the core operational tables to allow 
-- "live listening" in the dashboard without page refreshes.
-- ============================================================================

-- 1. Enable Realtime for the 'tanks' table
-- This allows instant updates to the volume cards and gauge displays.
ALTER PUBLICATION supabase_realtime ADD TABLE public.tanks;

-- 2. Enable Realtime for the 'alerts' table
-- This allows instant toast notifications and counter updates for new alerts.
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;

-- 3. Enable Realtime for 'sensor_readings' (Optional, but good for debug stream)
-- We typically listen to 'tanks' for the final calculated volume, but 
-- enabling 'sensor_readings' allows for a sub-second "pulse" indicator.
ALTER PUBLICATION supabase_realtime ADD TABLE public.sensor_readings;

-- 4. RELOAD: PostgREST Schema (to sync column availability in realtime filters)
NOTIFY pgrst, 'reload schema';
