// supabase/functions/issue-device-token/index.ts
// @ts-ignore Deno edge import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { create as createJwt } from "https://deno.land/x/djwt@v3.0.1/mod.ts";

declare const Deno: any;

Deno.serve(async (req) => {
  const { method } = req;
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS
  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Diagnostic Endpoint
  if (new URL(req.url).pathname.endsWith('/ping')) {
    return new Response(JSON.stringify({ status: 'ok' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
    })
  }

  try {
    // 1. Authenticate the User calling this (Station Admin)
    const auth = await requireAuthenticatedUser(req, corsHeaders);
    if ('response' in auth) return (auth as any).response;
    const { user, supabaseAdmin } = auth as any;

    const { tankId, stationId } = await req.json();

    if (!tankId || !stationId) {
      return new Response(JSON.stringify({ 
        error: 'Missing parameters', 
        details: 'stationId is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Verify Station Access
    // If tankId is provided, we verify it belongs to the station as a sanity check.
    if (tankId) {
      const { data: tank, error: tankError } = await supabaseAdmin
        .from('tanks')
        .select('id, station_id')
        .eq('id', tankId)
        .eq('station_id', stationId)
        .single();
  
      if (tankError || !tank) {
        return new Response(JSON.stringify({ 
          error: 'Access Denied', 
          details: 'Tank not found or does not belong to the specified station' 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Secondary check: Does the user belong to this station?
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('station_id, role')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (!profile || (profile.station_id !== stationId && profile.role !== 'owner' && profile.role !== 'admin')) {
        // Allow super admins if needed (but usually they should have a station context)
        // Check system_users for super_admin
        const { data: systemUser } = await supabaseAdmin
            .from('system_users')
            .select('role')
            .eq('auth_user_id', user.id)
            .maybeSingle();
            
        if (!systemUser || systemUser.role !== 'super_admin') {
            return new Response(JSON.stringify({ 
                error: 'Unauthorized', 
                details: 'You do not have permission to issue tokens for this station' 
            }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
    }

    // 3. Generate Hardware JWT
    const jwtSecret = Deno.env.get('JWT_SECRET');
    if (!jwtSecret) {
        throw new Error('JWT_SECRET environment variable is missing');
    }

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(jwtSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    // Payload designed for RLS consumption
    const payload = {
      role: 'device', // Identity for RLS policies
      station_id: stationId,
      iat: Math.floor(Date.now() / 1000),
      // Long-lived (10 years) because hardware updates are costly/rare
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 365 * 10), 
      iss: 'lotank-bridge-v2',
      aud: 'authenticated'
    };

    const token = await createJwt({ alg: "HS256", typ: "JWT" }, payload, key);

    console.log(`[issue-device-token] TOKEN_ISSUED for Tank ${tankId} | Station ${stationId}`);

    return new Response(JSON.stringify({ 
      success: true,
      token,
      expires_at: payload.exp,
      claims: {
          role: payload.role,
          station_id: payload.station_id
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err: any) {
    console.error('[issue-device-token] CRITICAL ERROR:', err);
    return new Response(JSON.stringify({ 
        error: 'Token Generation Failed', 
        details: err.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
