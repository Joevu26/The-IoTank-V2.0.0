-- supabase/migrations/20260407100000_patch_tank_volume_bounds.sql
-- ============================================================================
-- REMEDIATION: Fix Volume Anomaly bounds
-- ============================================================================

-- Ensure current volume cannot explicitly breach the designated physical max capacity limit
ALTER TABLE public.tanks DROP CONSTRAINT IF EXISTS check_tank_volume_bounds;
ALTER TABLE public.tanks ADD CONSTRAINT check_tank_volume_bounds CHECK (current_volume >= 0 AND current_volume <= tank_capacity);
