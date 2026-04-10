-- supabase/migrations/20260321000006_support_system.sql
-- ============================================================================
-- SUPPORT INFRASTRUCTURE: TICKETING SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.client_billing(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' 
        CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to TEXT, -- firebase_uid of system_user
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Clients can view and create their own tickets
DROP POLICY IF EXISTS "Clients can manage their own tickets" ON public.support_tickets;
CREATE POLICY "Clients can manage their own tickets"
ON public.support_tickets FOR ALL
TO authenticated
USING (client_id IN (
    SELECT client_id FROM public.profiles WHERE firebase_uid = public.firebase_uid()
))
WITH CHECK (client_id IN (
    SELECT client_id FROM public.profiles WHERE firebase_uid = public.firebase_uid()
));

-- System admins can manage all tickets
DROP POLICY IF EXISTS "System admins can manage all tickets" ON public.support_tickets;
CREATE POLICY "System admins can manage all tickets"
ON public.support_tickets FOR ALL
TO authenticated
USING (public.is_system_admin(3))
WITH CHECK (public.is_system_admin(3));

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER update_support_tickets_updated_at
    BEFORE UPDATE ON public.support_tickets
    FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Seed data removed to prevent foreign key errors.
