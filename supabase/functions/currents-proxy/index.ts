import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getCorsHeaders } from "../_shared/cors.ts"
import { enforceDurableRateLimit, requireProxyScope } from "../_shared/auth.ts"

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authz = await requireProxyScope(req, corsHeaders);
    if ('response' in authz) return authz.response;

    const limit = await enforceDurableRateLimit(authz.context, corsHeaders, 'currents-proxy', 10);
    if ('response' in limit) return limit.response;

    const { query, language = 'en', country = 'KE' } = await req.json()
    const apiKey = Deno.env.get('CURRENTS_API_KEY')
    if (!apiKey) throw new Error('CURRENTS_API_KEY not configured')

    const url = `https://api.currentsapi.services/v1/search?apiKey=${apiKey}&keywords=${encodeURIComponent(query)}&language=${language}&country=${country}`

    console.log('Calling Currents API for query:', query)
    const response = await fetch(url)
    const data = await response.json()

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('Currents Proxy Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
