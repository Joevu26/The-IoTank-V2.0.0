// @ts-ignore Deno edge import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

declare const Deno: any;

Deno.serve(async (req) => {
  const { method, url } = req;
  const urlPath = new URL(url).pathname;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // DIAGNOSTIC PING
  if (urlPath.endsWith('/ping')) {
    return new Response(JSON.stringify({ 
        success: true, 
        message: 'Provisioning Hub Online',
        timestamp: new Date().toISOString()
    }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
    })
  }

  const errorResponse = (message: string, statusCode: number = 400, detail?: any) => {
    const errorBody = { success: false, error: message, detail, timestamp: new Date().toISOString() };
    console.error(`[PROVISIONING_ERROR] ${message}`, JSON.stringify(detail));
    return new Response(JSON.stringify(errorBody), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: statusCode, 
    });
  };

  try {
    console.log(`[PROVISIONING_START] Request received at ${new Date().toISOString()}`);
    const authHeader = req.headers.get('Authorization')!;
    if (!authHeader) return errorResponse('Auth header missing', 401);

    const supabaseUrl = 'https://suifvborodwergtrbjez.supabase.co';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
        return errorResponse('Internal Config Error: Supabase credentials missing.', 500);
    }

    // Initialize with explicit URL to ensure JWT matching
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, { 
        auth: { persistSession: false } 
    });

    const token = authHeader.replace('Bearer ', '').trim();
    const { data: { user: adminUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !adminUser) {
        console.error(`[PROVISIONING_AUTH_FAIL]`, {
            error: authError?.message,
            tokenPrefix: token.substring(0, 15) + '...',
            envUrl: supabaseUrl
        });
        return errorResponse(`Unauthorized: ${authError?.message || 'Invalid Session'}`, 401, {
            hint: "Check if your frontend VITE_SUPABASE_URL matches the project secret SUPABASE_URL."
        });
    }

    const body = await req.json().catch(() => ({}));
    const { registrationId } = body;
    if (!registrationId) return errorResponse('registrationId required', 400);

    console.log(`[PROVISIONING_FETCH] Registration ID: ${registrationId}`);

    // FETCH REGISTRATION
    const { data: reg, error: regError } = await supabaseAdmin
      .from('pending_registrations')
      .select('*')
      .eq('id', registrationId)
      .maybeSingle();

    if (regError) return errorResponse(`Database fetch failed: ${regError.message}`, 500);
    if (!reg) return errorResponse('Registration record not found.', 404);

    // STEP 1: IDENTITY (Atomic Auth Invitation)
    console.log(`[PROVISIONING_IDENTITY] Checking email: ${reg.email}`);
    const { data: existingUserId, error: lookupError } = await supabaseAdmin.rpc('get_auth_user_id_by_email', { p_email: reg.email });
    
    if (lookupError) {
        console.warn(`[PROVISIONING_LOOKUP_WARN] Auth lookup failed, proceeding with invitation.`, lookupError);
    }

    let targetUserId = existingUserId;

    if (!targetUserId) {
        console.log(`[PROVISIONING_INVITE] Calling auth.admin.inviteUserByEmail for: ${reg.email}`);
        const { data: invitation, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
            reg.email,
            { redirectTo: 'https://the-iotank-project.web.app/reset-password' }
        );
        
        if (inviteError) {
            console.error(`[PROVISIONING_INVITE_FAIL]`, inviteError);
            return errorResponse(`Identity creation failed: ${inviteError.message}`, 500);
        }
        targetUserId = invitation.user.id;
        console.log(`[PROVISIONING_INVITE_SUCCESS] User ID: ${targetUserId}`);
    } else {
        console.log(`[PROVISIONING_IDENTITY_EXIST] Found existing user: ${targetUserId}`);
    }

    // STEP 2: ATOMIC PROVISIONING
    console.log(`[PROVISIONING_RPC_START] Calling provision_registration_v2 for UID: ${targetUserId}`);
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('provision_registration_v2', {
        p_registration_id: registrationId,
        p_auth_user_id: targetUserId
    });

    if (rpcError) {
        console.error(`[PROVISIONING_RPC_ERROR]`, rpcError);
        return errorResponse(`Database RPC Error: ${rpcError.message} (${rpcError.code})`, 500, rpcError);
    }

    if (!rpcResult || rpcResult.success === false) {
        console.error(`[PROVISIONING_RPC_FAIL]`, rpcResult);
        return errorResponse(`Provisioning logic reported failure: ${rpcResult?.error || 'Unknown Error'}`, 500, rpcResult);
    }

    console.log(`[PROVISIONING_COMPLETE] Successfully provisioned: ${registrationId}`);

    return new Response(JSON.stringify({ 
        success: true, 
        message: 'Client provisioned and linked successfully.',
        data: rpcResult,
        timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error(`[PROVISIONING_FATAL]`, error);
    return errorResponse(`Server Fatal Error: ${error.message}`, 500);
  }
})
