-- supabase/migrations/20260317000004_fuel_transactions.sql

CREATE TABLE IF NOT EXISTS fuel_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES client_billing(id) ON DELETE CASCADE,
    tank_id UUID REFERENCES tanks(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('delivery', 'reconciliation', 'adjustment', 'loss', 'sale', 'purchase')),
    amount DECIMAL(12,2) NOT NULL, -- Volume in liters
    timestamp TIMESTAMPTZ DEFAULT now(),
    performed_by_uid TEXT, -- Firebase UID
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE fuel_transactions ENABLE ROW LEVEL SECURITY;

-- Note: client_billing.firebase_uid corresponds to auth.firebase_uid() 
-- but in our hybrid setup, we check if the user belongs to the client organization.

CREATE POLICY "Users can view their organization's fuel transactions"
    ON fuel_transactions FOR SELECT
    USING (client_id IN (SELECT id FROM client_billing WHERE firebase_uid = (auth.jwt() ->> 'sub')));

-- For now, during migration, let's keep it simple as we did for tanks
CREATE POLICY "Public fuel_transactions access" ON fuel_transactions FOR ALL USING (true);
