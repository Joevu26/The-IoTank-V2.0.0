-- ============================================================================
-- DEFINITIVE MASTER PROVISIONING STABILIZATION (v3.0)
-- ============================================================================
-- This script fixes the schema contradictions that caused provisioning to fail.
-- It ensures the database, the RPC, and the Edge Function are in 100% alignment.
-- ============================================================================

-- 1. REPAIR: Profiles Role Constraint
-- Restore the 'owner' role which was accidentally removed in a previous security hardening.
DO $$ BEGIN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS chk_valid_role;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.profiles 
ADD CONSTRAINT chk_valid_role 
CHECK (role IN ('owner', 'admin', 'supervisor', 'operator', 'viewer'));


-- 2. REPAIR: Pending Registrations Schema Normalization
-- Ensures we use 'approved_supabase_uid' for the link and have 'approved_station_id'
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_registrations' AND column_name='approved_firebase_uid') THEN
        ALTER TABLE public.pending_registrations RENAME COLUMN approved_firebase_uid TO approved_supabase_uid;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_registrations' AND column_name='auth_user_id') THEN
        ALTER TABLE public.pending_registrations RENAME COLUMN auth_user_id TO approved_supabase_uid;
    END IF;

    -- Add missing link column if it was never created
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_registrations' AND column_name='approved_station_id') THEN
        ALTER TABLE public.pending_registrations ADD COLUMN approved_station_id UUID REFERENCES public.fuel_stations(id) ON DELETE SET NULL;
    END IF;
END $$;


-- 3. RE-DEPLOY: Atomic Provisioning RPC (v3)
-- Hardened with better error reporting and explicit casting.
CREATE OR REPLACE FUNCTION public.provision_registration_v2(
    p_registration_id UUID,
    p_auth_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_reg RECORD;
    v_station_id UUID;
    v_site_id UUID;
BEGIN
    -- [A] Fetch Registration
    SELECT * INTO v_reg FROM public.pending_registrations WHERE id = p_registration_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Registration entry ' || p_registration_id || ' not found');
    END IF;

    -- [B] Atomic Station Creation
    -- We use LOWER(email) to avoid duplicate station conflicts if email casing varies.
    INSERT INTO public.fuel_stations (
        station_name, 
        email,
        owner_id,
        account_status
    ) VALUES (
        v_reg.station_name,
        LOWER(v_reg.email),
        p_auth_user_id,
        'active'
    )
    ON CONFLICT (email) DO UPDATE SET
        owner_id = EXCLUDED.owner_id,
        station_name = EXCLUDED.station_name,
        account_status = 'active',
        updated_at = NOW()
    RETURNING id INTO v_station_id;

    -- [C] Site Creation
    INSERT INTO public.sites (
        station_id,
        site_name
    ) VALUES (
        v_station_id,
        v_reg.station_name -- Primary site usually matches station name
    )
    ON CONFLICT (station_id, site_name) DO UPDATE SET
        updated_at = NOW()
    RETURNING id INTO v_site_id;

    -- [D] Profile Hard-Linkage
    -- This is where the 'chk_valid_role' for 'owner' is strictly required.
    INSERT INTO public.profiles (
        auth_user_id,
        email,
        display_name,
        station_id,
        role,
        site_ids
    ) VALUES (
        p_auth_user_id,
        LOWER(v_reg.email),
        COALESCE(v_reg.full_name, split_part(v_reg.email, '@', 1)),
        v_station_id,
        'owner',
        ARRAY[v_site_id]
    )
    ON CONFLICT (auth_user_id) DO UPDATE SET
        station_id = EXCLUDED.station_id,
        role = EXCLUDED.role,
        site_ids = EXCLUDED.site_ids,
        display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), profiles.display_name),
        updated_at = NOW();

    -- [E] Finalize Registration State
    UPDATE public.pending_registrations
    SET status = 'approved',
        approved_at = NOW(),
        approved_supabase_uid = p_auth_user_id::TEXT, -- Cast for safety
        approved_station_id = v_station_id
    WHERE id = p_registration_id;

    RETURN jsonb_build_object(
        'success', true, 
        'station_id', v_station_id, 
        'site_id', v_site_id,
        'profile_status', 'linked_as_owner'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false, 
        'error', SQLERRM,
        'sql_state', SQLSTATE
    );
END;
$$;


-- 4. CLEANUP: Disable redundant triggers that cause rollbacks
-- These were the old ways of doing things that are now unified in the RPC.
DROP TRIGGER IF EXISTS on_registration_approved ON public.pending_registrations;
DROP TRIGGER IF EXISTS trigger_provision_approved_registration ON public.pending_registrations;
DROP FUNCTION IF EXISTS public.provision_approved_registration() CASCADE;


-- 5. REPAIR: Immediate Recovery for Existing "Viewer" Owners
-- Fixes Ann and any other users currently stuck in the setup screen.
UPDATE public.profiles
SET role = 'owner',
    station_id = (SELECT approved_station_id FROM public.pending_registrations WHERE email = profiles.email AND status = 'approved' LIMIT 1)
WHERE role = 'viewer' 
  AND EXISTS (SELECT 1 FROM public.pending_registrations WHERE email = profiles.email AND status = 'approved');


-- Reload schema for PostgREST
NOTIFY pgrst, 'reload schema';
