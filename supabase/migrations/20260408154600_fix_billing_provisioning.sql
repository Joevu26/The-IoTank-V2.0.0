-- supabase/migrations/20260408154600_fix_billing_provisioning.sql
-- ============================================================================
-- FIX: Repair Automated Provisioning Trigger
-- 1. Fix schema mismatch bug causing failure in client_billing creation
-- 2. Ensure client_billing is only created once per station to avoid duplicates.
-- ============================================================================

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

        -- Check if a billing record already exists for this station to prevent duplicates
        SELECT id INTO v_client_billing_id 
        FROM public.client_billing 
        WHERE station_name = NEW.station_name 
        LIMIT 1;

        IF v_client_billing_id IS NULL THEN
            -- Create client_billing record using correct schema columns
            INSERT INTO public.client_billing (
                station_name,
                created_at,
                email
            ) VALUES (
                NEW.station_name,
                NOW(),
                NEW.email
            ) RETURNING id INTO v_client_billing_id;
        END IF;
        
        -- Update the pending registration with the new or existing client ID
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
