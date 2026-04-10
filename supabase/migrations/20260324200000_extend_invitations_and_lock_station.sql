-- supabase/migrations/20260324200000_extend_invitations_and_lock_station.sql

-- 1. Add role column to invitation_requests
ALTER TABLE public.invitation_requests 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'operator' 
CHECK (role IN ('supervisor', 'operator', 'viewer'));

COMMENT ON COLUMN public.invitation_requests.role IS 'The target role for the invited team member.';

-- 2. Ensure station owners can see their own invites even with the new column
-- (Policies already exist based on invited_by_uid)

-- 3. Lock station_name for non-admins (Logic level, but here for reference)
-- We will handle the UI side, but let's ensure the system_users link is robust as per previous plan.

-- 4. Fix potential registration mismatch
-- Ensure station_name is NOT NULL in invitations
ALTER TABLE public.invitation_requests ALTER COLUMN station_name SET NOT NULL;
