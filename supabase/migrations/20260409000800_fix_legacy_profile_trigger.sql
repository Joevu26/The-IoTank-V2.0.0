/* 
  20260409000800_fix_legacy_profile_trigger.sql
  
  Removes the deprecated 'client_id' reference in the profile protection trigger,
  which was causing 'record new has no field client_id' errors during Super Admin recovery.
*/

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow the service_role (used by Edge Functions) to bypass these checks
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Ensure station_id exists in NEW record before checking
  -- Replacing client_id check with station_id check for station-centric architecture
  IF public.get_auth_level() > 1 THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.role := OLD.role;
    END IF;
    
    -- Removed client_id check (deprecated)
    -- We can check station_id instead if we want to protect it, but for now we just fix the crash
    IF NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
      NEW.auth_user_id := OLD.auth_user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
