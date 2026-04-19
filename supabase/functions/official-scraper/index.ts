// supabase/functions/official-scraper/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.40.0"
import { getCorsHeaders } from "../_shared/cors.ts"

const SCRAPER_CONFIG = [
  {
    name: 'EPRA Petroleum Prices',
    domain: 'epra.go.ke',
    url: 'https://www.epra.go.ke/petroleum-prices/',
  },
  {
    name: 'KPC Logistics',
    domain: 'kpc.co.ke',
    url: 'https://www.kpc.co.ke/about-kpc/corporate-profile/',
  }
];

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const results = [];

    for (const site of SCRAPER_CONFIG) {
      console.log('Scraping official site:', site.name)
      
      const response = await fetch(site.url, {
        headers: { 'User-Agent': 'IoTank-Forensic-Bot/2.0 (+https://iotank.co.ke)' }
      });

      if (!response.ok) {
        console.warn(`Failed to scrape ${site.name}: ${response.statusText}`);
        continue;
      }

      const html = await response.text();
      
      // Basic heuristic extraction for high-integrity notices
      // We look for PDF links or recent date mentions in the text
      const dateMatch = html.match(/(\d{1,2}(st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i);
      const pdfMatch = html.match(/href="([^"]+\.pdf)"/i);

      if (dateMatch || pdfMatch) {
        const signal = {
          id: `official-${site.domain}-${Date.now()}`,
          type: 'regulatory',
          source: site.name,
          sourceType: 'API',
          title: `Official Update from ${site.name}`,
          summary: `New official documentation or price review detected at ${site.domain}. Detected Date: ${dateMatch?.[0] || 'Recent'}.`,
          timestamp: Date.now(),
          relevanceScore: 1.0,
          confidenceScore: 1.0,
          externalUrl: site.url,
          attribution: site.domain,
          metadata: { pdfUrl: pdfMatch?.[1] }
        };

        // Upsert into market_news to trigger realtime alerts
        const { error } = await supabase.from('market_news').upsert({
          id: signal.id,
          source: signal.source,
          title: signal.title,
          link: signal.externalUrl,
          summary: signal.summary,
          source_type: signal.sourceType,
          created_at: new Date().toISOString()
        });


        if (error) console.error('Error upserting signal:', error);
        results.push(signal);
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Official Scraper Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
