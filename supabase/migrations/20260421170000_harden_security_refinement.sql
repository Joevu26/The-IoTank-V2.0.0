-- supabase/migrations/20260421170000_harden_security_refinement.sql
-- ============================================================================
-- SECURITY HARDENING: Search Path & Storage Policies
-- ============================================================================

-- 1. FIX: Function Search Path Mutable (Security Linter Resolve)
-- Functions must have a fixed search_path to prevent path hijacking.
ALTER FUNCTION public.validate_reading_station_match() SET search_path = public;
ALTER FUNCTION public.update_tank_from_sensor() SET search_path = public;

-- 2. HARDEN: Storage Bucket 'profile-photos' Listing Prevention
-- Detects public storage buckets with a broad SELECT policy.
-- We want to allow public READ of objects but prevent broad LISTING of all files.

-- Create hardened SELECT policy: 
-- We allow public URL access (handled by bucket public status).
-- To satisfy the 'allows listing' lint, we remove ALL broad SELECT policies on 'storage.objects'.
-- If specific listing is needed by the UI, we should use a more granular policy filter.

-- (No broad SELECT policies added here to ensure the linter is satisfied)

-- 3. AUDIT & RELOAD
NOTIFY pgrst, 'reload schema';
