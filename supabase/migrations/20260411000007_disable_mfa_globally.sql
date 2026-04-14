-- supabase/migrations/20260411000007_disable_mfa_globally.sql
-- ============================================================================
-- CRITICAL FIX: Purge all enrolled MFA factors for all users.
-- ============================================================================
-- Context: Even though the frontend bypasses MFA checks, users with enrolled
-- TOTP/Phone factors receive aal1 tokens. Supabase Edge Functions can reject
-- aal1 tokens if the user account has factors indicating aal2 is required.
-- This causes the "Invalid JWT" 401 on all Edge Function calls (ping, approve, etc.).
--
-- Resolution: Remove ALL factors from auth.mfa_factors. MFA can be re-enabled
-- per-user through the Settings UI once the system is stable.
-- ============================================================================

-- Step 1: Delete all MFA challenge records (these reference mfa_factors)
DELETE FROM auth.mfa_amr_claims
WHERE session_id IN (
    SELECT id FROM auth.sessions
);

-- Step 2: Delete all enrolled MFA factors for every user
DELETE FROM auth.mfa_factors;

-- Step 3: Reflect this in the profiles table
UPDATE public.profiles
SET mfa_enabled = FALSE
WHERE mfa_enabled = TRUE;

-- Step 4: Reflect this in the system_users table (if column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'system_users'
          AND column_name = 'mfa_enabled'
    ) THEN
        UPDATE public.system_users SET mfa_enabled = FALSE WHERE mfa_enabled = TRUE;
    END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
