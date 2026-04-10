-- supabase/migrations/20260409000200_global_auth_id_rename.sql
-- ============================================================================
-- GLOBAL RENAME: 'supabase_uid' / 'firebase_uid' -> 'auth_user_id'
-- Part 1: Column and Index Renaming
-- ============================================================================

DO $$ 
BEGIN
    -- 1. Core Tables
    -- profiles
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'supabase_uid') THEN
        ALTER TABLE public.profiles RENAME COLUMN supabase_uid TO auth_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profiles_supabase_uid') THEN
        ALTER INDEX public.idx_profiles_supabase_uid RENAME TO idx_profiles_auth_user_id;
    END IF;

    -- system_users
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_users' AND column_name = 'supabase_uid') THEN
        ALTER TABLE public.system_users RENAME COLUMN supabase_uid TO auth_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_system_users_supabase_uid') THEN
        ALTER INDEX public.idx_system_users_supabase_uid RENAME TO idx_system_users_auth_user_id;
    END IF;

    -- fuel_stations
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_stations' AND column_name = 'supabase_uid') THEN
        ALTER TABLE public.fuel_stations RENAME COLUMN supabase_uid TO auth_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_fuel_stations_supabase_uid') THEN
        ALTER INDEX public.idx_fuel_stations_supabase_uid RENAME TO idx_fuel_stations_auth_user_id;
    END IF;

    -- 2. Operational Tables
    -- tanks
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tanks' AND column_name = 'supabase_uid') THEN
        ALTER TABLE public.tanks RENAME COLUMN supabase_uid TO auth_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tanks_supabase_uid') THEN
        ALTER INDEX public.idx_tanks_supabase_uid RENAME TO idx_tanks_auth_user_id;
    END IF;

    -- transactions
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'supabase_uid') THEN
        ALTER TABLE public.transactions RENAME COLUMN supabase_uid TO auth_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_transactions_supabase_uid') THEN
        ALTER INDEX public.idx_transactions_supabase_uid RENAME TO idx_transactions_auth_user_id;
    END IF;

    -- alerts
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alerts' AND column_name = 'supabase_uid') THEN
        ALTER TABLE public.alerts RENAME COLUMN supabase_uid TO auth_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_alerts_supabase_uid') THEN
        ALTER INDEX public.idx_alerts_supabase_uid RENAME TO idx_alerts_auth_user_id;
    END IF;

    -- deliveries
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'supabase_uid') THEN
        ALTER TABLE public.deliveries RENAME COLUMN supabase_uid TO auth_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_deliveries_supabase_uid') THEN
        ALTER INDEX public.idx_deliveries_supabase_uid RENAME TO idx_deliveries_auth_user_id;
    END IF;

    -- fuel_transactions
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_transactions' AND column_name = 'supabase_uid') THEN
        ALTER TABLE public.fuel_transactions RENAME COLUMN supabase_uid TO auth_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_fuel_transactions_supabase_uid') THEN
        ALTER INDEX public.idx_fuel_transactions_supabase_uid RENAME TO idx_fuel_transactions_auth_user_id;
    END IF;

    -- 3. Logging & Audit Tables
    -- admin_logs
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_logs' AND column_name = 'admin_uid') THEN
        ALTER TABLE public.admin_logs RENAME COLUMN admin_uid TO admin_auth_id; -- Standardizing but Keeping 'admin' prefix
    END IF;
    
    -- auth_events
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'auth_events' AND column_name = 'user_id') THEN
        -- user_id is generic, but if it stores supabase_uid, we might leave it or rename to auth_user_id.
        -- Let's check other tables first.
    END IF;

    -- data_access_logs
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'data_access_logs' AND column_name = 'actor_user_id') THEN
        -- Already generic.
    END IF;

    -- registration_events
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registration_events' AND column_name = 'actor_user_id') THEN
        -- Already generic.
    END IF;

    -- 4. Integration & Misc
    -- usage_logs
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usage_logs' AND column_name = 'supabase_uid') THEN
        ALTER TABLE public.usage_logs RENAME COLUMN supabase_uid TO auth_user_id;
    END IF;

    -- pending_registrations
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pending_registrations' AND column_name = 'supabase_uid') THEN
        ALTER TABLE public.pending_registrations RENAME COLUMN supabase_uid TO auth_user_id;
    END IF;

    -- team_member_requests
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_member_requests' AND column_name = 'supabase_uid') THEN
        ALTER TABLE public.team_member_requests RENAME COLUMN supabase_uid TO auth_user_id;
    END IF;

    -- event_logs
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_logs' AND column_name = 'supabase_uid') THEN
        ALTER TABLE public.event_logs RENAME COLUMN supabase_uid TO auth_user_id;
    END IF;

    -- file_uploads
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'file_uploads' AND column_name = 'supabase_uid') THEN
        ALTER TABLE public.file_uploads RENAME COLUMN supabase_uid TO auth_user_id;
    END IF;

    -- analysis_history
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analysis_history' AND column_name = 'supabase_uid') THEN
        ALTER TABLE public.analysis_history RENAME COLUMN supabase_uid TO auth_user_id;
    END IF;

END $$;
