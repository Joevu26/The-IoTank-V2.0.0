// supabase/functions/newsdata-proxy/index.ts
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

    const maxRequests = authz.context.user.id === 'anonymous' ? 5 : 20;
    const limit = await enforceDurableRateLimit(authz.context, corsHeaders, 'newsdata-proxy', maxRequests);
    if ('response' in limit) return limit.response;

    const { query, country = 'ke' } = await req.json()
    const apiKey = Deno.env.get('NEWSDATA_API_KEY')
    if (!apiKey) throw new Error('NEWSDATA_API_KEY not configured')

    const url = `https://newsdata.io/api/1/news?apikey=${apiKey}&q=${encodeURIComponent(query)}&country=${country}`

    console.log('Calling NewsData API for query:', query)
    const response = await fetch(url)
    const data = await response.json()

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('NewsData Proxy Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
