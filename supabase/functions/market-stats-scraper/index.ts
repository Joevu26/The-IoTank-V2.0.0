// supabase/functions/market-stats-scraper/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"
import { getCorsHeaders } from "../_shared/cors.ts"

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

    const BRENT_URL = Deno.env.get('BRENT_CRUDE_URL') || 'https://www.marketwatch.com/investing/future/brn00?countrycode=uk';
    const FX_URL = Deno.env.get('FX_URL') || 'https://www.centralbank.go.ke/rates/forex-exchange-rates/';

    const results = [];

    // 1. Scrape Brent Crude
    try {
      const brentResp = await fetch(BRENT_URL, {
        headers: { 'User-Agent': 'IoTank-Stats-Bot/2.0' }
      });
      const brentHtml = await brentResp.text();
      // Heuristic: Looking for a price pattern like "$74.50" or "74.50" near "price" or "bg-quote"
      const priceMatch = brentHtml.match(/bg-quote[^>]*>([\d,.]+)</i) || brentHtml.match(/current-price[^>]*>([\d,.]+)</i);
      const brentPrice = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : 74.50;

      await supabase.from('market_prices').upsert({
        fuel_type: 'BRENT',
        price_per_liter: brentPrice, // Storing as "unit price"
        currency: 'USD',
        source: 'marketwatch',
        effective_date: new Date().toISOString()
      }, { onConflict: 'fuel_type' });
      
      results.push({ type: 'BRENT', value: brentPrice });
    } catch (e) {
      console.error('Brent Scrape Error:', e);
    }

    // 2. Scrape GBP/KSH
    try {
      const fxResp = await fetch(FX_URL, {
        headers: { 'User-Agent': 'IoTank-Stats-Bot/2.0' }
      });
      const fxHtml = await fxResp.text();
      // Heuristic for CBK table
      const gbpMatch = fxHtml.match(/GBP[^<]*<\/td>\s*<td[^>]*>([\d,.]+)</i);
      const gbpRate = gbpMatch ? parseFloat(gbpMatch[1].replace(',', '')) : 162.40;

      await supabase.from('market_prices').upsert({
        fuel_type: 'GBP_KSH',
        price_per_liter: gbpRate,
        currency: 'KSH',
        source: 'cbk',
        effective_date: new Date().toISOString()
      }, { onConflict: 'fuel_type' });

      results.push({ type: 'GBP_KSH', value: gbpRate });
    } catch (e) {
      console.error('FX Scrape Error:', e);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
