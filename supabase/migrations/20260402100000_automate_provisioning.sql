-- supabase/migrations/20260402_automate_provisioning.sql
-- ============================================================================
-- FEATURE: Automated account provisioning on registration approval
-- ============================================================================

-- NOTE: admin_logs table should be created by 20260402_comprehensive_audit_logging.sql
-- Ensure admin_logs has necessary columns for audit trail
ALTER TABLE IF EXISTS public.admin_logs
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS action_type TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- 1. Add trigger to automatically create client accounts when registration is approved
DROP FUNCTION IF EXISTS public.provision_approved_registration() CASCADE;

CREATE OR REPLACE FUNCTION public.provision_approved_registration()
RETURNS TRIGGER AS $$
DECLARE
    v_new_user_id UUID;
    v_client_billing_id UUID;
BEGIN
    -- Only process when status changes to 'approved' and it wasn't already approved
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        
        -- Check if user already has a Supabase Auth account (indicated by approved_firebase_uid being set)
        IF NEW.approved_firebase_uid IS NULL THEN
            -- This is a note: the admin must create the auth user separately
            -- Try to add audit trail but don't fail if it doesn't work
            BEGIN
                INSERT INTO public.admin_logs (
                    description, action_type, created_at
                ) VALUES (
                    format('Registration for %s (%s) approved - awaiting admin provisioning', NEW.full_name, NEW.email),
                    'REGISTRATION_APPROVED',
                    NOW()
                );
            EXCEPTION WHEN OTHERS THEN
                -- Log fails silently - provisioning continues
                NULL;
            END;
            
            RETURN NEW;
        END IF;
        
        -- Create client_billing record
        INSERT INTO public.client_billing (
            station_name,
            created_at,
            owner_name,
            owner_email
        ) VALUES (
            NEW.station_name,
            NOW(),
            NEW.full_name,
            NEW.email
        ) RETURNING id INTO v_client_billing_id;
        
        -- Update the pending registration with the new client ID
        NEW.approved_client_id = v_client_billing_id;
        NEW.approved_at = NOW();
        
        -- Create the client user profile
        INSERT INTO public.profiles (
            supabase_uid,
            email,
            full_name,
            client_id,
            role,
            created_at
        ) VALUES (
            NEW.approved_firebase_uid,
            NEW.email,
            NEW.full_name,
            v_client_billing_id,
            'owner',
            NOW()
        );
        
        -- Log the provisioning action (non-blocking)
        BEGIN
            INSERT INTO public.admin_logs (
                description, action_type, created_at
            ) VALUES (
                format('Account provisioned for %s (%s) - Client ID: %s', NEW.full_name, NEW.email, v_client_billing_id),
                'ACCOUNT_PROVISIONED',
                NOW()
            );
        EXCEPTION WHEN OTHERS THEN
            -- Log fails silently - provisioning continues
            NULL;
        END;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Create trigger on pending_registrations
DROP TRIGGER IF EXISTS trigger_provision_approved_registration ON public.pending_registrations;
CREATE TRIGGER trigger_provision_approved_registration
    BEFORE UPDATE ON public.pending_registrations
    FOR EACH ROW
    WHEN (NEW.status = 'approved')
    EXECUTE FUNCTION public.provision_approved_registration();

-- 2. Grant proper permissions
GRANT EXECUTE ON FUNCTION public.provision_approved_registration() TO authenticated;
