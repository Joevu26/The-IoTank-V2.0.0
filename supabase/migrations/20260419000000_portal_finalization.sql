-- supabase/migrations/20260419000000_portal_finalization.sql
-- ============================================================================
-- PORTAL FINALIZATION: MISSING INFRASTRUCTURE
-- ============================================================================

-- 1. Firmware Campaigns (OTA Rollouts)
CREATE TABLE IF NOT EXISTS public.firmware_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    target_version TEXT NOT NULL,
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'paused', 'completed', 'failed')),
    total_devices INTEGER DEFAULT 0,
    updated_devices INTEGER DEFAULT 0,
    failed_devices INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 2. System Tasks (Developer Hub Board)
CREATE TABLE IF NOT EXISTS public.system_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status TEXT DEFAULT 'backlog' CHECK (status IN ('backlog', 'in_progress', 'review', 'testing', 'ready', 'deployed')),
    assignee TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Newsletter Templates
CREATE TABLE IF NOT EXISTS public.newsletter_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subject TEXT,
    content_json JSONB DEFAULT '[]'::jsonb,
    category TEXT DEFAULT 'Product',
    last_modified TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 4. RPC: Get Administrative Risk Matrix
-- Calculates risk scores for all system users based on their critical/security events
CREATE OR REPLACE FUNCTION public.get_admin_risk_matrix()
RETURNS TABLE (
    actor_uid UUID,
    actor_email TEXT,
    high_risk_actions BIGINT,
    security_alerts BIGINT,
    risk_score FLOAT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH actor_stats AS (
        SELECT 
            u.auth_user_id as actor_uid,
            u.email as actor_email,
            COUNT(e.id) FILTER (WHERE e.severity = 'CRITICAL') as high_risk,
            COUNT(e.id) FILTER (WHERE e.event_category = 'SECURITY') as security_events
        FROM public.system_users u
        LEFT JOIN public.unified_events e ON e.metadata->>'actor_uid' = u.auth_user_id::text
        GROUP BY u.auth_user_id, u.email
    )
    SELECT 
        s.actor_uid,
        s.actor_email,
        s.high_risk,
        s.security_events,
        (s.high_risk * 10.0 + s.security_events * 5.0) as risk_score
    FROM actor_stats s
    ORDER BY risk_score DESC;
END;
$$;

-- 5. Enable RLS on new tables
ALTER TABLE public.firmware_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_templates ENABLE ROW LEVEL SECURITY;

-- Admins can manage all
DROP POLICY IF EXISTS "Admins full access to firmware_campaigns" ON public.firmware_campaigns;
CREATE POLICY "Admins full access to firmware_campaigns" ON public.firmware_campaigns FOR ALL USING (public.is_system_admin('admin_helper'));

DROP POLICY IF EXISTS "Admins full access to system_tasks" ON public.system_tasks;
CREATE POLICY "Admins full access to system_tasks" ON public.system_tasks FOR ALL USING (public.is_system_admin('admin_helper'));

DROP POLICY IF EXISTS "Admins full access to newsletter_templates" ON public.newsletter_templates;
CREATE POLICY "Admins full access to newsletter_templates" ON public.newsletter_templates FOR ALL USING (public.is_system_admin('admin_helper'));

-- 6. Seed some default data if empty
INSERT INTO public.system_tasks (title, description, priority, status)
SELECT 'Implement GeoJSON station pulse', 'Bind TacticalMap to live station coordinates for real-time visualization.', 'high', 'in_progress'
WHERE NOT EXISTS (SELECT 1 FROM public.system_tasks WHERE title = 'Implement GeoJSON station pulse');

INSERT INTO public.knowledge_base (title, category, content, is_published)
SELECT 'Platform Onboarding', 'onboarding', 'Welcome to the IoTank Administration suite...', true
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base WHERE title = 'Platform Onboarding');
