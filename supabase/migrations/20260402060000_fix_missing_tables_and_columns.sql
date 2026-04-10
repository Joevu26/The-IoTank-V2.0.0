-- supabase/migrations/20260402060000_fix_missing_tables_and_columns.sql
-- ============================================================================
-- FIX: Create missing tables and ensure schema consistency
-- ============================================================================

-- 1. Create supply_risks table if not exists
CREATE TABLE IF NOT EXISTS public.supply_risks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    source_url TEXT,
    type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    description TEXT,
    affected_regions TEXT[],
    confidence DECIMAL(3,2),
    source_type TEXT,
    attribution TEXT,
    timestamp TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create market_news table if not exists
CREATE TABLE IF NOT EXISTS public.market_news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    link TEXT,
    pub_date TIMESTAMPTZ,
    content_snippet TEXT,
    source_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create event_logs table if not exists
CREATE TABLE IF NOT EXISTS public.event_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.client_billing(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Ensure alerts has timestamp column (or alias it)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alerts' AND column_name = 'timestamp'
    ) THEN
        ALTER TABLE public.alerts ADD COLUMN timestamp TIMESTAMPTZ DEFAULT now();
        -- Sync existing data
        UPDATE public.alerts SET timestamp = created_at WHERE timestamp IS NULL;
    END IF;
END $$;

-- 5. Create tank_readings as a view or alias for sensor_readings to resolve inconsistencies
-- First check if tank_readings table exists, if not create a view
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tank_readings' AND table_schema = 'public') THEN
        CREATE VIEW public.tank_readings AS SELECT * FROM public.sensor_readings;
    END IF;
END $$;

-- 6. Enable RLS on new tables
ALTER TABLE public.supply_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;

-- 7. Basic RLS Policies (Allow authenticated users to read)
DROP POLICY IF EXISTS "Authenticated users can read supply risks" ON public.supply_risks;
CREATE POLICY "Authenticated users can read supply risks" ON public.supply_risks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read market news" ON public.market_news;
CREATE POLICY "Authenticated users can read market news" ON public.market_news FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can view their own event logs" ON public.event_logs;
CREATE POLICY "Users can view their own event logs" ON public.event_logs FOR SELECT TO authenticated 
USING (client_id IN (SELECT client_id FROM public.profiles WHERE supabase_uid = auth.uid()));

-- 8. Add index for performance
CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON public.alerts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_supply_risks_timestamp ON public.supply_risks(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_event_logs_client_created ON public.event_logs(client_id, created_at DESC);
