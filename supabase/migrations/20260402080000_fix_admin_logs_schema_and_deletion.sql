-- supabase/migrations/20260402080000_fix_admin_logs_schema_and_deletion.sql
-- ============================================================================
-- FIX: Database error deleting user from system_users table
-- ============================================================================
-- 1. Ensure system_user_id exists in admin_logs
-- 2. Update foreign key constraints to ON DELETE SET NULL

DO $$ 
BEGIN
  -- 1. Ensure admin_logs.system_user_id column exists
  IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'admin_logs' AND column_name = 'system_user_id'
  ) THEN
    ALTER TABLE public.admin_logs ADD COLUMN system_user_id UUID REFERENCES public.system_users(id);
  END IF;

  -- 2. Fix admin_logs.system_user_id reference
  -- Find and drop ANY existing foreign key on system_user_id in admin_logs
  IF EXISTS (
      SELECT 1 FROM pg_constraint con 
      JOIN pg_class rel ON rel.oid = con.conrelid 
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace 
      JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
      WHERE nsp.nspname = 'public' 
      AND rel.relname = 'admin_logs' 
      AND con.contype = 'f'
      AND att.attname = 'system_user_id'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.admin_logs DROP CONSTRAINT ' || con.conname
      FROM pg_constraint con 
      JOIN pg_class rel ON rel.oid = con.conrelid 
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace 
      JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
      WHERE nsp.nspname = 'public' 
      AND rel.relname = 'admin_logs' 
      AND con.contype = 'f'
      AND att.attname = 'system_user_id'
      LIMIT 1
    );
  END IF;

  -- Re-add with ON DELETE SET NULL
  ALTER TABLE public.admin_logs 
    ADD CONSTRAINT admin_logs_system_user_id_fkey 
    FOREIGN KEY (system_user_id) 
    REFERENCES public.system_users(id) 
    ON DELETE SET NULL;

  -- 3. Fix system_users.created_by reference (self-referencing FK)
  -- Find and drop ANY existing foreign key on created_by in system_users
  IF EXISTS (
      SELECT 1 FROM pg_constraint con 
      JOIN pg_class rel ON rel.oid = con.conrelid 
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace 
      JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
      WHERE nsp.nspname = 'public' 
      AND rel.relname = 'system_users' 
      AND con.contype = 'f'
      AND att.attname = 'created_by'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.system_users DROP CONSTRAINT ' || con.conname
      FROM pg_constraint con 
      JOIN pg_class rel ON rel.oid = con.conrelid 
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace 
      JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
      WHERE nsp.nspname = 'public' 
      AND rel.relname = 'system_users' 
      AND con.contype = 'f'
      AND att.attname = 'created_by'
      LIMIT 1
    );
  END IF;

  ALTER TABLE public.system_users 
    ADD CONSTRAINT system_users_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES public.system_users(id) 
    ON DELETE SET NULL;

END $$;
