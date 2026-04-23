-- supabase/migrations/20260423140000_prune_widowed_code.sql
-- ============================================================================
-- FINAL DEAD CODE PRUNING
-- Dropping orphaned functions that reference deleted columns or dropped tables.
-- ============================================================================

DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc
        WHERE proname IN (
            'verify_master_password',
            'cleanup_old_audit_logs',
            'admin_delete_user',
            'get_admin_dashboard_stats',
            'calculate_monthly_usage_bill',
            'detect_theft_anomaly',
            'bootstrap_super_admin',
            'get_current_user_record',
            'log_registration_event',
            'process_payment',
            'admin_adjust_station_debt',
            'admin_suspend_station',
            'get_user_bundle_v1',
            'get_client_dashboard_summary',
            'get_tankiq_delivery_logs',
            'validate_core_schema',
            'log_auth_attempt',
            'get_tankiq_market_context',
            'get_tankiq_station_summary',
            'get_tankiq_consumption_stats',
            'add_debt_to_client',
            'admin_record_external_payment',
            'admin_update_station_profile',
            'admin_reactivate_station',
            'get_admin_risk_matrix',
            'update_master_password',
            'check_my_identity'
        ) AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.func_signature || ' CASCADE;';
    END LOOP;
END $$;
