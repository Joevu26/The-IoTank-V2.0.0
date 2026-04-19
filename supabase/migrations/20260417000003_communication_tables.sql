-- supabase/migrations/20260417000003_communication_tables.sql
-- ============================================================================
-- FEATURE: Global Communication Infrastructure
-- ============================================================================

-- 1. Announcements Table
CREATE TABLE IF NOT EXISTS public.global_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    channels TEXT[] DEFAULT ARRAY['Dashboard']::TEXT[],
    target_audience TEXT DEFAULT 'All',
    status TEXT DEFAULT 'sent', -- sent, scheduled, draft, cancelled
    recipients_count INT DEFAULT 0,
    open_rate FLOAT DEFAULT 0,
    click_rate FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 2. Dashboard Banners Table
CREATE TABLE IF NOT EXISTS public.dashboard_banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT DEFAULT 'info', -- info, warning, error, success
    message TEXT NOT NULL,
    target TEXT DEFAULT 'All',
    is_dismissible BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id)
);

-- 3. Security & RLS
ALTER TABLE public.global_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_banners ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
DROP POLICY IF EXISTS "Admins full access to announcements" ON public.global_announcements;
CREATE POLICY "Admins full access to announcements" ON public.global_announcements
    FOR ALL USING (EXISTS (SELECT 1 FROM public.system_users WHERE auth_user_id = auth.uid() AND is_active = TRUE));

DROP POLICY IF EXISTS "Admins full access to banners" ON public.dashboard_banners;
CREATE POLICY "Admins full access to banners" ON public.dashboard_banners
    FOR ALL USING (EXISTS (SELECT 1 FROM public.system_users WHERE auth_user_id = auth.uid() AND is_active = TRUE));

-- Clients/Users can read active banners
DROP POLICY IF EXISTS "Everyone can read active banners" ON public.dashboard_banners;
CREATE POLICY "Everyone can read active banners" ON public.dashboard_banners
    FOR SELECT USING (is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW()));

-- Clients can read announcements targeted to them (Simplified 'All' check for now)
DROP POLICY IF EXISTS "Everyone can read announcements" ON public.global_announcements;
CREATE POLICY "Everyone can read announcements" ON public.global_announcements
    FOR SELECT USING (status = 'sent' AND target_audience = 'All');

-- 4. Audit Logging Trigger
DROP TRIGGER IF EXISTS on_announcement_created ON public.global_announcements;
CREATE TRIGGER on_announcement_created
    AFTER INSERT ON public.global_announcements
    FOR EACH ROW EXECUTE FUNCTION public.log_admin_action();

DROP TRIGGER IF EXISTS on_banner_modified ON public.dashboard_banners;
CREATE TRIGGER on_banner_modified
    AFTER INSERT OR UPDATE ON public.dashboard_banners
    FOR EACH ROW EXECUTE FUNCTION public.log_admin_action();
