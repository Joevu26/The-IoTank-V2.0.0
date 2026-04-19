-- supabase/migrations/20260421100000_persist_shift_snapshots.sql
-- ============================================================================
-- PERSISTENCE HARDENING: Active Shift Snapshots & Forensic Metadata
-- ============================================================================

-- 1. ADD PERSISTENT SNAPSHOT STORAGE TO ACTIVE SHIFTS
-- ============================================================================
ALTER TABLE public.current_station_shifts 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN public.current_station_shifts.metadata IS 'Stores volatile shift data including tank_snapshots {tank_id: {opening_volume, captured_at, is_manual_override, original_sensor_value}}';

-- 2. ADD FORENSIC METADATA TO HISTORICAL CLOSURES
-- ============================================================================
ALTER TABLE public.shift_closures
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN public.shift_closures.metadata IS 'Detailed forensic data including override history and AI-driven variance analysis.';

-- 3. ENSURE Realtime IS ENABLED FOR THESE COLUMNS
-- ============================================================================
-- (Realtime is already enabled for the table, this will propagate to new columns)
