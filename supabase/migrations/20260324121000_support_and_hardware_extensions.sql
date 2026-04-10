-- supabase/migrations/20260324121000_support_and_hardware_extensions.sql
-- ============================================================================
-- SUPPORT INFRASTRUCTURE EXTENSIONS
-- ============================================================================

-- Support Categories
CREATE TABLE IF NOT EXISTS public.support_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    default_priority TEXT DEFAULT 'medium' CHECK (default_priority IN ('low', 'medium', 'high', 'urgent')),
    sla_hours INTEGER DEFAULT 24,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Canned Responses (Templates)
CREATE TABLE IF NOT EXISTS public.canned_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge Base Articles
CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT,
    views INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- HARDWARE & TELEMETRY INFRASTRUCTURE
-- ============================================================================

-- Device Registry
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT UNIQUE NOT NULL, -- ESP32 Chip ID or similar
    client_id UUID REFERENCES public.client_billing(id) ON DELETE CASCADE,
    station_name TEXT,
    model TEXT CHECK (model IN ('ESP32-S3', 'ESP32-WROOM')),
    firmware_version TEXT,
    status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'maintenance', 'error')),
    last_seen TIMESTAMP WITH TIME ZONE,
    lat DECIMAL(9,6),
    lng DECIMAL(9,6),
    ip_address TEXT,
    mac_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Telemetry History (Time-series)
CREATE TABLE IF NOT EXISTS public.telemetry_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE,
    cpu_usage SMALLINT,
    ram_usage SMALLINT,
    temp DECIMAL(5,2),
    voltage DECIMAL(4,2),
    rssi SMALLINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.support_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canned_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_history ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Public read for support metadata" ON public.support_categories;
CREATE POLICY "Public read for support metadata" ON public.support_categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read for canned responses" ON public.canned_responses;
CREATE POLICY "Public read for canned responses" ON public.canned_responses FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read for knowledge base" ON public.knowledge_base;
CREATE POLICY "Public read for knowledge base" ON public.knowledge_base FOR SELECT TO authenticated USING (is_published = true);

-- Admins can manage all
DROP POLICY IF EXISTS "Admins manage support metadata" ON public.support_categories;
CREATE POLICY "Admins manage support metadata" ON public.support_categories FOR ALL TO authenticated USING (public.is_system_admin('support_staff'));

DROP POLICY IF EXISTS "Admins manage canned responses" ON public.canned_responses;
CREATE POLICY "Admins manage canned responses" ON public.canned_responses FOR ALL TO authenticated USING (public.is_system_admin('support_staff'));

DROP POLICY IF EXISTS "Admins manage knowledge base" ON public.knowledge_base;
CREATE POLICY "Admins manage knowledge base" ON public.knowledge_base FOR ALL TO authenticated USING (public.is_system_admin('support_staff'));

-- Device policies
DROP POLICY IF EXISTS "Clients view own devices" ON public.devices;
CREATE POLICY "Clients view own devices" ON public.devices FOR SELECT TO authenticated 
USING (client_id IN (SELECT client_id FROM public.profiles WHERE supabase_uid = auth.uid()));

DROP POLICY IF EXISTS "Admins manage all devices" ON public.devices;
CREATE POLICY "Admins manage all devices" ON public.devices FOR ALL TO authenticated USING (public.is_system_admin('admin_helper'));
