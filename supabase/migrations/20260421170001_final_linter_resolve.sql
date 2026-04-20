-- supabase/migrations/20260421170001_final_linter_resolve.sql
-- ============================================================================
-- FINAL LINTER RESOLVE: Drop problematic storage policies
-- ============================================================================

-- Explicitly drop the policy that is still triggering the 'broad SELECT' warning
DROP POLICY IF EXISTS "Authenticated users can list profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Individual profile photo access" ON storage.objects;

-- (We leave the bucket as Public, so URL access works without SELECT on objects table)
NOTIFY pgrst, 'reload schema';
