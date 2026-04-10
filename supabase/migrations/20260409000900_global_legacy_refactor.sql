/* 
  20260409000900_global_legacy_refactor.sql
  
  FORCE-PURGE of all remaining 'client_id' references in security functions and RLS policies.
  This is a critical stabilization migration to unblock Super Admin recovery.
*/

-- 1. Repair sensitive columns protection
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Bypass for service_role (Edge Functions)
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Use high-level security check to avoid field-level loops
  IF NOT public.is_system_admin('super_admin') THEN
    IF (NEW.role IS DISTINCT FROM OLD.role) THEN
      RAISE EXCEPTION 'Unauthorized: Role escalation is prohibited.';
    END IF;
    -- client_id check removed (legacy)
    IF (NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id) THEN
      RAISE EXCEPTION 'Unauthorized: Identity hijacking is prohibited.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Repair Profile RLS
DROP POLICY IF EXISTS "Users can update own profile restricted" ON public.profiles;
CREATE POLICY "Users can update own profile restricted"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth_user_id::uuid = auth.uid()::uuid)
  WITH CHECK (
    auth_user_id::uuid = auth.uid()::uuid
    AND role = (SELECT role FROM public.profiles WHERE auth_user_id::uuid = auth.uid()::uuid)
  );

-- 3. Repair Tank RLS
DROP POLICY IF EXISTS "Users can see own tanks" ON public.tanks;
CREATE POLICY "Users can see own tanks" 
  ON public.tanks FOR SELECT TO authenticated
  USING (
    station_id = (SELECT station_id FROM public.profiles WHERE auth_user_id::uuid = auth.uid()::uuid)
    OR public.is_system_admin('super_admin')
  );

-- 4. Repair Sensor Readings RLS
DROP POLICY IF EXISTS "Clients can view own sensor readings" ON public.sensor_readings;
CREATE POLICY "Clients can view own sensor readings"
  ON public.sensor_readings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tanks t
      JOIN public.profiles p ON p.station_id = t.station_id
      WHERE t.id = tank_id
      AND p.auth_user_id::uuid = auth.uid()::uuid
    )
    OR public.is_system_admin('super_admin')
  );
