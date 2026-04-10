// supabase/functions/news-api-proxy/index.ts

import { getCorsHeaders } from '../_shared/cors.ts'
import { enforceDurableRateLimit, requireProxyScope } from '../_shared/auth.ts'
declare const Deno: any;

const ALLOWED_HOSTNAMES = new Set([
  'newsapi.org',
  'api.rss2json.com',
  'news.google.com',
  'feeds.reuters.com',
  'oilprice.com',
  'www.oilprice.com',
  'nation.africa',
  'businessdailyafrica.com',
  'www.standardmedia.co.ke',
  'the-star.co.ke',
]);

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authz = await requireProxyScope(req, corsHeaders);
    if ('response' in authz) return authz.response;

    const limit = await enforceDurableRateLimit(authz.context, corsHeaders, 'news-api-proxy', 40);
    if ('response' in limit) return limit.response;

    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid URL payload')
    }
    const apiKey = Deno.env.get('NEWS_API_KEY')

    if (!apiKey) {
      throw new Error('News API key not configured')
    }

    const targetUrl = new URL(url);
    if (targetUrl.protocol !== 'https:') {
      throw new Error('Only https URLs are allowed')
    }
    if (!ALLOWED_HOSTNAMES.has(targetUrl.hostname)) {
      throw new Error('Target host is not allowed')
    }
    if (targetUrl.hostname.includes('newsapi.org')) {
      targetUrl.searchParams.set('apiKey', apiKey);
    }

    const response = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      const text = await response.text();
      return new Response(JSON.stringify({ contents: text }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


  } catch (error: any) {
    console.error('Function error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
