// supabase/functions/groq-proxy/index.ts

import { getCorsHeaders } from '../_shared/cors.ts'
import { enforceDurableRateLimit, getOptionalProxyScope, requireProxyScope } from '../_shared/auth.ts'
import { CHAT_PROJECT_CONTEXT, buildIntelligencePrompt, sanitizeContextForAI } from '../_shared/prompts.ts'
declare const Deno: any;

// Chat (landing page): public allowed, tight anonymous quota
const CHAT_MAX_ANON    = 5;
const CHAT_MAX_AUTH    = 20;
// Intelligence (TankIQ): authenticated users only
const INTELLIGENCE_MAX = 15;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    const { action, context } = payload;
    let body = payload.body || {};

    // HIGH-002: Auth split — 'intelligence' (TankIQ) requires real account; 'chat' is public
    let authz: any;
    if (action === 'intelligence') {
      authz = await requireProxyScope(req, corsHeaders);
    } else {
      authz = await getOptionalProxyScope(req, corsHeaders);
    }
    if ('response' in authz) return authz.response;

    const isAnon = authz.context.user.id === 'anonymous';
    const maxRequests = action === 'intelligence'
      ? INTELLIGENCE_MAX
      : (isAnon ? CHAT_MAX_ANON : CHAT_MAX_AUTH);

    const limit = await enforceDurableRateLimit(authz.context, corsHeaders, `groq-${action}`, maxRequests);
    if ('response' in limit) return limit.response;

    if (action === 'chat') {
       body.messages = [
          { role: 'system', content: CHAT_PROJECT_CONTEXT },
          ...(body.messages || [])
       ];
    } else if (action === 'intelligence') {
       // MED-004: Sanitize context fields to strip adversarial prompt injection
       const safeSignals = (context?.signals || []).map((s: any) => sanitizeContextForAI(JSON.stringify(s)));
       const safeRisks   = (context?.risks   || []).map((r: any) => sanitizeContextForAI(JSON.stringify(r)));
       const safeNotices = (context?.notices || []).map((n: any) => sanitizeContextForAI(JSON.stringify(n)));
       const systemPrompt = buildIntelligencePrompt(safeSignals, safeRisks, safeNotices);
       body.messages = [{ role: 'user', content: systemPrompt }];
    } else {
       return new Response(JSON.stringify({ error: 'Valid action (chat or intelligence) is required' }), {
         status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
    }

    const payloadString = JSON.stringify(body);
    if (payloadString.length > 102400) {
      return new Response(JSON.stringify({ error: 'Payload size exceeds 100KB safety limit' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const groqApiKey = Deno.env.get('GROQ_API_KEY')
    if (!groqApiKey) throw new Error('Groq API key not configured')

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Groq proxy error:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
