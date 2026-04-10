-- supabase/migrations/20260402_comprehensive_audit_logging.sql
-- ============================================================================
-- FEATURE: Comprehensive audit logging for all auth events and data access
-- ============================================================================

-- 0. Create admin_logs table if it doesn't exist (without foreign key constraints)
CREATE TABLE IF NOT EXISTS public.admin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL,
    action_type TEXT,
    admin_id UUID, -- Store UUID as TEXT to avoid FK conflicts
    admin_email TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 1. Enhance admin_logs table with additional columns
ALTER TABLE public.admin_logs
ADD COLUMN IF NOT EXISTS ip_address INET,
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS affected_email TEXT,
ADD COLUMN IF NOT EXISTS affected_user_id UUID,
ADD COLUMN IF NOT EXISTS detail_json JSONB,
ADD COLUMN IF NOT EXISTS status TEXT,
ADD COLUMN IF NOT EXISTS admin_id UUID,
ADD COLUMN IF NOT EXISTS admin_email TEXT;

-- Add CHECK constraint for status if the column was just created
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'admin_logs' AND constraint_name LIKE '%status%'
    ) THEN
        ALTER TABLE public.admin_logs 
        ADD CONSTRAINT admin_logs_status_check CHECK (status IN ('success', 'failure', 'warning'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_admin_logs_action_type ON public.admin_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_logs_affected_user_id ON public.admin_logs(affected_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON public.admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_logs(created_at);

-- 2. Create auth_events table for comprehensive authentication tracking
CREATE TABLE IF NOT EXISTS public.auth_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    ip_address INET,
    user_agent TEXT,
    status TEXT,
    error_message TEXT,
    detail_json JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add CHECK constraints for auth_events
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'auth_events' AND constraint_name = 'auth_events_event_type_check'
    ) THEN
        ALTER TABLE public.auth_events 
        ADD CONSTRAINT auth_events_event_type_check CHECK (event_type IN (
            'LOGIN_ATTEMPT', 'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'PASSWORD_CHANGE',
            'EMAIL_VERIFICATION_SENT', 'EMAIL_VERIFIED', 'ACCOUNT_CREATED', 'ACCOUNT_DELETED',
            'ROLE_CHANGED', 'PERMISSION_DENIED', 'SESSION_TIMEOUT'
        ));
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'auth_events' AND constraint_name = 'auth_events_status_check'
    ) THEN
        ALTER TABLE public.auth_events 
        ADD CONSTRAINT auth_events_status_check CHECK (status IN ('success', 'failure', 'warning'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_auth_events_user_id ON public.auth_events(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_events_event_type ON public.auth_events(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_events_created_at ON public.auth_events(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_events_ip_address ON public.auth_events(ip_address);

-- 3. Create data_access_logs table for tracking data access by operators
CREATE TABLE IF NOT EXISTS public.data_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_email TEXT,
    actor_role TEXT,
    resource_type TEXT,
    resource_id UUID,
    client_id UUID REFERENCES public.client_billing(id) ON DELETE SET NULL,
    action TEXT,
    rows_affected INTEGER,
    ip_address INET,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add CHECK constraints for data_access_logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'data_access_logs' AND constraint_name = 'data_access_logs_resource_type_check'
    ) THEN
        ALTER TABLE public.data_access_logs 
        ADD CONSTRAINT data_access_logs_resource_type_check CHECK (resource_type IN (
            'tanks', 'sensor_readings', 'alerts', 'client_billing',
            'transactions', 'usage_logs', 'profiles', 'system_users'
        ));
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'data_access_logs' AND constraint_name = 'data_access_logs_action_check'
    ) THEN
        ALTER TABLE public.data_access_logs 
        ADD CONSTRAINT data_access_logs_action_check CHECK (action IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_data_access_logs_actor_user_id ON public.data_access_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_data_access_logs_resource_type ON public.data_access_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_data_access_logs_action ON public.data_access_logs(action);
CREATE INDEX IF NOT EXISTS idx_data_access_logs_created_at ON public.data_access_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_data_access_logs_client_id ON public.data_access_logs(client_id);

-- 4. Create registration_events table for tracking registration flow
CREATE TABLE IF NOT EXISTS public.registration_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID REFERENCES public.pending_registrations(id) ON DELETE CASCADE,
    event_type TEXT,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_email TEXT,
    notes TEXT,
    detail_json JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add CHECK constraint for registration_events
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'registration_events' AND constraint_name = 'registration_events_event_type_check'
    ) THEN
        ALTER TABLE public.registration_events 
        ADD CONSTRAINT registration_events_event_type_check CHECK (event_type IN (
            'SUBMITTED', 'EMAIL_SENT_VERIFICATION', 'EMAIL_VERIFIED', 'REVIEWED', 'APPROVED',
            'REJECTED', 'ACCOUNT_PROVISIONED', 'ONBOARDING_STARTED', 'ONBOARDING_COMPLETED'
        ));
    END IF;
END $$;

COMMENT ON COLUMN public.registration_events.actor_user_id IS 'System admin who performed action';

CREATE INDEX IF NOT EXISTS idx_registration_events_registration_id ON public.registration_events(registration_id);
CREATE INDEX IF NOT EXISTS idx_registration_events_event_type ON public.registration_events(event_type);
CREATE INDEX IF NOT EXISTS idx_registration_events_actor_user_id ON public.registration_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_registration_events_created_at ON public.registration_events(created_at);

-- 5. Enable RLS on audit tables
ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_events ENABLE ROW LEVEL SECURITY;

-- 6. RLS: Only system admins can view all audit logs (with error handling)
-- These policies require functions from cleanup_firebase_migration migration
DO $$
BEGIN
    CREATE POLICY "System admins view all auth events"
        ON public.auth_events FOR SELECT
        TO authenticated
        USING (public.is_system_admin('support_staff'));
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'RLS policy for auth_events requires is_system_admin() function - will be created in cleanup migration';
END $$;

DO $$
BEGIN
    CREATE POLICY "Users can view their own auth events"
        ON public.auth_events FOR SELECT
        TO authenticated
        USING (user_id = auth.uid());
EXCEPTION WHEN OTHERS THEN
    NULL; -- Silently fail if policy already exists
END $$;

DO $$
BEGIN
    CREATE POLICY "System admins view all data access logs"
        ON public.data_access_logs FOR SELECT
        TO authenticated
        USING (public.is_system_admin('support_staff'));
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'RLS policy for data_access_logs requires is_system_admin() function - will be created in cleanup migration';
END $$;

DO $$
BEGIN
    CREATE POLICY "Users view their data access in their organization"
        ON public.data_access_logs FOR SELECT
        TO authenticated
        USING (
            actor_user_id = auth.uid()
            OR client_id = public.get_user_client_id()
            OR public.is_system_admin('support_staff')
        );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'RLS policy for data_access_logs requires get_user_client_id() and is_system_admin() functions';
END $$;

DO $$
BEGIN
    CREATE POLICY "System admins view all registration events"
        ON public.registration_events FOR SELECT
        TO authenticated
        USING (public.is_system_admin('support_staff'));
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'RLS policy for registration_events requires is_system_admin() function - will be created in cleanup migration';
END $$;

-- 7. Create logging function
DROP FUNCTION IF EXISTS public.log_auth_event(TEXT, TEXT, INET, TEXT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.log_auth_event(
    p_event_type TEXT,
    p_user_email TEXT,
    p_ip_address INET,
    p_user_agent TEXT,
    p_status TEXT,
    p_error_message TEXT DEFAULT NULL,
    p_detail_json JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.auth_events (
        event_type, user_id, user_email, ip_address, user_agent,
        status, error_message, detail_json
    ) VALUES (
        p_event_type, auth.uid(), p_user_email, p_ip_address, p_user_agent,
        p_status, p_error_message, p_detail_json
    );
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail auth operations
    RAISE WARNING 'Failed to log auth event: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 8. Create registration logging function
DROP FUNCTION IF EXISTS public.log_registration_event(UUID, TEXT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.log_registration_event(
    p_registration_id UUID,
    p_event_type TEXT,
    p_notes TEXT DEFAULT NULL,
    p_actor_email TEXT DEFAULT NULL,
    p_detail_json JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.registration_events (
        registration_id, event_type, actor_user_id, actor_email, notes, detail_json
    ) VALUES (
        p_registration_id, p_event_type,
        auth.uid(), -- Use current user instead of lookup
        p_actor_email, p_notes, p_detail_json
    );
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to log registration event: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 9. Grant permissions
GRANT EXECUTE ON FUNCTION public.log_auth_event(TEXT, TEXT, INET, TEXT, TEXT, TEXT, JSONB) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.log_registration_event(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- 10. Create cleanup function for audit data older than 90 days
DROP FUNCTION IF EXISTS public.cleanup_old_audit_logs();

CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void AS $$
DECLARE
    v_rows_deleted INTEGER;
BEGIN
    DELETE FROM public.auth_events WHERE created_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
    
    DELETE FROM public.data_access_logs WHERE created_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
    
    -- Keep registration events for 1 year
    DELETE FROM public.registration_events WHERE created_at < NOW() - INTERVAL '365 days';
    
    RAISE NOTICE 'Cleanup job completed. Deleted % rows from auth events.', v_rows_deleted;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error in cleanup_old_audit_logs: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

GRANT EXECUTE ON FUNCTION public.cleanup_old_audit_logs() TO authenticated;
