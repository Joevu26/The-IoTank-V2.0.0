-- ============================================================================
-- ATOMIC PROVISIONING RPC (v2)
-- Resolves the 'White Screen' by ensuring all links are created before approval
-- ============================================================================

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
    -- 1. Fetch Registration
    SELECT * INTO v_reg FROM public.pending_registrations WHERE id = p_registration_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Registration not found');
    END IF;

    -- 2. Atomic Station Creation
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
        account_status = 'active'
    RETURNING id INTO v_station_id;

    -- 3. Atomic Site Creation
    INSERT INTO public.sites (
        station_id,
        site_name,
        auth_user_id
    ) VALUES (
        v_station_id,
        v_reg.station_name, -- Default site name matches station
        p_auth_user_id
    )
    ON CONFLICT (station_id, site_name) DO UPDATE SET
        auth_user_id = EXCLUDED.auth_user_id
    RETURNING id INTO v_site_id;

    -- 4. Atomic Profile Linkage (The part that used to crash)
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
        v_reg.full_name,
        v_station_id,
        'owner',
        ARRAY[v_site_id]
    )
    ON CONFLICT (auth_user_id) DO UPDATE SET
        station_id = EXCLUDED.station_id,
        role = EXCLUDED.role,
        site_ids = EXCLUDED.site_ids,
        display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), profiles.display_name);

    -- 5. Finalize Registration Status
    UPDATE public.pending_registrations
    SET status = 'approved',
        approved_at = NOW(),
        approved_supabase_uid = p_auth_user_id,
        approved_station_id = v_station_id
    WHERE id = p_registration_id;

    RETURN jsonb_build_object(
        'success', true, 
        'station_id', v_station_id, 
        'site_id', v_site_id,
        'message', 'Provisioning completed atomically'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false, 
        'error', SQLERRM,
        'detail', SQLSTATE
    );
END;
$$;

-- ============================================================================
-- CLEANUP: Remove redundant trigger that was causing rollbacks
-- ============================================================================
-- Using CASCADE to ensure all dependent triggers are removed automatically
DROP FUNCTION IF EXISTS public.provision_approved_registration() CASCADE;
