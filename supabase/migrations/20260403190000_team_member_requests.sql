-- Migration: Create team_member_requests table
-- Purpose: Allows client station owners to submit team member add requests
--          that go to Super Admin for review and approval.
-- Fix: client_billing PK is `id`, not `client_id`

CREATE TABLE IF NOT EXISTS public.team_member_requests (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID            REFERENCES public.client_billing(id) ON DELETE CASCADE,
    station_name    TEXT,
    full_name       TEXT            NOT NULL,
    email           TEXT            NOT NULL,
    role            TEXT            NOT NULL CHECK (role IN ('supervisor', 'operator', 'viewer')),
    status          TEXT            NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_by    UUID,
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_tmr_client_id ON public.team_member_requests (client_id);
CREATE INDEX IF NOT EXISTS idx_tmr_status    ON public.team_member_requests (status);

ALTER TABLE public.team_member_requests ENABLE ROW LEVEL SECURITY;

-- 1. DROP existing policies if any (for idempotency)
DROP POLICY IF EXISTS "client_can_view_own_requests" ON public.team_member_requests;
DROP POLICY IF EXISTS "client_can_insert_own_requests" ON public.team_member_requests;
DROP POLICY IF EXISTS "system_user_can_view_all_requests" ON public.team_member_requests;
DROP POLICY IF EXISTS "system_user_can_update_requests" ON public.team_member_requests;

-- RLS: Station owners/admins can view their own station's requests
CREATE POLICY "client_can_view_own_requests" ON public.team_member_requests
    FOR SELECT
    USING (
        client_id = (
            SELECT client_id FROM public.profiles
            WHERE supabase_uid = auth.uid()
            LIMIT 1
        )
    );

-- RLS: Station owners/admins can insert requests for their own station
CREATE POLICY "client_can_insert_own_requests" ON public.team_member_requests
    FOR INSERT
    WITH CHECK (
        client_id = (
            SELECT client_id FROM public.profiles
            WHERE supabase_uid = auth.uid()
            LIMIT 1
        )
    );

-- RLS: Active system users (super admin staff) can view all requests
CREATE POLICY "system_user_can_view_all_requests" ON public.team_member_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.system_users
            WHERE supabase_uid = auth.uid()
              AND is_active = TRUE
        )
    );

-- RLS: Active system users can update (approve/reject) all requests
CREATE POLICY "system_user_can_update_requests" ON public.team_member_requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.system_users
            WHERE supabase_uid = auth.uid()
              AND is_active = TRUE
        )
    );

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.update_team_member_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tmr_updated_at ON public.team_member_requests;
CREATE TRIGGER trg_tmr_updated_at
    BEFORE UPDATE ON public.team_member_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_team_member_requests_updated_at();
