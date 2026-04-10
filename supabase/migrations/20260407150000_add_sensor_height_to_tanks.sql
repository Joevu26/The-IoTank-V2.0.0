-- supabase/migrations/20260407150000_add_sensor_height_to_tanks.sql
-- ============================================================================
-- Migration: Add sensor_height column to tanks table
-- Created:   2026-04-07
-- Purpose:   Explicitly store the distance from the ultrasonic sensor
--            to the bottom of the tank to refine level calculations.
-- ============================================================================

-- Add sensor_height column (cm)
ALTER TABLE public.tanks
    ADD COLUMN IF NOT EXISTS sensor_height NUMERIC(10,2) DEFAULT NULL;

-- Descriptive comment for the schema
COMMENT ON COLUMN public.tanks.sensor_height IS
    'Distance (cm) measured from the face of the ultrasonic sensor to the physical bottom of the tank.';

-- Optional: If we want to backfill existing tanks with their tank_height as sensor_height
UPDATE public.tanks
SET sensor_height = tank_height
WHERE sensor_height IS NULL;
