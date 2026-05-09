// supabase/functions/official-scraper/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.40.0"
import { getCorsHeaders } from "../_shared/cors.ts"
import { enforceDurableRateLimit, getOptionalProxyScope } from "../_shared/auth.ts"

const SCRAPER_CONFIG = [
  {
    name: 'EPRA Petroleum Prices',
    domain: 'epra.go.ke',
    url: 'https://www.epra.go.ke/petroleum-prices/',
    type: 'Regulatory'
  }
];


// Forensic Regex: Extract prices with fuel types
// Matches patterns like: Super Petrol retail at Ksh 179.30
const EPRA_PRICE_REGEX = /(Super Petrol|Diesel|Kerosene|PMS|AGO|IK).*?(retail at|set at|Ksh|shillings)\s*(\d{1,3}(\.\d{2})?)/gi;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // [STABILITY]: Use optional scope so public dashboard can trigger (rate-limited by IP)
    const authz = await getOptionalProxyScope(req, corsHeaders);
    if ('response' in authz) return authz.response;

    const limit = await enforceDurableRateLimit(authz.context, corsHeaders, 'official-scraper', 10);
    if ('response' in limit) return limit.response;
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const results = [];

    for (const site of SCRAPER_CONFIG) {
      console.log(`[OfficialScraper] Scanning ${site.name}...`);
      
      const response = await fetch(site.url, {
        headers: { 
          'User-Agent': 'IoTank-Forensic-Bot/2.0 (+https://the-iotank-project.web.app)',
          'Accept': 'text/html'
        }
      });

      if (!response.ok) {
        console.warn(`[OfficialScraper] Failed to reach ${site.name}: ${response.statusText}`);
        continue;
      }

      const html = await response.text();
      
      // 1. Detect New Notice (PDF or Date)
      const dateMatch = html.match(/(\d{1,2}(st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i);
      const pdfMatch = html.match(/href="([^"]+\.pdf)"/i);

      if (dateMatch || pdfMatch) {
        const signalId = `official-${site.domain}-${Date.now()}`;
        const foundDate = dateMatch?.[0] || new Date().toISOString();
        
        // 2. Perform Forensic Extraction for EPRA
        if (site.domain === 'epra.go.ke') {
          // Enhanced Forensic Regex: Better handling of table structures and spacing
          const EPRA_FORENSIC_REGEX = /(Super Petrol|Diesel|Kerosene|PMS|AGO|IK).*?(\d{1,3}(?:\.\d{2})?)/gi;
          
          let match;
          const detections = [];
          
          while ((match = EPRA_FORENSIC_REGEX.exec(html)) !== null) {
            const fuelLabel = match[1].toUpperCase();
            const price = parseFloat(match[2]);
            
            if (price > 100 && price < 300) {
              // Map to standard fuel keys
              let fuelType = fuelLabel;
              if (fuelLabel.includes('PETROL') || fuelLabel === 'PMS') fuelType = 'PMS';
              else if (fuelLabel.includes('DIESEL') || fuelLabel === 'AGO') fuelType = 'AGO';
              else if (fuelLabel.includes('KEROSENE') || fuelLabel === 'IK') fuelType = 'IK';

              detections.push({ fuelType, price });

              // 3. Trigger Forensic Update RPC (Match exact schema)
              await supabase.rpc('forensic_update_market_price', {
                p_fuel_type: fuelType,
                p_new_price: price,
                p_effective_date: new Date().toISOString(),
                p_source_url: site.url,
                p_is_official: true
              });
            }
          }
          console.log(`[OfficialScraper] Detected ${detections.length} prices from EPRA.`);
        }

        const signal = {
          id: signalId,
          type: 'regulatory',
          source: site.name,
          sourceType: 'API',
          title: `Official Update: ${site.name}`,
          summary: `Official document or price review detected at ${site.domain}. Detected Date: ${foundDate}.`,
          timestamp: Date.now(),
          relevanceScore: 1.0,
          confidenceScore: 1.0,
          externalUrl: site.url,
          attribution: site.domain,
          metadata: { pdfUrl: pdfMatch?.[1], isForensic: true }
        };

        // Broadcast to news feed
        await supabase.from('market_news').upsert({
          id: signal.id,
          source: signal.source,
          title: signal.title,
          link: signal.externalUrl,
          summary: signal.summary,
          source_type: signal.sourceType,
          created_at: new Date().toISOString()
        });

        results.push(signal);
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[OfficialScraper] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
