// supabase/functions/verify-recaptcha/index.ts

import { getCorsHeaders } from '../_shared/cors.ts'
declare const Deno: any;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { token } = await req.json()
    if (!token || typeof token !== 'string' || token.length < 20 || token.length > 5000) {
      throw new Error('Invalid reCAPTCHA token payload')
    }
    const secretKey = Deno.env.get('RECAPTCHA_SECRET_KEY')

    if (!secretKey) {
      throw new Error('reCAPTCHA secret key not configured')
    }

    const response = await fetch(
      'https://www.google.com/recaptcha/api/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `secret=${secretKey}&response=${token}`
      }
    )

    const data = await response.json()

    return new Response(
      JSON.stringify({ 
        success: data.success,
        score: data.score,
        action: data.action
      }),
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
