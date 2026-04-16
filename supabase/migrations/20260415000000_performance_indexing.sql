-- ==============================================================================
-- Migration: Performance Indexing
-- Description: Composite index optimizations for real-time dashboard responsiveness.
-- ==============================================================================

-- Index for main dashboard query optimization:
-- Filtering by tank_id and ordering by timestamp descending is the most 
-- frequent read path (useLatestReading, useAllLatestReadings).
CREATE INDEX IF NOT EXISTS idx_sensor_readings_tank_id_timestamp 
ON sensor_readings (tank_id, timestamp DESC);

-- Also indexing unified events for fast filtering by station and resolution
CREATE INDEX IF NOT EXISTS idx_unified_events_station_resolved 
ON unified_events (station_id, is_resolved, created_at DESC);
