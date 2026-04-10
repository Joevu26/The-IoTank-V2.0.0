-- supabase/migrations/20260330000000_volume_lookup_tables.sql
-- ============================================================================
-- VOLUME LOOKUP TABLES (Calibration Data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.volume_lookup_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tank_type TEXT NOT NULL, -- e.g., 'Horizontal Cylindrical', 'Vertical'
    dip_mm INTEGER NOT NULL,
    volume_liters DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tank_type, dip_mm)
);

-- Enable RLS
ALTER TABLE public.volume_lookup_tables ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Super Admin manage lookup tables" ON public.volume_lookup_tables;
CREATE POLICY "Super Admin manage lookup tables" ON public.volume_lookup_tables FOR ALL TO authenticated 
USING (public.is_system_admin('admin_helper'));

DROP POLICY IF EXISTS "Authenticated read for lookup tables" ON public.volume_lookup_tables;
CREATE POLICY "Authenticated read for lookup tables" ON public.volume_lookup_tables FOR SELECT TO authenticated 
USING (true);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_vlt_tank_type ON public.volume_lookup_tables(tank_type);
CREATE INDEX IF NOT EXISTS idx_vlt_dip_mm ON public.volume_lookup_tables(dip_mm);
