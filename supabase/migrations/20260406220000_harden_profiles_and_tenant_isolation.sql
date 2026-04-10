-- supabase/migrations/20260406220000_harden_profiles_and_tenant_isolation.sql
-- ============================================================================
-- SECURITY HARDENING: FIX CRIT-002 (Vertical Privilege Escalation)
-- Prevents users from updating their own 'role' or 'organizationId'.
-- ============================================================================

-- 1. HARDEN PROFILES TABLE UPDATE POLICY
-- First, drop the existing policies to ensure idempotency
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile restricted" ON public.profiles;

-- Create a restricted update policy
-- This policy allows users to update their own row, but the check constraint
-- will be enforced via a trigger or by column-level grants.
-- However, Supabase RLS 'WITH CHECK' applies to the WHOLE row after update.
-- To effectively prevent changing 'role' via RLS alone:
CREATE POLICY "Users can update own profile restricted"
  ON public.profiles FOR UPDATE TO authenticated
  USING (supabase_uid::uuid = auth.uid()::uuid)
  WITH CHECK (
    supabase_uid::uuid = auth.uid()::uuid
    AND role = (SELECT role FROM public.profiles WHERE supabase_uid::uuid = auth.uid()::uuid)
    AND client_id = (SELECT client_id FROM public.profiles WHERE supabase_uid::uuid = auth.uid()::uuid)
  );

-- 2. ADD PROTECTIVE TRIGGER (Defense in Depth)
-- Even if RLS is bypassed, this trigger ensures role/client_id are immutable for regular users.
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- If not a system admin (super_admin), prevent changes to critical columns
  -- Bypass for service_role (Edge Functions)
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_system_admin('super_admin') THEN
    IF (NEW.role <> OLD.role) THEN
      RAISE EXCEPTION 'Unauthorized: Role escalation is prohibited.';
    END IF;
    IF (NEW.client_id <> OLD.client_id) THEN
      RAISE EXCEPTION 'Unauthorized: Tenant hijacking is prohibited.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_protect_profile_sensitive_columns ON public.profiles;
CREATE TRIGGER tr_protect_profile_sensitive_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.protect_profile_sensitive_columns();

-- 3. HARDEN OTHER TABLES (CROSS-TENANT SECURITY)
-- Ensure tanks can only be viewed if they belong to the user's client_id
-- The current policies use supabase_uid, which is good, but client_id is the true tenant owner.

-- Tanks
DROP POLICY IF EXISTS "Users can see own tanks" ON public.tanks;
CREATE POLICY "Users can see own tanks" 
  ON public.tanks FOR SELECT TO authenticated
  USING (
    client_id = (SELECT client_id FROM public.profiles WHERE supabase_uid::uuid = auth.uid()::uuid)
    OR public.is_system_admin('analyst')
  );

-- Sensor Readings
DROP POLICY IF EXISTS "Clients can view own sensor readings" ON public.sensor_readings;
CREATE POLICY "Clients can view own sensor readings"
  ON public.sensor_readings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tanks t
      JOIN public.profiles p ON p.client_id = t.client_id
      WHERE t.id = tank_id
      AND p.supabase_uid::uuid = auth.uid()::uuid
    )
    OR public.is_system_admin('analyst')
  );

-- 4. ENABLE RLS ON ALL TABLES IF NOT YET ENABLED
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.deliveries ENABLE ROW LEVEL SECURITY;
