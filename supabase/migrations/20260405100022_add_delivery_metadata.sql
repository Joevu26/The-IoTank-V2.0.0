-- supabase/migrations/20260405000002_add_delivery_metadata.sql
-- ============================================================================
-- ADD METADATA COLUMN TO DELIVERIES: For storing quality & high-fidelity metrics
-- ============================================================================

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='deliveries' AND column_name='metadata') THEN
        ALTER TABLE public.deliveries ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Add index for forensic querying of quality data
CREATE INDEX IF NOT EXISTS idx_deliveries_metadata ON public.deliveries USING GIN (metadata);
