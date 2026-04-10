-- supabase/migrations/20260405000002_delivery_reporting_overhaul.sql
-- ============================================================================
-- 1. ADD METADATA TO DELIVERIES
-- ============================================================================
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='deliveries' AND column_name='metadata') THEN
        ALTER TABLE public.deliveries ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- ============================================================================
-- 2. CREATE REPORTS TABLE (Audit Repository)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.client_billing(id) ON DELETE CASCADE,
    delivery_id UUID REFERENCES public.deliveries(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    report_type TEXT NOT NULL DEFAULT 'delivery_verification',
    report_data JSONB NOT NULL,
    generated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indices for reporting performance
CREATE INDEX IF NOT EXISTS idx_reports_client ON public.reports(client_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON public.reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_delivery ON public.reports(delivery_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);

-- ============================================================================
-- 3. RLS POLICIES FOR REPORTS
-- ============================================================================
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view reports for their organization" ON public.reports;
CREATE POLICY "Users can view reports for their organization"
ON public.reports FOR SELECT
USING (client_id = (SELECT client_id FROM profiles WHERE supabase_uid = auth.uid()));

DROP POLICY IF EXISTS "Users can create reports for their organization" ON public.reports;
CREATE POLICY "Users can create reports for their organization"
ON public.reports FOR INSERT
WITH CHECK (client_id = (SELECT client_id FROM profiles WHERE supabase_uid = auth.uid()));
