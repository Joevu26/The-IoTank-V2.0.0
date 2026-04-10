-- supabase/migrations/20260317174103_add_master_password_to_profiles.sql

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS master_access_password TEXT;
