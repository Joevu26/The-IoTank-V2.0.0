-- supabase/migrations/20260317000005_market_bookmarks.sql

CREATE TABLE IF NOT EXISTS market_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES client_billing(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT,
    source TEXT,
    published_at TIMESTAMPTZ,
    saved_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE market_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's bookmarks"
    ON market_bookmarks FOR SELECT
    USING (client_id IN (SELECT id FROM client_billing WHERE firebase_uid = (auth.jwt() ->> 'sub')));

CREATE POLICY "Users can manage their organization's bookmarks"
    ON market_bookmarks FOR ALL
    USING (client_id IN (SELECT id FROM client_billing WHERE firebase_uid = (auth.jwt() ->> 'sub')));

-- For now, during migration, let's keep it simple
CREATE POLICY "Public market_bookmarks access" ON market_bookmarks FOR ALL USING (true);
