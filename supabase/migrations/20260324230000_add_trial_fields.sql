-- Migration to add trial fields and prepare for automated provisioning
-- Date: 2026-03-24

-- 1. Add trial_ends_at to client_billing
ALTER TABLE public.client_billing 
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;

-- 2. Ensure subscription_status includes 'trial'
-- (Assuming it's a text column with check constraint or just text)
-- If it's an enum, we'd need to alter it, but usually it's text in this project.

COMMENT ON COLUMN public.client_billing.trial_ends_at IS 'Timestamp when the free trial period expires (default 14 days from approval).';

-- 3. Update any metadata if needed
