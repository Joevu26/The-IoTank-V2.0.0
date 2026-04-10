-- supabase/migrations/20260318000000_superadmin_setup.sql
-- ============================================================================
-- SYSTEM LAYER: SUPER ADMIN & HELPER ROLES
-- ============================================================================
-- Adds the necessary system-level tables for platform owners and administrators.

-- ============================================================================
-- TABLE: SYSTEM USERS (Replaces admin_users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  
  -- Role definitions
  role TEXT NOT NULL CHECK (role IN (
    'super_admin',    -- Level 1: Platform Owner (Joseph)
    'admin_helper',   -- Level 2: Team Leads (Ann)
    'support_staff',  -- Level 3: CS Team
    'analyst'         -- Level 4: Read-Only
  )),
  
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Record who created this admin account
  created_by UUID REFERENCES system_users(id),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookup by Firebase Auth UID
CREATE INDEX IF NOT EXISTS idx_system_users_uid ON system_users(firebase_uid);

-- ============================================================================
-- INSERT INITIAL SUPER ADMIN (JOSEPH)
-- ============================================================================
-- Ensures the primary platform owner has immediate access.
INSERT INTO system_users (firebase_uid, email, full_name, role)
VALUES ('K8LiixLQCphjFNG3EbWKrEHhcvz2', 'josezvundi@gmail.com', 'Joseph Vundi', 'super_admin')
ON CONFLICT (email) DO UPDATE 
SET firebase_uid = EXCLUDED.firebase_uid, role = 'super_admin', is_active = TRUE;


-- ============================================================================
-- TABLE: ADMIN LOGS (Audit Trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_user_id UUID REFERENCES system_users(id), -- Who performed the action
  firebase_uid TEXT NOT NULL, -- Keep record even if system_user is dropped
  
  action_type TEXT NOT NULL CHECK (action_type IN (
    'debt_adjusted',
    'client_suspended',
    'client_reactivated',
    'system_settings_changed',
    'admin_unlocked',
    'payment_manually_recorded',
    'user_role_changed',
    'emergency_shutdown'
  )),
  
  affected_client_id UUID REFERENCES client_billing(id) ON DELETE SET NULL,
  
  description TEXT NOT NULL,
  
  -- Snapshot of what changed JSON format: {"before": {...}, "after": {...}}
  changes_made JSONB,
  
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_logs_time ON admin_logs(created_at DESC);

-- ============================================================================
-- SECURE FUNCTIONS FOR SYSTEM ROLES
-- ============================================================================

-- Utility function to easily check if the current user is a system admin
DROP FUNCTION IF EXISTS is_system_admin(TEXT) CASCADE;
CREATE OR REPLACE FUNCTION is_system_admin(minimum_role TEXT DEFAULT NULL)
RETURNS BOOLEAN
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  user_active BOOLEAN;
BEGIN
  -- Fetch caching status
  SELECT role, is_active INTO user_role, user_active
  FROM system_users
  WHERE firebase_uid = public.firebase_uid();
  
  -- Must exist and be active
  IF NOT FOUND OR NOT user_active THEN
    RETURN FALSE;
  END IF;

  -- If a required role is specified, evaluate permission hierarchy
  IF minimum_role IS NOT NULL THEN
    IF minimum_role = 'super_admin' AND user_role != 'super_admin' THEN
      RETURN FALSE;
    END IF;
    
    IF minimum_role = 'admin_helper' AND user_role NOT IN ('super_admin', 'admin_helper') THEN
      RETURN FALSE;
    END IF;
    
    IF minimum_role = 'support_staff' AND user_role NOT IN ('super_admin', 'admin_helper', 'support_staff') THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- SYSTEM ROLE RLS POLICIES FOR EXISTING TABLES
-- ============================================================================

-- First, ensure RLS is actually enabled on core tables
ALTER TABLE client_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE tanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

-- 1. `system_users` access
DROP POLICY IF EXISTS "Super Admins can manage all users" ON system_users;
CREATE POLICY "Super Admins can manage all users"
ON system_users FOR ALL
TO authenticated, anon
USING (is_system_admin('super_admin'))
WITH CHECK (is_system_admin('super_admin'));

DROP POLICY IF EXISTS "System users can read their own profile" ON system_users;
CREATE POLICY "System users can read their own profile"
ON system_users FOR SELECT
TO authenticated, anon
USING (firebase_uid = public.firebase_uid());

-- 2. `admin_logs` access
DROP POLICY IF EXISTS "Super Admins can view all logs" ON admin_logs;
CREATE POLICY "Super Admins can view all logs"
ON admin_logs FOR SELECT
TO authenticated, anon
USING (is_system_admin('super_admin'));

DROP POLICY IF EXISTS "Admin Helpers can view audit logs" ON admin_logs;
CREATE POLICY "Admin Helpers can view audit logs"
ON admin_logs FOR SELECT
TO authenticated, anon
USING (is_system_admin('analyst')); -- Analyst and above can read logs

DROP POLICY IF EXISTS "System can insert audit logs" ON admin_logs;
CREATE POLICY "System can insert audit logs"
ON admin_logs FOR INSERT
TO authenticated, anon
WITH CHECK (is_system_admin('support_staff')); -- Support staff and above can record their actions (trigger usually does this instead)

-- 3. Core Tables Reading access for system users
DROP POLICY IF EXISTS "System users can read all client billing" ON client_billing;
CREATE POLICY "System users can read all client billing"
ON client_billing FOR SELECT
TO authenticated, anon
USING (is_system_admin('analyst'));

DROP POLICY IF EXISTS "System users can update client billing" ON client_billing;
CREATE POLICY "System users can update client billing"
ON client_billing FOR UPDATE
TO authenticated, anon
USING (is_system_admin('support_staff')); 
-- Note: Further restrictions down to columns will be enforced via the frontend or special functions instead of straight table updates

DROP POLICY IF EXISTS "System users can read all tanks" ON tanks;
CREATE POLICY "System users can read all tanks"
ON tanks FOR SELECT
TO authenticated, anon
USING (is_system_admin('analyst'));

DROP POLICY IF EXISTS "System users can update tanks" ON tanks;
CREATE POLICY "System users can update tanks"
ON tanks FOR UPDATE
TO authenticated, anon
USING (is_system_admin('admin_helper'));

DROP POLICY IF EXISTS "System users can read all transactions" ON transactions;
CREATE POLICY "System users can read all transactions"
ON transactions FOR SELECT
TO authenticated, anon
USING (is_system_admin('analyst'));

-- 4. `pending_registrations` access
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'pending_registrations'
  ) THEN
    ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;

    -- Allow anyone (including unauthenticated clients) to submit a registration request
    DROP POLICY IF EXISTS "Anyone can submit a registration request" ON public.pending_registrations;
    CREATE POLICY "Anyone can submit a registration request"
    ON public.pending_registrations FOR INSERT
    TO anon, authenticated
    WITH CHECK (email IS NOT NULL AND full_name IS NOT NULL);

    -- Allow super admins and admin helpers to view and manage all registrations
    DROP POLICY IF EXISTS "Admins can manage all registrations" ON public.pending_registrations;
    CREATE POLICY "Admins can manage all registrations"
    ON public.pending_registrations FOR ALL
    TO authenticated, anon
    USING (is_system_admin('support_staff'))
    WITH CHECK (is_system_admin('support_staff'));
  ELSE
    RAISE NOTICE 'Skipping policies: public.pending_registrations table does not exist yet';
  END IF;
END
$$;
