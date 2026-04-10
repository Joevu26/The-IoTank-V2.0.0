-- supabase/migrations/20260321000004_debug_policies.sql
CREATE TABLE IF NOT EXISTS public.rls_debug (
  id SERIAL PRIMARY KEY,
  tablename TEXT,
  policyname TEXT,
  cmd TEXT,
  qual TEXT,
  with_check TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

TRUNCATE public.rls_debug;

INSERT INTO public.rls_debug (tablename, policyname, cmd, qual, with_check)
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'pending_registrations', 'client_billing', 'sites', 'tanks', 'system_users');

GRANT SELECT ON public.rls_debug TO anon, authenticated;
