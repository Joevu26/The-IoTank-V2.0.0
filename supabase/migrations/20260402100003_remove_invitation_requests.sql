-- supabase/migrations/20260402_remove_invitation_requests.sql
-- ============================================================================
-- CLEANUP: Remove dual invitation system and consolidate to pending_registrations
-- ============================================================================

-- Drop invitation_requests table and all its policies
DROP TABLE IF EXISTS public.invitation_requests CASCADE;

-- Add missing fields to pending_registrations for email verification and reCAPTCHA
ALTER TABLE public.pending_registrations
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMP,
ADD COLUMN IF NOT EXISTS approval_email_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS approval_email_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS recaptcha_token TEXT;

-- Create index for verification token lookups
CREATE INDEX IF NOT EXISTS idx_pending_reg_verification_token ON public.pending_registrations(verification_token);

-- Add auto-generated approval timestamp
ALTER TABLE public.pending_registrations
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

-- Update comments
COMMENT ON COLUMN public.pending_registrations.email_verified IS 'Whether the applicant has verified their email address';
COMMENT ON COLUMN public.pending_registrations.verification_token IS 'One-time token sent to email for verification';
COMMENT ON COLUMN public.pending_registrations.approval_email_sent IS 'Whether approval notification email was sent';
COMMENT ON COLUMN public.pending_registrations.recaptcha_token IS 'reCAPTCHA v3 token for backend verification';
