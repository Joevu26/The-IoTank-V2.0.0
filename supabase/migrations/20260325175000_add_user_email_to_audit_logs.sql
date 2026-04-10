-- supabase/migrations/20260325175000_add_user_email_to_audit_logs.sql

ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Update RLS to ensure consistent flow
COMMENT ON COLUMN public.audit_logs.user_email IS 'Email of the user who performed the action';
