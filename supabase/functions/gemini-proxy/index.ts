// supabase/functions/gemini-proxy/index.ts

import { getCorsHeaders } from '../_shared/cors.ts'
import { enforceDurableRateLimit, getOptionalProxyScope } from '../_shared/auth.ts'
import { CHAT_PROJECT_CONTEXT, buildIntelligencePrompt } from '../_shared/prompts.ts'
declare const Deno: any;

const allowedEndpoints = new Set([
  'models/gemini-1.5-flash:generateContent',
  'models/gemini-1.5-flash-latest:generateContent',
  'models/gemini-1.5-pro:generateContent',
]);
const MAX_PER_WINDOW = 20;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'))
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authz = await getOptionalProxyScope(req, corsHeaders);
    if ('response' in authz) return authz.response;

    const maxRequests = authz.context.user.id === 'anonymous' ? 5 : MAX_PER_WINDOW;
    const limit = await enforceDurableRateLimit(authz.context, corsHeaders, 'gemini-proxy', maxRequests);
    if ('response' in limit) return limit.response;

    const payload = await req.json()
    const { action, endpoint, context } = payload;
    let body = payload.body || {};
    
    if (action === 'chat') {
        const openaiMessages = body.messages || [];
        const geminiTools = body.tools ? [{
           function_declarations: body.tools.map((t: any) => ({
              name: t.function.name,
              description: t.function.description,
              parameters: t.function.parameters
           }))
        }] : undefined;

        // Convert OpenAI messages to Gemini contents
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
       const systemPrompt = buildIntelligencePrompt(context?.signals || [], context?.risks || [], context?.notices || []);
       body.contents = [{ parts: [{ text: systemPrompt }] }];
    } else {
       throw new Error('Valid action (chat or intelligence) is required');
    }

    const payloadString = JSON.stringify(body);
    if (payloadString.length > 102400) { // 100KB limit
      throw new Error('Payload size exceeds 100KB safety limit');
    }


    // Get Gemini API key from environment
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured')
    }

    // Call Gemini API - Using v1 as it is more stable for production
    // Default endpoint if not provided
    const targetEndpoint = endpoint || 'models/gemini-1.5-flash:generateContent';
    if (!allowedEndpoints.has(targetEndpoint)) {
      throw new Error('Endpoint is not allowed');
    }
    const url = `https://generativelanguage.googleapis.com/v1/${targetEndpoint}?key=${geminiApiKey}`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Gemini API error: ${error}`)
    }

    const data = await response.json()
    
    return new Response(
      JSON.stringify(data),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error: any) {
    console.error('Function error:', error.message);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        }
      }
    )
  }
})
