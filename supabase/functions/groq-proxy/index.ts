// supabase/functions/groq-proxy/index.ts

import { getCorsHeaders } from '../_shared/cors.ts'
import { enforceDurableRateLimit, getOptionalProxyScope } from '../_shared/auth.ts'
import { CHAT_PROJECT_CONTEXT, buildIntelligencePrompt } from '../_shared/prompts.ts'
declare const Deno: any;

const MAX_PER_WINDOW = 20;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authz = await getOptionalProxyScope(req, corsHeaders);
    if ('response' in authz) return authz.response;
    
    const maxRequests = authz.context.user.id === 'anonymous' ? 5 : MAX_PER_WINDOW;
    const limit = await enforceDurableRateLimit(authz.context, corsHeaders, 'groq-proxy', maxRequests);
    if ('response' in limit) return limit.response;

    const payload = await req.json()
    const { action, context } = payload;
    let body = payload.body || {};

    if (action === 'chat') {
       body.messages = [
          { role: 'system', content: CHAT_PROJECT_CONTEXT },
          ...(body.messages || [])
       ];
    } else if (action === 'intelligence') {
       const systemPrompt = buildIntelligencePrompt(context?.signals || [], context?.risks || [], context?.notices || []);
       body.messages = [{ role: 'user', content: systemPrompt }];
    } else {
       throw new Error('Valid action (chat or intelligence) is required');
    }
    const payloadString = JSON.stringify(body);
    if (payloadString.length > 102400) { // 100KB limit
      throw new Error('Payload size exceeds 100KB safety limit');
    }

    const groqApiKey = Deno.env.get('GROQ_API_KEY')

    if (!groqApiKey) {
      throw new Error('Groq API key not configured')
    }

    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      }
    )

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
