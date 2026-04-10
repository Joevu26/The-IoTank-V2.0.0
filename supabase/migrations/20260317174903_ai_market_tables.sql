-- supabase/migrations/20260317174903_ai_market_tables.sql

-- Table for Market Signals (News)
CREATE TABLE IF NOT EXISTS market_signals (
    id TEXT PRIMARY KEY, -- String ID like 'news-urlhash'
    client_id UUID REFERENCES client_billing(id) ON DELETE CASCADE,
    type TEXT,
    source TEXT,
    source_type TEXT,
    title TEXT NOT NULL,
    summary TEXT,
    timestamp BIGINT,
    relevance_score DECIMAL(5,4),
    confidence_score DECIMAL(5,4),
    external_url TEXT,
    attribution TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for Regulatory Notices (EPRA)
CREATE TABLE IF NOT EXISTS regulatory_notices (
    id TEXT PRIMARY KEY,
    client_id UUID REFERENCES client_billing(id) ON DELETE CASCADE,
    authority TEXT,
    notice_type TEXT,
    title TEXT NOT NULL,
    effective_date BIGINT,
    summary TEXT,
    document_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for Raw Market Data (EIA, Alpha Vantage)
CREATE TABLE IF NOT EXISTS raw_market_data (
    id TEXT PRIMARY KEY,
    client_id UUID REFERENCES client_billing(id) ON DELETE CASCADE,
    fuel_type TEXT,
    region TEXT,
    price_per_liter DECIMAL(10,4),
    currency TEXT,
    timestamp BIGINT,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_market_signals_client ON market_signals(client_id);
CREATE INDEX IF NOT EXISTS idx_market_signals_time ON market_signals(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_requlatory_notices_client ON regulatory_notices(client_id);
CREATE INDEX IF NOT EXISTS idx_raw_market_data_client ON raw_market_data(client_id);

-- Explicitly allow public access to these tables (controlled by Auth on the client side)
GRANT ALL ON TABLE market_signals TO anon, authenticated;
GRANT ALL ON TABLE regulatory_notices TO anon, authenticated;
GRANT ALL ON TABLE raw_market_data TO anon, authenticated;
