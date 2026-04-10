-- ============================================================
-- Migration: Add sensor calibration distance columns to tanks
-- Created:   2026-04-05
-- Purpose:   Store the raw sensor readings that correspond to
--            the EMPTY and FULL states of each tank. These two
--            values, together with sensor_height, allow the
--            firmware & backend to map raw echo distance (cm)
--            to a precise fill-level percentage independent of
--            geometric tank-shape assumptions.
-- ============================================================

-- Add EMPTY calibration distance column (cm from sensor at EMPTY state)
ALTER TABLE tanks
    ADD COLUMN IF NOT EXISTS sensor_empty_distance NUMERIC(10,2) DEFAULT NULL;

-- Add FULL calibration distance column (cm from sensor at FULL state)
ALTER TABLE tanks
    ADD COLUMN IF NOT EXISTS sensor_full_distance NUMERIC(10,2) DEFAULT NULL;

-- Descriptive comments for the schema
COMMENT ON COLUMN tanks.sensor_empty_distance IS
    'Distance (cm) echoed by the ultrasonic sensor when the tank is completely empty. Used for level calibration.';

COMMENT ON COLUMN tanks.sensor_full_distance IS
    'Distance (cm) echoed by the ultrasonic sensor when the tank is completely full. Used for level calibration.';
