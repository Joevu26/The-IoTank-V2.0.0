-- supabase/migrations/20260321000007_add_tanks_to_pending_registrations.sql

-- Add tanks column to pending_registrations to store structured tank info from the sign-up form
ALTER TABLE public.pending_registrations
ADD COLUMN IF NOT EXISTS tanks JSONB DEFAULT '[]'::jsonb;

-- Update the notes placeholder to reflect the new structure
COMMENT ON COLUMN public.pending_registrations.tanks IS 'Stores an array of tank objects: [{name: string, type: string, capacity: number}]';
