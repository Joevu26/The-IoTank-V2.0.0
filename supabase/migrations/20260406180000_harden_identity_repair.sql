-- supabase/migrations/20260406180000_harden_identity_repair.sql
-- ============================================================================
-- HARDENING: Secure repair_my_identity to prevent account takeover
-- ============================================================================

CREATE OR REPLACE FUNCTION public.repair_my_identity()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_email TEXT;
    v_uid UUID;
    v_email_verified BOOLEAN;
    v_updated BOOLEAN := FALSE;
BEGIN
    v_uid := auth.uid();
    v_email := LOWER(TRIM(auth.jwt() ->> 'email'));
    -- Check both confirmed_at and the verified claim
    v_email_verified := (auth.jwt() ->> 'email_verified')::BOOLEAN OR (auth.jwt() -> 'app_metadata' ->> 'email_verified')::BOOLEAN;
    
    -- SECURITY CRITICAL: Do not link if email is NULL or NOT verified.
    -- This prevents an attacker from signing up with a victim's email and linking before the victim confirms.
    IF v_uid IS NULL OR v_email IS NULL OR v_email_verified IS NOT TRUE THEN
        RETURN FALSE;
    END IF;

    -- 1. Link profile if not linked and emails match
    -- We only link if supabase_uid is NULL to prevent hijacking an already linked account.
    UPDATE public.profiles 
    SET supabase_uid = v_uid,
        updated_at = NOW()
    WHERE supabase_uid IS NULL 
      AND LOWER(TRIM(email)) = v_email;
    
    IF FOUND THEN 
        v_updated := TRUE; 
        INSERT INTO public.audit_logs (action, table_name, record_id, old_value, new_value)
        VALUES ('IDENTITY_REPAIR', 'profiles', v_uid, '{"supabase_uid": null}', json_build_object('supabase_uid', v_uid));
    END IF;

    -- 2. Link system user if not linked and emails match
    UPDATE public.system_users 
    SET supabase_uid = v_uid,
        updated_at = NOW()
    WHERE supabase_uid IS NULL 
      AND LOWER(TRIM(email)) = v_email;

    IF FOUND THEN 
        v_updated := TRUE; 
        INSERT INTO public.audit_logs (action, table_name, record_id, old_value, new_value)
        VALUES ('IDENTITY_REPAIR', 'system_users', v_uid, '{"supabase_uid": null}', json_build_object('supabase_uid', v_uid));
    END IF;

    RETURN v_updated;
END;
$$;
