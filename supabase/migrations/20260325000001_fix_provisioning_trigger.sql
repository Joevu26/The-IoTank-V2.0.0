-- supabase/migrations/20260325000001_fix_provisioning_trigger.sql
-- Allow the service_role (Edge Functions) to bypass the profile protection trigger.

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow the service_role (used by Edge Functions) to bypass these checks
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- If not a super_admin (Level 1), block changes to privilege fields
  IF public.get_auth_level() > 1 THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.role := OLD.role;
    END IF;
    IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
      NEW.client_id := OLD.client_id;
    END IF;
    IF NEW.supabase_uid IS DISTINCT FROM OLD.supabase_uid THEN
      NEW.supabase_uid := OLD.supabase_uid;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
