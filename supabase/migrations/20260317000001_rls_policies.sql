-- supabase/migrations/20260317000001_rls_policies.sql

-- Enable RLS on all tables
ALTER TABLE client_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE tanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_prices ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's firebase_uid from metadata
-- Since we are using Firebase Auth with Supabase Edge Functions / Client, 
-- we typically expect the user's UID to match firebase_uid.
CREATE OR REPLACE FUNCTION public.firebase_uid() 
RETURNS TEXT AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claims', true)::json->>'sub', ''),
    current_setting('request.headers', true)::json->>'x-firebase-uid'
  );
$$ LANGUAGE SQL STABLE;

-- 1. Client Billing: Users can see and update their own billing info
CREATE POLICY "Users can see own billing" ON client_billing
    FOR SELECT USING (firebase_uid = public.firebase_uid());

CREATE POLICY "Users can update own billing" ON client_billing
    FOR UPDATE USING (firebase_uid = public.firebase_uid());

-- 2. Sites: Filter by client_id linked to user
CREATE POLICY "Users can see own sites" ON sites
    FOR ALL USING (
        client_id IN (SELECT id FROM client_billing WHERE firebase_uid = public.firebase_uid())
    );

-- 3. Tanks: Filter by client_id
CREATE POLICY "Users can see own tanks" ON tanks
    FOR ALL USING (
        client_id IN (SELECT id FROM client_billing WHERE firebase_uid = public.firebase_uid())
    );

-- 4. Sensor Readings: Filter by client_id
CREATE POLICY "Users can see own readings" ON sensor_readings
    FOR SELECT USING (
        client_id IN (SELECT id FROM client_billing WHERE firebase_uid = public.firebase_uid())
    );

-- 5. Alerts: Filter by client_id
CREATE POLICY "Users can see own alerts" ON alerts
    FOR ALL USING (
        client_id IN (SELECT id FROM client_billing WHERE firebase_uid = public.firebase_uid())
    );

-- 6. Deliveries: Filter by client_id
CREATE POLICY "Users can see own deliveries" ON deliveries
    FOR ALL USING (
        client_id IN (SELECT id FROM client_billing WHERE firebase_uid = public.firebase_uid())
    );

-- 7. Usage Logs: Filter by client_id
CREATE POLICY "Users can see own usage" ON usage_logs
    FOR SELECT USING (
        client_id IN (SELECT id FROM client_billing WHERE firebase_uid = public.firebase_uid())
    );

-- 8. AI Recommendations: Filter by client_id
CREATE POLICY "Users can see own recommendations" ON ai_recommendations
    FOR SELECT USING (
        client_id IN (SELECT id FROM client_billing WHERE firebase_uid = public.firebase_uid())
    );

-- 9. Market Prices: Public Read
CREATE POLICY "Everyone can see market prices" ON market_prices
    FOR SELECT USING (true);

-- Admin Logic (Optional)
-- If we have a role for 'admin', we can add bypass policies.
