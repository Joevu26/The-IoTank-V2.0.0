-- supabase/migrations/20260318000004_role_and_onboarding.sql
-- ============================================================================
-- 1. FIX: Update profiles.role constraint (admin -> supervisor)
-- 2. NEW: pending_registrations table for the signup request flow
-- ============================================================================

-- ============================================================================
-- PART 1: Correct role names in profiles table
-- ============================================================================

-- Step 1: Drop the old constraint
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Step 2: Migrate any existing 'admin' roles to 'supervisor'
UPDATE public.profiles
  SET role = 'supervisor'
  WHERE role = 'admin';

-- Step 3: Add corrected constraint with all 4 client-layer roles
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'supervisor', 'operator', 'viewer'));

-- ============================================================================
-- PART 2: pending_registrations table
-- ============================================================================
-- When a prospective client fills in the sign-up form on the client web,
-- their details are stored here as a pending request.
-- The Super Admin reviews these and can approve them to create the full account.

CREATE TABLE IF NOT EXISTS public.pending_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Details submitted by the prospective client
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  station_name TEXT NOT NULL,   -- Name of their fuel station / company
  county TEXT,
  notes TEXT,                   -- Any extra notes they add

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'contacted')),

  -- Who processed the request (admin side)
  reviewed_by TEXT,             -- firebase_uid of the system_user who reviewed
  reviewed_at TIMESTAMP,
  review_notes TEXT,

  -- After approval, the firebase_uid created for this user
  approved_firebase_uid TEXT,
  approved_client_id UUID REFERENCES public.client_billing(id) ON DELETE SET NULL,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_reg_status ON public.pending_registrations(status);
CREATE INDEX IF NOT EXISTS idx_pending_reg_email ON public.pending_registrations(email);

-- RLS: only system admins can view and modify pending registrations
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;

-- Anyone (even unauthenticated via anon key) can INSERT a new request
-- This allows the sign-up form to work before the user has a Firebase account.
DROP POLICY IF EXISTS "Anyone can submit a registration request" ON public.pending_registrations;
CREATE POLICY "Anyone can submit a registration request"
  ON public.pending_registrations FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'pending');

-- Only system admins can read and manage them
DROP POLICY IF EXISTS "System admins can view all pending registrations" ON public.pending_registrations;
CREATE POLICY "System admins can view all pending registrations"
  ON public.pending_registrations FOR SELECT
  TO authenticated
  USING (public.is_system_admin('support_staff'));

DROP POLICY IF EXISTS "System admins can update pending registrations" ON public.pending_registrations;
CREATE POLICY "System admins can update pending registrations"
  ON public.pending_registrations FOR UPDATE
  TO authenticated
  USING (public.is_system_admin('support_staff'))
  WITH CHECK (public.is_system_admin('support_staff'));

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_pending_reg_updated_at ON public.pending_registrations;
CREATE TRIGGER update_pending_reg_updated_at
  BEFORE UPDATE ON public.pending_registrations
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- ============================================================================
-- PART 3: Grant permissions
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT INSERT ON public.pending_registrations TO anon;
GRANT ALL ON public.pending_registrations TO authenticated;
