-- supabase/migrations/20260317000000_initial_schema.sql

-- ============================================================================
-- IOTANK FUEL INTELLIGENCE HUB - COMPLETE DATABASE SCHEMA
-- ============================================================================
-- Version: 1.1
-- Purpose: Billing, tank monitoring, and fuel management for Kenyan stations
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. True Nuclear Reset: Drop EVERYTHING in public schema regardless of migration order
DO $$ DECLARE
    r RECORD;
BEGIN
    -- Drop all tables
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
    
    -- Drop all functions (excluding extensions)
    FOR r IN (
        SELECT proname, oidvectortypes(proargtypes) as args 
        FROM pg_proc 
        JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
        WHERE pg_namespace.nspname = 'public'
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.proname) || '(' || r.args || ') CASCADE';
    END LOOP;
END $$;


-- ============================================================================
-- TABLE 1: CLIENT BILLING & SUBSCRIPTION MANAGEMENT (Replaces Organizations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  station_name TEXT NOT NULL, -- Primary station/Company name
  station_location TEXT, -- Headquarters or primary location
  county TEXT, -- Nairobi, Nakuru, Kiambu, etc.
  
  -- Financial tracking
  current_debt DECIMAL(10,2) DEFAULT 0.00 CHECK (current_debt >= 0),
  total_paid DECIMAL(10,2) DEFAULT 0.00,
  lifetime_revenue DECIMAL(10,2) DEFAULT 0.00,
  
  -- Subscription management
  subscription_tier TEXT DEFAULT 'basic' CHECK (subscription_tier IN ('basic', 'pro', 'enterprise')),
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'suspended', 'cancelled', 'trial')),
  trial_ends_at TIMESTAMP,
  subscription_started_at TIMESTAMP DEFAULT NOW(),
  last_payment_date TIMESTAMP,
  next_billing_date DATE,
  
  -- Account status
  account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'delinquent', 'closed')),
  suspension_reason TEXT,
  grace_period_ends TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- ============================================================================
-- TABLE 1.5: SITES (To support multi-location clients)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client_billing(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  tank_count INTEGER DEFAULT 0,
  manager_name TEXT,
  contact_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- TABLE 2: TRANSACTION LEDGER (Immutable Financial Record)
-- ============================================================================

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client_billing(id) ON DELETE CASCADE,
  firebase_uid TEXT NOT NULL,
  
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'charge',           -- Monthly subscription charge
    'usage_charge',     -- Pay-as-you-go usage
    'payment',          -- Client payment received
    'refund',           -- Money returned to client
    'adjustment',       -- Manual correction by admin
    'penalty',          -- Late payment fee
    'discount',         -- Promotional discount
    'credit'            -- Account credit
  )),
  
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'KES',
  
  payment_method TEXT CHECK (payment_method IN ('mpesa', 'stripe', 'paypal', 'bank_transfer', 'manual', 'crypto')),
  payment_reference TEXT,
  payment_status TEXT DEFAULT 'completed' CHECK (payment_status IN ('pending', 'completed', 'failed', 'reversed', 'disputed')),
  
  description TEXT NOT NULL,
  admin_notes TEXT,
  invoice_number TEXT,
  receipt_url TEXT,
  
  reverses_transaction_id UUID REFERENCES transactions(id),
  reversed_by_transaction_id UUID REFERENCES transactions(id),
  
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  
  created_by TEXT, -- Admin user who created
  ip_address INET,
  user_agent TEXT
);

-- ============================================================================
-- TABLE 3: USAGE TRACKING (For Metered Billing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client_billing(id) ON DELETE CASCADE,
  firebase_uid TEXT NOT NULL,
  
  usage_type TEXT NOT NULL CHECK (usage_type IN (
    'api_call', 'storage_gb', 'sms_sent', 'email_sent', 'data_export', 'ai_query', 'sensor_reading', 'tank_monitored'
  )),
  
  quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
  unit_cost DECIMAL(10,2) DEFAULT 0.00,
  total_cost DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  
  resource_id TEXT,
  metadata JSONB,
  
  billing_period_start DATE,
  billing_period_end DATE,
  is_billed BOOLEAN DEFAULT FALSE,
  billed_transaction_id UUID REFERENCES transactions(id),
  
  timestamp TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- TABLE 4: TANK CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS tanks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client_billing(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL, -- Added to support multi-site
  firebase_uid TEXT NOT NULL,
  
  tank_name TEXT NOT NULL,
  tank_code TEXT,
  
  tank_shape TEXT CHECK (tank_shape IN ('horizontal_cylinder', 'vertical_cylinder', 'rectangular', 'capsule')),
  tank_capacity DECIMAL(10,2) NOT NULL CHECK (tank_capacity > 0),
  tank_radius DECIMAL(10,2), -- meters
  tank_length DECIMAL(10,2), -- meters
  tank_height DECIMAL(10,2), -- meters (used for calibration)
  
  fuel_type TEXT CHECK (fuel_type IN ('diesel', 'petrol', 'kerosene', 'jet_fuel', 'other')),
  fuel_density DECIMAL(6,4), -- kg/L
  molar_mass DECIMAL(6,4), -- kg/mol
  
  sensor_id TEXT UNIQUE,
  sensor_type TEXT DEFAULT 'A02YYUW',
  sensor_offset DECIMAL(10,2) DEFAULT 0, -- Dead zone in mm
  last_calibration_date DATE,
  calibration_due_date DATE,
  
  current_volume DECIMAL(10,2) DEFAULT 0,
  current_temperature DECIMAL(5,2),
  standard_volume DECIMAL(10,2),
  last_reading_at TIMESTAMP,
  
  low_level_threshold DECIMAL(10,2) DEFAULT 500,
  high_temperature_threshold DECIMAL(5,2) DEFAULT 60,
  leak_detection_enabled BOOLEAN DEFAULT TRUE,
  theft_detection_enabled BOOLEAN DEFAULT TRUE,
  
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance', 'decommissioned')),
  
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  physical_location TEXT,
  
  installation_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- TABLE 5: SENSOR READINGS (Time-series data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sensor_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id UUID REFERENCES tanks(id) ON DELETE CASCADE,
  client_id UUID REFERENCES client_billing(id) ON DELETE CASCADE,
  
  raw_distance DECIMAL(10,2) NOT NULL, -- mm
  temperature DECIMAL(5,2), -- °C
  signal_strength INTEGER, -- RSSI
  
  corrected_distance DECIMAL(10,2), -- After Newton-Laplace correction
  ambient_volume DECIMAL(10,2),
  standard_volume DECIMAL(10,2),
  fill_percentage DECIMAL(5,2),
  
  reading_quality TEXT CHECK (reading_quality IN ('excellent', 'good', 'fair', 'poor', 'error')),
  error_code TEXT,
  
  timestamp TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- TABLE 6: ALERTS & NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client_billing(id) ON DELETE CASCADE,
  tank_id UUID REFERENCES tanks(id) ON DELETE SET NULL,
  firebase_uid TEXT NOT NULL,
  
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'theft_detected', 'leak_detected', 'low_fuel', 'high_temperature', 'sensor_offline', 'calibration_due', 'payment_overdue', 'delivery_variance', 'system_error'
  )),
  
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  alert_data JSONB,
  
  is_read BOOLEAN DEFAULT FALSE,
  is_acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMP,
  acknowledged_by TEXT,
  
  sms_sent BOOLEAN DEFAULT FALSE,
  sms_sent_at TIMESTAMP,
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMP,
  push_sent BOOLEAN DEFAULT FALSE,
  push_sent_at TIMESTAMP,
  
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- ============================================================================
-- TABLE 7: DELIVERY VERIFICATION (BOL Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client_billing(id) ON DELETE CASCADE,
  tank_id UUID REFERENCES tanks(id) ON DELETE SET NULL,
  firebase_uid TEXT NOT NULL,
  
  delivery_date TIMESTAMP NOT NULL,
  supplier_name TEXT,
  driver_name TEXT,
  truck_number TEXT,
  
  bol_number TEXT,
  bol_claimed_volume DECIMAL(10,2),
  bol_temperature DECIMAL(5,2),
  bol_photo_url TEXT,
  
  tank_before_volume DECIMAL(10,2),
  tank_after_volume DECIMAL(10,2),
  actual_received_volume DECIMAL(10,2),
  actual_temperature DECIMAL(5,2),
  
  variance_volume DECIMAL(10,2) GENERATED ALWAYS AS (bol_claimed_volume - actual_received_volume) STORED,
  variance_percentage DECIMAL(5,2),
  
  verification_status TEXT CHECK (verification_status IN (
    'pending', 'verified_ok', 'disputed_shortage', 'disputed_overage', 'under_investigation', 'resolved'
  )),
  
  is_accepted BOOLEAN,
  dispute_notes TEXT,
  resolution_notes TEXT,
  
  unit_price DECIMAL(10,2),
  total_cost DECIMAL(12,2),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- TABLE 8: MARKET INTELLIGENCE (Price Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS market_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_type TEXT NOT NULL,
  price_per_liter DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'KES',
  source TEXT NOT NULL CHECK (source IN ('epra', 'bloomberg', 'manual', 'api')),
  region TEXT DEFAULT 'kenya',
  city TEXT,
  price_type TEXT CHECK (price_type IN ('retail', 'wholesale', 'spot', 'futures')),
  effective_date DATE NOT NULL,
  recorded_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(fuel_type, source, region, effective_date)
);

-- ============================================================================
-- TABLE 9: AI PROCUREMENT RECOMMENDATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client_billing(id) ON DELETE CASCADE,
  recommendation_type TEXT CHECK (recommendation_type IN ('buy_now', 'wait', 'monitor')),
  confidence_score DECIMAL(5,2) CHECK (confidence_score >= 0 AND confidence_score <= 100),
  reasoning TEXT NOT NULL,
  current_price DECIMAL(10,2),
  predicted_price_7day DECIMAL(10,2),
  predicted_price_14day DECIMAL(10,2),
  potential_savings DECIMAL(10,2),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  user_action TEXT CHECK (user_action IN ('followed', 'ignored', 'deferred', 'pending')),
  user_action_date TIMESTAMP,
  was_accurate BOOLEAN,
  actual_outcome TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- ============================================================================
-- TABLE: PROFILES (User specific data) - MOVED FROM ADDITIONAL TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT UNIQUE NOT NULL,
  client_id UUID REFERENCES client_billing(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'operator' CHECK (role IN ('owner', 'admin', 'supervisor', 'operator', 'viewer')),
  site_ids TEXT[] DEFAULT '{}', -- Array of site IDs this user can access
  mfa_enabled BOOLEAN DEFAULT FALSE,
  master_access_password TEXT, -- For settings verification
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- TABLE: SHIFT_CLOSURES - MOVED FROM ADDITIONAL TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS shift_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client_billing(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  tank_id UUID REFERENCES tanks(id) ON DELETE CASCADE,
  
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL,
  closed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_min INTEGER NOT NULL,
  
  pump_readings JSONB NOT NULL, -- Map of pump names to {start, end} readings
  volume_sold_liters DECIMAL(10,2) NOT NULL,
  
  expected_collections JSONB, -- {cash, mpesa, pos, total}
  received_collections JSONB, -- {cash, mpesa, pos, total}
  variance_data JSONB, -- {amount, pct}
  
  status TEXT CHECK (status IN ('BALANCED', 'OVER', 'SHORT')),
  review_state TEXT DEFAULT 'PENDING' CHECK (review_state IN ('PENDING', 'APPROVED', 'DISPUTED', 'CLOSED')),
  
  closed_by_uid TEXT NOT NULL, -- firebase_uid of the operator
  supervisor_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TABLE: USER_PREFERENCES - MOVED FROM ADDITIONAL TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- INDEXES & TRIGGERS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_billing_firebase_uid ON client_billing(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_billing_status ON client_billing(account_status);
CREATE INDEX IF NOT EXISTS idx_billing_subscription ON client_billing(subscription_tier, subscription_status);
CREATE INDEX IF NOT EXISTS idx_billing_debt ON client_billing(current_debt) WHERE current_debt > 0;

CREATE INDEX IF NOT EXISTS idx_sites_client ON sites(client_id);

CREATE INDEX IF NOT EXISTS idx_profiles_firebase_uid ON profiles(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_profiles_client ON profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_shift_closures_client ON shift_closures(client_id);
CREATE INDEX IF NOT EXISTS idx_shift_closures_tank ON shift_closures(tank_id);
CREATE INDEX IF NOT EXISTS idx_shift_closures_date ON shift_closures(closed_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_client ON transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_firebase_uid ON transactions(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);

CREATE INDEX IF NOT EXISTS idx_usage_client ON usage_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_logs(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_tanks_client ON tanks(client_id);
CREATE INDEX IF NOT EXISTS idx_tanks_site ON tanks(site_id);
CREATE INDEX IF NOT EXISTS idx_tanks_sensor ON tanks(sensor_id);

CREATE INDEX IF NOT EXISTS idx_readings_tank_time ON sensor_readings(tank_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON sensor_readings(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_client ON alerts(client_id);
CREATE INDEX IF NOT EXISTS idx_alerts_tank ON alerts(tank_id);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts(client_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_alerts_unresolved ON alerts(client_id, is_resolved) WHERE is_resolved = FALSE;

CREATE INDEX IF NOT EXISTS idx_deliveries_client ON deliveries(client_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_tank ON deliveries(tank_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(delivery_date DESC);

CREATE INDEX IF NOT EXISTS idx_market_prices_fuel ON market_prices(fuel_type);
CREATE INDEX IF NOT EXISTS idx_market_prices_date ON market_prices(effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_ai_recs_client ON ai_recommendations(client_id);
CREATE INDEX IF NOT EXISTS idx_ai_recs_date ON ai_recommendations(created_at DESC);

-- Updated At Trigger Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_client_billing_updated_at ON client_billing;
CREATE TRIGGER update_client_billing_updated_at BEFORE UPDATE ON client_billing FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_sites_updated_at ON sites;
CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON sites FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_tanks_updated_at ON tanks;
CREATE TRIGGER update_tanks_updated_at BEFORE UPDATE ON tanks FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_deliveries_updated_at ON deliveries;
CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON deliveries FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================================
-- GRANT PUBLIC ACCESS (Controlled by RLS)
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
