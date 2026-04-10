-- ============================================================================
-- FINAL IDENTIFIER UNIFICATION (V2.0.0)
-- ============================================================================
-- Renames the last remaining legacy columns in 'pending_registrations' 
-- to complete the 100% auth_user_id and station_id standardization.
-- ============================================================================

DO $$ 
BEGIN
    -- 1. Handle 'approved_supabase_uid' -> 'approved_auth_user_id'
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pending_registrations' AND column_name = 'approved_supabase_uid') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pending_registrations' AND column_name = 'approved_auth_user_id') THEN
            ALTER TABLE public.pending_registrations RENAME COLUMN approved_supabase_uid TO approved_auth_user_id;
        ELSE
            -- Both exist, migration v12 might have added the target. 
            -- We should copy data if needed, but here we just safely drop the old one if it's redundant.
            ALTER TABLE public.pending_registrations DROP COLUMN approved_supabase_uid;
        END IF;
    END IF;

    -- 2. Handle 'approved_client_id' -> 'approved_station_id'
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pending_registrations' AND column_name = 'approved_client_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pending_registrations' AND column_name = 'approved_station_id') THEN
            ALTER TABLE public.pending_registrations RENAME COLUMN approved_client_id TO approved_station_id;
        ELSE
            -- Target already exists (from v12 stabilization)
            ALTER TABLE public.pending_registrations DROP COLUMN approved_client_id;
        END IF;
    END IF;

END $$;

-- 3. Update 'provision_registration_v2' to use the new column names
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
        v_reg.station_name, 
        p_auth_user_id
    )
    ON CONFLICT (station_id, site_name) DO UPDATE SET
        auth_user_id = EXCLUDED.auth_user_id
    RETURNING id INTO v_site_id;

    -- 4. Atomic Profile Linkage
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

    -- 5. Finalize Registration Status (Using new column names)
    UPDATE public.pending_registrations
    SET status = 'approved',
        approved_at = NOW(),
        approved_auth_user_id = p_auth_user_id,  -- Updated naming
        approved_station_id = v_station_id        -- Updated naming
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

-- 4. RELOAD: PostgREST Schema
NOTIFY pgrst, 'reload schema';
