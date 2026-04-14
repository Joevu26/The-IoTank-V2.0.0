-- cleanup_test_accounts.sql
-- ============================================================================
-- DEVELOPMENT CLEANUP: Purge all accounts except specified emails
-- ============================================================================

DO $$
DECLARE
    vh_uid UUID;
BEGIN
    -- Delete all users except josezvundi@gmail.com and joereademm@gmail.com
    FOR vh_uid IN 
        SELECT id FROM auth.users 
        WHERE email NOT IN ('josezvundi@gmail.com', 'joereademm@gmail.com')
    LOOP
        -- Due to ON DELETE CASCADE constraints defined on the tables,
        -- deleting from auth.users should automatically remove records from
        -- profiles, system_users, and any table referencing auth_user_id.
        -- We will manually delete from fuel_stations owned by this user
        -- to ensure no orphaned stations exist.
        
        DELETE FROM public.fuel_stations WHERE owner_id = vh_uid;
        
        -- Finally delete the auth user
        DELETE FROM auth.users WHERE id = vh_uid;
    END LOOP;
END $$;
