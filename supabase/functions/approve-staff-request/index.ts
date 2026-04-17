// @ts-ignore Deno edge import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
declare const Deno: any;

Deno.serve(async (req) => {
  const { method, url } = req;
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const errorResponse = (message: string, status = 400, extra?: Record<string, any>) => {
    console.error(`[approve-staff-request] FAIL ${status}:`, message, extra || '');
    return new Response(JSON.stringify({ error: message, ...extra }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    });
  };

  try {
    const auth = await requireAuthenticatedUser(req, corsHeaders);
    if ('response' in auth) return (auth as any).response;
    const { user, supabaseAdmin } = auth as any;

    // 1. Verify caller permissions
    const { data: systemUser, error: sysErr } = await supabaseAdmin
      .from('system_users')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (sysErr || !['super_admin', 'admin_helper'].includes(systemUser?.role)) {
      return errorResponse('Permission denied: High-level system profile required.', 403);
    }

    const { requestId } = await req.json();
    if (!requestId) return errorResponse('requestId is required');

    // 2. Fetch Request
    const { data: request, error: requestError } = await supabaseAdmin
      .from('team_member_requests')
      .select('*')
      .eq('id', requestId)
      .eq('status', 'pending')
      .single();

    if (requestError || !request) return errorResponse('Request not found or already processed', 404);

    // 3. Resolve Identity (Idempotent)
    let finalAuthUserId: string;
    const { data: { users: matchedUsers } } = await supabaseAdmin.auth.admin.listUsers();
    const existingEntry = (matchedUsers || []).find(u => u.email?.toLowerCase() === request.email.toLowerCase());

    if (existingEntry) {
      finalAuthUserId = existingEntry.id;
      console.log(`[approve-staff-request] Reusing existing user: ${finalAuthUserId}`);
    } else {
      console.log(`[approve-staff-request] Inviting new staff member: ${request.email}`);
      const { data: invitation, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        request.email,
        {
          redirectTo: 'https://the-iotank-project.web.app/reset-password',
          data: { full_name: request.full_name, station_id: request.station_id }
        }
      );

      if (inviteError) {
          if (inviteError.message.includes('already')) {
               return errorResponse('Identity Conflict: User already exists but not visible.', 409);
          }
          throw inviteError;
      }
      finalAuthUserId = invitation.user.id;
    }

    // 4. Provision Profile (UPSERT)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        auth_user_id: finalAuthUserId,
        station_id: request.station_id,
        email: request.email.toLowerCase(),
        display_name: request.full_name,
        role: request.role,
        site_ids: []
      }, { onConflict: 'auth_user_id' });

    if (profileError) {
      if (profileError.message.includes('Role escalation')) {
        console.warn('[approve-staff-request] Profile upsert triggered role escalation protection. Retrying without role change.');
        const { error: retryError } = await supabaseAdmin
          .from('profiles')
          .update({
            station_id: request.station_id,
            display_name: request.full_name
          })
          .eq('auth_user_id', finalAuthUserId);
        if (retryError) throw retryError;
      } else {
        throw profileError;
      }
    }

    // 5. Finalize
    await supabaseAdmin
      .from('team_member_requests')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', requestId);

    await supabaseAdmin.from('admin_logs').insert([{
      system_user_id: systemUser.id,
      auth_user_id: user.id,
      action_type: 'team_member_approved',
      affected_station_id: request.station_id,
      description: `Approved worker ${request.full_name} (${request.role}) for ${request.station_name}`
    }]);

    return new Response(JSON.stringify({ success: true, message: 'Member provisioned' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err: any) {
    console.error('[approve-staff-request] FATAL:', err.message);
    return errorResponse(err.message || 'Internal Failure', 500);
  }
})
