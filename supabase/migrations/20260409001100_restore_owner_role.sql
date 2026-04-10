-- ============================================================================
-- EMERGENCY FIX: Restore 'owner' role to valid profiles
-- This resolves the 'viewer' role defaulting and provisioning failures
-- ============================================================================

-- Fix the constraint to include 'owner'
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS chk_valid_role;

ALTER TABLE public.profiles
  ADD CONSTRAINT chk_valid_role 
  CHECK (role IN ('owner', 'admin', 'supervisor', 'operator', 'viewer'));

-- Ensure existing owners are actually set to owner (if they were reverted to viewer)
UPDATE public.profiles
SET role = 'owner'
WHERE email = 'anniesyombua26@gmail.com'; -- Specific fix for the primary admin

-- ============================================================================
-- ============================================================================
-- RE-ENABLE ATOMIC PROVISIONING
-- ============================================================================
-- (This ensures the rpc from the previous migration is fully functional)
SELECT public.provision_registration_v2(id, approved_supabase_uid::UUID)
FROM public.pending_registrations
WHERE status = 'approved' AND approved_supabase_uid IS NOT NULL;
