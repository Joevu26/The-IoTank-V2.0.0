-- supabase/migrations/20260419120000_operational_intelligence.sql
-- ============================================================================
-- FEATURE: Operational Intelligence & Automation
-- ============================================================================

-- 1. Support Message Threading
CREATE TABLE IF NOT EXISTS public.ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id),
    sender_role TEXT CHECK (sender_role IN ('admin', 'client', 'system')),
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    attachments JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sender_name TEXT -- Cached for quick display
);

-- 2. Financial Invoicing Ledger
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID REFERENCES public.fuel_stations(station_id) ON DELETE CASCADE,
    invoice_number TEXT UNIQUE NOT NULL,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    amount_due DECIMAL(12,2) NOT NULL,
    amount_paid DECIMAL(12,2) DEFAULT 0,
    status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partially_paid', 'paid', 'void', 'overdue')),
    due_date DATE NOT NULL,
    pdf_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Super Admin internal notifications
CREATE TABLE IF NOT EXISTS public.system_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_admin_id UUID REFERENCES auth.users(id), -- NULL for all admins
    category TEXT DEFAULT 'system' CHECK (category IN ('system', 'security', 'sla', 'billing')),
    priority TEXT DEFAULT 'info' CHECK (priority IN ('info', 'warning', 'critical')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB, -- e.g. { "ticket_id": "...", "station_id": "..." }
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS & Security
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;

-- Admins can manage everything
CREATE POLICY "Admins manage ticket messages" ON public.ticket_messages
    FOR ALL USING (EXISTS (SELECT 1 FROM public.system_users WHERE auth_user_id = auth.uid() AND is_active = TRUE));

CREATE POLICY "Admins manage invoices" ON public.invoices
    FOR ALL USING (EXISTS (SELECT 1 FROM public.system_users WHERE auth_user_id = auth.uid() AND is_active = TRUE));

CREATE POLICY "Admins manage system notifications" ON public.system_notifications
    FOR ALL USING (EXISTS (SELECT 1 FROM public.system_users WHERE auth_user_id = auth.uid() AND is_active = TRUE));

-- Clients/Users can see their own
CREATE POLICY "Clients see their own messages" ON public.ticket_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.support_tickets st 
            JOIN public.fuel_stations fs ON st.station_id = fs.station_id
            WHERE st.id = ticket_id AND fs.station_id IN (SELECT station_id FROM public.profiles WHERE auth_user_id = auth.uid())
        )
    );

CREATE POLICY "Clients see their own invoices" ON public.invoices
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.fuel_stations fs 
            WHERE fs.station_id = station_id AND fs.station_id IN (SELECT station_id FROM public.profiles WHERE auth_user_id = auth.uid())
        )
    );

-- 5. Automation Logic (Functions)

-- Function to process monthly invoicing
CREATE OR REPLACE FUNCTION public.process_monthly_invoicing()
RETURNS void AS $$
DECLARE
    station_record RECORD;
    v_billable_units INTEGER;
    current_mrr DECIMAL(12,2);
    next_invoice_num TEXT;
BEGIN
    FOR station_record IN SELECT station_id, station_name FROM public.fuel_stations LOOP
        -- Simple logic: KES 2,000 per unit (tank)
        v_billable_units := (SELECT COUNT(*) FROM public.tanks WHERE station_id = station_record.station_id);
        current_mrr := v_billable_units * 2000;
        
        next_invoice_num := 'INV-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || SUBSTRING(station_record.station_id::TEXT, 1, 4);
        
        INSERT INTO public.invoices (
            station_id,
            invoice_number,
            billing_period_start,
            billing_period_end,
            amount_due,
            status,
            due_date
        ) VALUES (
            station_record.station_id,
            next_invoice_num,
            (DATE_TRUNC('month', NOW()) - INTERVAL '1 month')::DATE,
            (DATE_TRUNC('month', NOW()) - INTERVAL '1 day')::DATE,
            current_mrr,
            'unpaid',
            (DATE_TRUNC('month', NOW()) + INTERVAL '4 days')::DATE
        ) ON CONFLICT (invoice_number) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to check SLA breaches
CREATE OR REPLACE FUNCTION public.check_sla_breaches()
RETURNS void AS $$
DECLARE
    ticket_record RECORD;
BEGIN
    FOR ticket_record IN 
        SELECT st.*, fs.station_name 
        FROM public.support_tickets st
        JOIN public.fuel_stations fs ON st.station_id = fs.station_id
        WHERE st.status NOT IN ('resolved', 'closed')
        AND st.created_at < (NOW() - INTERVAL '4 hours')
    LOOP
        -- Check if already notified to avoid spam
        IF NOT EXISTS (
            SELECT 1 FROM public.system_notifications 
            WHERE category = 'sla' 
            AND metadata->>'ticket_id' = ticket_record.id::TEXT 
            AND created_at > (NOW() - INTERVAL '12 hours')
        ) THEN
            INSERT INTO public.system_notifications (
                category,
                priority,
                title,
                message,
                metadata
            ) VALUES (
                'sla',
                'critical',
                'SLA Breach Detected',
                'Ticket #' || SUBSTRING(ticket_record.id::TEXT, 1, 8) || ' for ' || ticket_record.station_name || ' has exceeded the 4-hour response threshold.',
                jsonb_build_object('ticket_id', ticket_record.id)
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Trigger for Auto-Naming Messages
CREATE OR REPLACE FUNCTION public.stamp_sender_name()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.sender_role = 'admin' THEN
        NEW.sender_name := (SELECT full_name FROM public.system_users WHERE auth_user_id = NEW.sender_id);
    ELSIF NEW.sender_role = 'client' THEN
        NEW.sender_name := (SELECT full_name FROM public.profiles WHERE auth_user_id = NEW.sender_id);
    ELSE
        NEW.sender_name := 'System AI';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_message_created
    BEFORE INSERT ON public.ticket_messages
    FOR EACH ROW EXECUTE FUNCTION public.stamp_sender_name();
