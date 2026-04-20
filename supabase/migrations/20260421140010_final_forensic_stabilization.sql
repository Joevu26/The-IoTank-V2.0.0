-- FORENSIC STABILIZATION: DECOMPOSED PASS
-- Moving all Firebase legacy intelligence to Supabase Native Hub.
-- Independent execution of automation cycles for maximum resilience.

-- 0. Schema Hardening
CREATE TABLE IF NOT EXISTS public.daily_summaries (
    tank_id UUID REFERENCES public.tanks(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    avg_ambient_volume DECIMAL(10,2),
    avg_temperature DECIMAL(5,2),
    reading_count INTEGER DEFAULT 0,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tank_id, date)
);

-- 1. Connectivity Watchdog (Every 30 minutes)
SELECT cron.schedule(
    'connectivity-watchdog-30m',
    '*/30 * * * *',
    $f$
      select net.http_post(
        url := 'https://suifvborodwergtrbjez.supabase.co/functions/v1/connectivity-watchdog',
        headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', current_setting('app.settings.anon_key', true)),
        body := '{}'::jsonb
      );
    $f$
);

-- 2. Market Intelligence (Every hour)
SELECT cron.schedule(
    'market-fetch-every-hour',
    '0 * * * *',
    $f$
      select net.http_post(
        url := 'https://suifvborodwergtrbjez.supabase.co/functions/v1/market-intelligence-fetcher',
        headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', current_setting('app.settings.anon_key', true)),
        body := '{}'::jsonb
      );
    $f$
);

-- 3. Forensic Leak Detection (Every 4 hours)
SELECT cron.schedule(
    'detect-leaks-every-4h',
    '0 */4 * * *',
    $f$
      select net.http_post(
        url := 'https://suifvborodwergtrbjez.supabase.co/functions/v1/detect-leaks',
        headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', current_setting('app.settings.anon_key', true)),
        body := '{}'::jsonb
      );
    $f$
);

-- 4. Daily Analytics Aggregate (Midnight UTC)
SELECT cron.schedule(
    'daily-analytics-rollup-midnight',
    '0 0 * * *',
    $f$
      select net.http_post(
        url := 'https://suifvborodwergtrbjez.supabase.co/functions/v1/daily-analytics-rollup',
        headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', current_setting('app.settings.anon_key', true)),
        body := '{}'::jsonb
      );
    $f$
);

-- 5. Real-Time Data Smoothing (Kalman Filtering)
CREATE OR REPLACE FUNCTION public.handle_data_smoothing()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.settings.anon_key', true) IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://suifvborodwergtrbjez.supabase.co/functions/v1/data-smoothing',
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', current_setting('app.settings.anon_key', true)),
      body := jsonb_build_object('record', to_jsonb(NEW))
    );
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_data_smoothing ON public.sensor_readings;
CREATE TRIGGER trigger_data_smoothing
  AFTER INSERT ON public.sensor_readings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_data_smoothing();
