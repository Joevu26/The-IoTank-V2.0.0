-- supabase/migrations/20260319000002_lock_seed_data_to_owner.sql
-- ============================================================================
-- Lock all seeded demo data to the real owner account:
--   Email : josephvundi26@gmail.com
--   UID   : 7EtgnJ6TbbWPGZGhcC1NgZ6IQnB3
--
-- This ensures no other client portal user sees this data.
-- Run this once in the Supabase Dashboard SQL Editor.
-- ============================================================================

-- 1. Ensure the base client_billing record exists and map it to the real owner's firebase_uid + email
INSERT INTO public.client_billing (
    id,
    firebase_uid,
    email,
    station_name,
    station_location,
    county,
    subscription_tier,
    account_status,
    created_at,
    updated_at
) VALUES (
    'd0000000-0000-0000-0000-000000000001',
    '7EtgnJ6TbbWPGZGhcC1NgZ6IQnB3',
    'josephvundi26@gmail.com',
    'IoTank Demo Station',
    'Mombasa Road, Nairobi',
    'Nairobi',
    'pro',
    'active',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    firebase_uid      = EXCLUDED.firebase_uid,
    email             = EXCLUDED.email,
    station_name      = EXCLUDED.station_name,
    station_location  = EXCLUDED.station_location,
    county            = EXCLUDED.county,
    subscription_tier = EXCLUDED.subscription_tier,
    account_status    = EXCLUDED.account_status,
    updated_at        = NOW();

-- Handle potential conflict on firebase_uid/email if the record was created with a different ID
UPDATE public.client_billing
SET id = 'd0000000-0000-0000-0000-000000000001'
WHERE firebase_uid = '7EtgnJ6TbbWPGZGhcC1NgZ6IQnB3'
  AND id != 'd0000000-0000-0000-0000-000000000001';


-- 2. Update all tanks owned by this demo client to use the real firebase_uid
UPDATE public.tanks
SET firebase_uid = '7EtgnJ6TbbWPGZGhcC1NgZ6IQnB3'
WHERE client_id = 'd0000000-0000-0000-0000-000000000001';

-- 3. Update all alerts for this client to use the real firebase_uid
UPDATE public.alerts
SET firebase_uid = '7EtgnJ6TbbWPGZGhcC1NgZ6IQnB3'
WHERE client_id = 'd0000000-0000-0000-0000-000000000001';

-- 4. Update any deliveries for this client to use the real firebase_uid
UPDATE public.deliveries
SET firebase_uid = '7EtgnJ6TbbWPGZGhcC1NgZ6IQnB3'
WHERE client_id = 'd0000000-0000-0000-0000-000000000001';

-- 5. Update any transactions for this client to use the real firebase_uid
UPDATE public.transactions
SET firebase_uid = '7EtgnJ6TbbWPGZGhcC1NgZ6IQnB3'
WHERE client_id = 'd0000000-0000-0000-0000-000000000001';

-- 6. Update any usage_logs for this client to use the real firebase_uid
UPDATE public.usage_logs
SET firebase_uid = '7EtgnJ6TbbWPGZGhcC1NgZ6IQnB3'
WHERE client_id = 'd0000000-0000-0000-0000-000000000001';

-- 7. Upsert the profiles row so AuthContext can enrich with real role + client_id
INSERT INTO public.profiles (
    firebase_uid,
    email,
    display_name,
    role,
    client_id,
    site_ids,
    mfa_enabled,
    last_login_at
) VALUES (
    '7EtgnJ6TbbWPGZGhcC1NgZ6IQnB3',
    'josephvundi26@gmail.com',
    'Joseph Vundi',
    'supervisor',
    'd0000000-0000-0000-0000-000000000001',
    ARRAY['10000000-0000-0000-0000-000000000001'],
    false,
    NOW()
)
ON CONFLICT (firebase_uid) DO UPDATE SET
    email        = EXCLUDED.email,
    display_name = COALESCE(NULLIF(public.profiles.display_name, ''), EXCLUDED.display_name),
    client_id    = EXCLUDED.client_id,
    role         = EXCLUDED.role,
    last_login_at = NOW();

-- 8. Remove the old demo-user-123 placeholder from client_billing if it still exists
--    (only deletes if no other rows depend on it — cascade handles children)
DELETE FROM public.client_billing
WHERE firebase_uid = 'demo-user-123'
  AND id != 'd0000000-0000-0000-0000-000000000001';
