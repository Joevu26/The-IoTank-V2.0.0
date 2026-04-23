// supabase/functions/gemini-proxy/index.ts

import { getCorsHeaders } from '../_shared/cors.ts'
import { enforceDurableRateLimit, getOptionalProxyScope, requireProxyScope } from '../_shared/auth.ts'
import { CHAT_PROJECT_CONTEXT, buildIntelligencePrompt, sanitizeContextForAI } from '../_shared/prompts.ts'
declare const Deno: any;

const allowedEndpoints = new Set([
  'models/gemini-1.5-flash:generateContent',
  'models/gemini-1.5-flash-latest:generateContent',
  'models/gemini-1.5-pro:generateContent',
]);

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
    const { action, endpoint, context } = payload;
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

    const limit = await enforceDurableRateLimit(authz.context, corsHeaders, `gemini-${action}`, maxRequests);
    if ('response' in limit) return limit.response;

    if (action === 'chat') {
        const openaiMessages = body.messages || [];
        const geminiTools = body.tools ? [{
           functionDeclarations: body.tools.map((t: any) => ({
              name: t.function.name,
              description: t.function.description,
              parameters: t.function.parameters
           }))
        }] : undefined;

        const geminiContents = openaiMessages.map((m: any) => ({
           role: m.role === 'assistant' ? 'model' : 'user',
           parts: m.tool_calls ? [
              ...m.parts || [],
              ...m.tool_calls.map((tc: any) => ({
                 functionCall: {
                    name: tc.function.name,
                    args: JSON.parse(tc.function.arguments)
                 }
              }))
           ] : m.role === 'tool' ? [{
              functionResponse: {
                 name: m.name || m.tool_call_id,
                 response: { content: m.content }
              }
           }] : [{ text: m.content }]
        }));

        body = {
           contents: [
              { role: 'user', parts: [{ text: CHAT_PROJECT_CONTEXT }] },
              { role: 'model', parts: [{ text: "Understood. I am the IoTank Assistant. How can I help you today?" }] },
              ...geminiContents
           ],
           tools: geminiTools,
           generationConfig: body.generationConfig || { temperature: 0.7 }
        };
    } else if (action === 'intelligence') {
       // MED-004: Sanitize context fields to strip adversarial prompt injection
       const safeSignals = (context?.signals || []).map((s: any) => sanitizeContextForAI(JSON.stringify(s)));
       const safeRisks   = (context?.risks   || []).map((r: any) => sanitizeContextForAI(JSON.stringify(r)));
       const safeNotices = (context?.notices || []).map((n: any) => sanitizeContextForAI(JSON.stringify(n)));
       const systemPrompt = buildIntelligencePrompt(safeSignals, safeRisks, safeNotices);
       body.contents = [{ parts: [{ text: systemPrompt }] }];
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

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) throw new Error('Gemini API key not configured')

    const targetEndpoint = endpoint || 'models/gemini-1.5-flash:generateContent';
    if (!allowedEndpoints.has(targetEndpoint)) {
      return new Response(JSON.stringify({ error: 'Endpoint is not allowed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/${targetEndpoint}?key=${geminiApiKey}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Gemini API error: ${error}`)
    }

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Gemini proxy error:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
