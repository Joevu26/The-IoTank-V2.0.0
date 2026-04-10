-- supabase/migrations/20260411000000_performance_and_news.sql
-- ============================================================================
-- PERFORMANCE & REAL-TIME NEWS SYSTEM
-- ============================================================================

-- 1. NEWS SYSTEM: Market & Operational Intelligence
-- ============================================================================
-- Ensure the table exists
CREATE TABLE IF NOT EXISTS public.market_news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

-- Ensure all columns exist (Idempotent approach)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_news' AND column_name = 'title') THEN
        ALTER TABLE public.market_news ADD COLUMN title TEXT NOT NULL DEFAULT 'Untitled';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_news' AND column_name = 'summary') THEN
        ALTER TABLE public.market_news ADD COLUMN summary TEXT NOT NULL DEFAULT '';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_news' AND column_name = 'source_type') THEN
        ALTER TABLE public.market_news ADD COLUMN source_type TEXT DEFAULT 'system';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_news' AND column_name = 'attribution') THEN
        ALTER TABLE public.market_news ADD COLUMN attribution TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_news' AND column_name = 'priority') THEN
        ALTER TABLE public.market_news ADD COLUMN priority INTEGER DEFAULT 3;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_news' AND column_name = 'metadata') THEN
        ALTER TABLE public.market_news ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_news' AND column_name = 'expires_at') THEN
        ALTER TABLE public.market_news ADD COLUMN expires_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_news' AND column_name = 'created_at') THEN
        ALTER TABLE public.market_news ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_news' AND column_name = 'created_by') THEN
        ALTER TABLE public.market_news ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.market_news ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Everyone can view active news" ON public.market_news;
CREATE POLICY "Everyone can view active news"
ON public.market_news FOR SELECT
TO authenticated
USING (expires_at IS NULL OR expires_at > NOW());

DROP POLICY IF EXISTS "Admins can manage news" ON public.market_news;
CREATE POLICY "Admins can manage news"
ON public.market_news FOR ALL
TO authenticated
USING (public.get_auth_level() <= 2);

-- Enable Realtime
-- Use a DO block to avoid 'already exists' error on publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'market_news'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.market_news;
    END IF;
END $$;

-- 2. ANALYTICS ACCELERATION: Materialized Views
-- ============================================================================

-- tank_analytics_30d: Pre-aggregated historical trends
DROP MATERIALIZED VIEW IF EXISTS public.tank_analytics_30d CASCADE;
CREATE MATERIALIZED VIEW public.tank_analytics_30d AS
SELECT 
    tank_id,
    station_id,
    AVG(volume) as avg_volume,
    MIN(volume) as min_volume,
    MAX(volume) as max_volume,
    AVG(temperature) as avg_temperature,
    COUNT(*) as reading_count,
    NOW() as last_calculated_at
FROM public.sensor_readings
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY tank_id, station_id;

-- Index for the materialized view
CREATE INDEX idx_tank_analytics_station ON public.tank_analytics_30d(station_id);

-- Secure the materialized view from direct PostgREST API access
REVOKE ALL ON public.tank_analytics_30d FROM anon, authenticated;

-- Function to refresh the view
CREATE OR REPLACE FUNCTION refresh_tank_analytics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.tank_analytics_30d;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. PERFORMANCE INDEXES
-- ============================================================================

-- Faster tank lookups
CREATE INDEX IF NOT EXISTS idx_tanks_station_status ON public.tanks(station_id, status);

-- Faster telemetry historical scans
CREATE INDEX IF NOT EXISTS idx_sensor_readings_tank_time ON public.sensor_readings(tank_id, timestamp DESC);

-- Faster alert lookups
CREATE INDEX IF NOT EXISTS idx_alerts_station_resolved ON public.alerts(station_id, is_resolved);

-- Faster transaction lookups
CREATE INDEX IF NOT EXISTS idx_transactions_station_time ON public.transactions(station_id, created_at DESC);

-- 4. RELOAD
NOTIFY pgrst, 'reload schema';
