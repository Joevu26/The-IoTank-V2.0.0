-- Migration for News Infrastructure Optimization
-- Date: 2026-04-16

-- Table for RSS feed caching to reduce redundant fetches and stay within free-tier limits
CREATE TABLE IF NOT EXISTS public.rss_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feed_url TEXT UNIQUE NOT NULL,
    content JSONB NOT NULL,
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fetch_count INTEGER DEFAULT 0,
    last_error TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add link column to market_news for external references
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_news' AND column_name = 'link') THEN
        ALTER TABLE public.market_news ADD COLUMN link TEXT;
    END IF;
END $$;

-- Enable RLS for rss_cache
DO $$
BEGIN
    ALTER TABLE public.rss_cache ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $$;


-- Allow authenticated users to read the cache
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated users to read RSS cache" ON public.rss_cache;
    CREATE POLICY "Allow authenticated users to read RSS cache" 
        ON public.rss_cache FOR SELECT 
        TO authenticated 
        USING (true);
END $$;


-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_rss_cache_url ON public.rss_cache(feed_url);
CREATE INDEX IF NOT EXISTS idx_rss_cache_time ON public.rss_cache(cached_at);

-- Table for tracking scraper rate limits ethically
CREATE TABLE IF NOT EXISTS public.scraper_rate_limits (
    domain TEXT PRIMARY KEY,
    last_scrape_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scrape_count INTEGER DEFAULT 0,
    last_error TEXT
);

-- Indices for scraper
CREATE INDEX IF NOT EXISTS idx_scraper_last_at ON public.scraper_rate_limits(last_scrape_at);

-- Function to cleanup old cache (keep last 24 hours of stories)
CREATE OR REPLACE FUNCTION public.cleanup_old_rss_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM public.rss_cache 
  WHERE cached_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to service_role for edge functions
GRANT ALL ON public.rss_cache TO service_role;
GRANT ALL ON public.scraper_rate_limits TO service_role;
