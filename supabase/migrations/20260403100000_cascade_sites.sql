-- supabase/migrations/20260403100000_cascade_sites.sql

-- Apply ON DELETE CASCADE to sites table
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'sites_supabase_uid_fkey') THEN
    ALTER TABLE public.sites DROP CONSTRAINT sites_supabase_uid_fkey;
  END IF;
END $$;

ALTER TABLE public.sites 
  ADD CONSTRAINT sites_supabase_uid_fkey 
  FOREIGN KEY (supabase_uid) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Apply ON DELETE CASCADE to client_billing table just in case it doesn't have it
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'client_billing_supabase_uid_fkey') THEN
    ALTER TABLE public.client_billing DROP CONSTRAINT client_billing_supabase_uid_fkey;
  END IF;
END $$;

-- Drop policy temporarily since it depends on the column being TEXT
DROP POLICY IF EXISTS "System users can read all client billing" ON public.client_billing;

-- Fix the incompatible type by altering TEXT to UUID
-- Fix the incompatible type by altering TEXT to UUID
-- Wrap in a DO block to safely handle repeated pushes or partial states
DO $$ 
BEGIN
  IF (SELECT data_type FROM information_schema.columns 
      WHERE table_name = 'client_billing' AND column_name = 'supabase_uid') = 'text' THEN
    
    -- Null out any values that are not valid UUIDs (e.g. legacy Firebase UIDs)
    UPDATE public.client_billing 
    SET supabase_uid = NULL 
    WHERE supabase_uid IS NOT NULL 
      AND supabase_uid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

    ALTER TABLE public.client_billing 
      ALTER COLUMN supabase_uid TYPE UUID USING supabase_uid::uuid;
  END IF;
END $$;

-- Recreate policy with updated type matching constraint
CREATE POLICY "System users can read all client billing"
  ON public.client_billing FOR SELECT TO authenticated
  USING (
    public.is_system_admin('analyst')
    OR supabase_uid = auth.uid()
  );

ALTER TABLE public.client_billing 
  ADD CONSTRAINT client_billing_supabase_uid_fkey 
  FOREIGN KEY (supabase_uid) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;
