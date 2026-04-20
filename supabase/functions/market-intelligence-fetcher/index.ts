import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.40.0"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') || '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );

        const EIA_API_KEY = Deno.env.get('EIA_API_KEY');
        const ALPHA_VANTAGE_API_KEY = Deno.env.get('ALPHA_VANTAGE_API_KEY');
        const EXCHANGE_RATE_API_KEY = Deno.env.get('EXCHANGE_RATE_API_KEY');

        console.log('[MarketFetch] Starting global intelligence sync...');

        // 1. Brent Crude (EIA)
        if (EIA_API_KEY) {
            const brentUrl = `https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=${EIA_API_KEY}&frequency=daily&data[0]=value&facets[series][]=RBRTE&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=1`;
            const res = await fetch(brentUrl);
            const json = await res.json();
            const data = json.response?.data?.[0];
            if (data) {
                await supabase.from('market_signals').insert({
                    source: 'EIA',
                    category: 'commodity',
                    title: 'Brent Crude Spot Price',
                    summary: `Latest spot price: $${data.value} per barrel.`,
                    confidence: 1.0,
                    validated: true,
                    data_points: { price: parseFloat(data.value), unit: 'USD/bbl', period: data.period },
                    source_type: 'API',
                    attribution: 'US Energy Information Administration'
                });
            }
        } else {
            console.warn('[MarketFetch] Skipping Brent Crude: EIA_API_KEY not configured.');
        }

        // 2. WTI Crude (Alpha Vantage)
        if (ALPHA_VANTAGE_API_KEY) {
            const wtiUrl = `https://www.alphavantage.co/query?function=WTI&interval=monthly&apikey=${ALPHA_VANTAGE_API_KEY}`;
            const res = await fetch(wtiUrl);
            const json = await res.json();
            const data = json.data?.[0];
            if (data) {
                await supabase.from('market_signals').insert({
                    source: 'AlphaVantage',
                    category: 'commodity',
                    title: 'WTI Crude Benchmark',
                    summary: `WTI Crude monthly value: $${data.value}.`,
                    confidence: 0.9,
                    validated: true,
                    data_points: { price: parseFloat(data.value), unit: 'USD/bbl', date: data.date },
                    source_type: 'API',
                    attribution: 'Alpha Vantage Data'
                });
            }
        } else {
            console.warn('[MarketFetch] Skipping WTI Crude: ALPHA_VANTAGE_API_KEY not configured.');
        }

        // 3. USD/KES (Exchange Rate API)
        if (EXCHANGE_RATE_API_KEY) {
            const res = await fetch(`https://v6.exchangerate-api.com/v6/${EXCHANGE_RATE_API_KEY}/latest/USD`);
            const json = await res.json();
            if (json.result === 'success') {
                const kesRate = json.conversion_rates.KES;
                await supabase.from('market_signals').insert({
                    source: 'ExchangeRateAPI',
                    category: 'forex',
                    title: 'USD/KES Exchange Rate',
                    summary: `Current exchange rate: 1 USD = ${kesRate} KES.`,
                    confidence: 1.0,
                    validated: true,
                    data_points: { price: parseFloat(kesRate), unit: 'KES/USD', base: 'USD' },
                    source_type: 'API',
                    attribution: 'ExchangeRate-API'
                });
            }
        } else {
            console.warn('[MarketFetch] Skipping Exchange Rate: EXCHANGE_RATE_API_KEY not configured.');
        }

        return new Response(JSON.stringify({ status: 'Market intelligence sync completed' }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });

    } catch (error) {
        console.error('[MarketFetch] Error:', error.message);
        return new Response(JSON.stringify({ error: error.message }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
        });
    }
})
