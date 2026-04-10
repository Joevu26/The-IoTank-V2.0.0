-- supabase/migrations/20260317174439_services_tables.sql

-- Add photo_url to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Table for AuditService
DROP TABLE IF EXISTS audit_logs CASCADE;
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    user_id TEXT NOT NULL, -- firebase_uid
    user_name TEXT,
    client_id UUID REFERENCES client_billing(id) ON DELETE CASCADE,
    details TEXT,
    severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tables for FileAnalysisService
DROP TABLE IF EXISTS file_uploads CASCADE;
CREATE TABLE IF NOT EXISTS file_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES client_billing(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, -- firebase_uid
    file_name TEXT NOT NULL,
    file_type TEXT CHECK (file_type IN ('pdf', 'csv')),
    file_size INTEGER,
    storage_path TEXT NOT NULL,
    public_url TEXT,
    analysis_status TEXT DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TABLE IF EXISTS analysis_history CASCADE;
CREATE TABLE IF NOT EXISTS analysis_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES file_uploads(id) ON DELETE CASCADE,
    client_id UUID REFERENCES client_billing(id) ON DELETE CASCADE,
    analysis_type TEXT,
    analysis_result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_client ON audit_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_client ON file_uploads(client_id);
CREATE INDEX IF NOT EXISTS idx_analysis_history_file ON analysis_history(file_id);

-- Explicitly allow public access to these tables (controlled by Auth on the client side)
GRANT ALL ON TABLE audit_logs TO anon, authenticated;
GRANT ALL ON TABLE file_uploads TO anon, authenticated;
GRANT ALL ON TABLE analysis_history TO anon, authenticated;
