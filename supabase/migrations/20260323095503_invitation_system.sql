-- supabase/migrations/20260322000003_invitation_system.sql
-- ============================================================================
-- SYSTEM: DELEGATED INVITATION TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invitation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    station_name TEXT NOT NULL,
    invited_by_uid UUID REFERENCES auth.users(id), -- Station Owner ID
    invited_by_name TEXT, -- Cached name for display
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- Indexing for speed
CREATE INDEX IF NOT EXISTS idx_invites_status ON public.invitation_requests(status);
CREATE INDEX IF NOT EXISTS idx_invites_email ON public.invitation_requests(email);

-- RLS
ALTER TABLE public.invitation_requests ENABLE ROW LEVEL SECURITY;

-- Super Admins can manage all invites
DROP POLICY IF EXISTS "Super Admins manage all invites" ON public.invitation_requests;
CREATE POLICY "Super Admins manage all invites"ON public.invitation_requests FOR ALL 
TO authenticated 
USING (get_auth_level() <= 1);

-- Station Owners (Level 5) can view their own sent invites
DROP POLICY IF EXISTS "Inviters can view their own requests" ON public.invitation_requests;
CREATE POLICY "Inviters can view their own requests" 
ON public.invitation_requests FOR SELECT 
TO authenticated 
USING (invited_by_uid = auth.uid());

-- Station Owners can INSERT new requests
DROP POLICY IF EXISTS "Station Owners can submit invite requests" ON public.invitation_requests;
CREATE POLICY "Station Owners can submit invite requests" 
ON public.invitation_requests FOR INSERT 
TO authenticated 
WITH CHECK (get_auth_level() = 5);
