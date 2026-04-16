// supabase/functions/gnews-proxy/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getCorsHeaders } from "../_shared/cors.ts"
import { enforceDurableRateLimit, getOptionalProxyScope } from "../_shared/auth.ts"

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authz = await getOptionalProxyScope(req, corsHeaders);
    if ('response' in authz) return authz.response;

    const limit = await enforceDurableRateLimit(authz.context, corsHeaders, 'gnews-proxy', 10);
    if ('response' in limit) return limit.response;

    const { query, lang = 'en', country = 'ke', max = 10 } = await req.json()
    const apiKey = Deno.env.get('GNEWS_API_KEY')
    if (!apiKey) throw new Error('GNEWS_API_KEY not configured')

    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=${lang}&country=${country}&max=${max}&apikey=${apiKey}`

    console.log('Calling GNews API for query:', query)
    const response = await fetch(url)
    const data = await response.json()

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('GNews Proxy Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
