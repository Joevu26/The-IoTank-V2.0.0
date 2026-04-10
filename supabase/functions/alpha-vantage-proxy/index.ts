// supabase/functions/alpha-vantage-proxy/index.ts

import { getCorsHeaders } from '../_shared/cors.ts'
import { enforceDurableRateLimit, requireProxyScope } from '../_shared/auth.ts'
declare const Deno: any;

const ALLOWED_FUNCTIONS = new Set(['NEWS_SENTIMENT', 'WTI', 'BRENT'])

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authz = await requireProxyScope(req, corsHeaders);
    if ('response' in authz) return authz.response;

    const limit = await enforceDurableRateLimit(authz.context, corsHeaders, 'alpha-vantage-proxy', 30);
    if ('response' in limit) return limit.response;

    const { symbol } = await req.json()
    if (!symbol || typeof symbol !== 'string') {
      throw new Error('symbol is required')
    }
    if (!ALLOWED_FUNCTIONS.has(symbol)) {
      throw new Error('Unsupported symbol/function')
    }
    const apiKey = Deno.env.get('ALPHA_VANTAGE_API_KEY')

    if (!apiKey) {
      throw new Error('Alpha Vantage API key not configured')
    }

    const url = symbol === 'NEWS_SENTIMENT'
      ? `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=energy_transportation&limit=10&apikey=${apiKey}`
      : `https://www.alphavantage.co/query?function=${symbol}&interval=daily&apikey=${apiKey}`;
    const response = await fetch(url)
    const data = await response.json()

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Function error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
