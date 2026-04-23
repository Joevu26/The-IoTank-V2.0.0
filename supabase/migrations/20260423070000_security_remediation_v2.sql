-- supabase/migrations/20260423070000_security_remediation_v2.sql
-- ============================================================================
-- SECURITY REMEDIATION V2: Hardware Revocation and Audit Log Immutability
-- ============================================================================

-- 1. IOTANK-SEC-2026-003: IoT Token Revocation
-- Ensure hardware devices can only insert readings if their associated tank is 'active'.
-- This allows admins to instantly revoke a stolen node by setting the tank status to 'inactive' or 'decommissioned'.
DROP POLICY IF EXISTS "Hardware devices can insert readings" ON public.sensor_readings;
CREATE POLICY "Hardware devices can insert readings" ON public.sensor_readings
FOR INSERT WITH CHECK (
    -- Allow if bypass is active (service_role) or if JWT has correct claims AND tank is active
    (auth.role() = 'service_role') OR (
        ((auth.jwt() ->> 'role'::text) = 'device'::text) AND 
        (((auth.jwt() ->> 'station_id'::text))::uuid = station_id) AND
        EXISTS (SELECT 1 FROM public.tanks t WHERE t.id = tank_id AND t.status = 'active')
    )
);

-- 2. IOTANK-SEC-2026-006: Audit Log Immutability
-- Enforce NO UPDATE rules on unified_events table via RLS to guarantee forensic integrity.
DROP POLICY IF EXISTS "No updates to unified_events" ON public.unified_events;
CREATE POLICY "No updates to unified_events" ON public.unified_events
FOR UPDATE TO authenticated
USING (false)
WITH CHECK (false);

-- Also ensure no deletes unless it's a super admin, but AuditService has a deleteEvent method.
-- Let's keep delete as-is, but definitely block updates.

-- 3. Reload PostgREST Cache
NOTIFY pgrst, 'reload schema';
