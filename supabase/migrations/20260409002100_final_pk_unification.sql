-- ============================================================================
-- FINAL PK UNIFICATION (V2.0.1)
-- ============================================================================
-- Renames 'fuel_stations.id' to 'fuel_stations.station_id' to complete
-- the universal station-centric naming convention.
-- ============================================================================

DO $$ 
BEGIN
    -- 1. Rename Primary Key Column
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_stations' AND column_name = 'id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_stations' AND column_name = 'station_id') THEN
            ALTER TABLE public.fuel_stations RENAME COLUMN id TO station_id;
        END IF;
    END IF;
END $$;

-- 2. REPAIR: log_admin_action
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_admin_action()
RETURNS TRIGGER AS $$
DECLARE
  v_action_type TEXT := TG_ARGV[0];
  v_description TEXT := TG_ARGV[1];
  v_admin_uid UUID;
  v_system_user_id UUID;
BEGIN
  v_admin_uid := auth.uid();
  
  -- If this is an automated system action (no auth context), bypass logging
  IF v_admin_uid IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    -- Resolve system_user_id first
    SELECT id INTO v_system_user_id FROM public.system_users WHERE auth_user_id = v_admin_uid LIMIT 1;

    INSERT INTO public.admin_logs (
      system_user_id,
      auth_user_id,
      action_type,
      affected_station_id,
      description,
      changes_made
    ) VALUES (
      v_system_user_id,
      v_admin_uid,
      v_action_type,
      CASE 
        WHEN TG_TABLE_NAME = 'fuel_stations' THEN NEW.station_id  -- UPDATED
        WHEN TG_TABLE_NAME = 'transactions' THEN (NEW.station_id)::uuid
        WHEN TG_TABLE_NAME = 'tanks' THEN (NEW.station_id)::uuid
        ELSE NULL 
      END,
      v_description,
      jsonb_build_object('new', row_to_json(NEW))
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never let an audit log failure crash the main transaction
    RAISE WARNING 'Audit Login Failed: % (SQL_STATE: %)', SQLERRM, SQLSTATE;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 3. REPAIR: provision_registration_v2
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
    RETURNING station_id INTO v_station_id; -- UPDATED

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

    -- 5. Finalize Registration Status
    UPDATE public.pending_registrations
    SET status = 'approved',
        approved_at = NOW(),
        approved_auth_user_id = p_auth_user_id,
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

-- 4. RELOAD: PostgREST Schema
NOTIFY pgrst, 'reload schema';
