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
    console.error(`[invite-system-staff] FAIL ${status}:`, message, extra || '');
    return new Response(JSON.stringify({ error: message, ...extra }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    });
  };

  try {
    const auth = await requireAuthenticatedUser(req, corsHeaders);
    if ('response' in auth) return (auth as any).response;
    const { user, supabaseAdmin } = auth as any;

    // 1. Verify caller is a Super Admin
    const { data: currentSystemUser, error: currentError } = await supabaseAdmin
      .from('system_users')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (currentError || currentSystemUser?.role !== 'super_admin') {
      return errorResponse('Unauthorized: Only Super Admins can invite new staff members.', 403);
    }

    const { email, full_name, role, portal_link } = await req.json();
    if (!email || !full_name || !role) return errorResponse('email, full_name, and role are required.');

    const validRoles = ['super_admin', 'admin_helper', 'support_staff', 'analyst'];
    if (!validRoles.includes(role)) return errorResponse('Invalid role specified.');

    // 2. Resolve Auth Identity (Idempotent)
    let targetSupabaseUid: string;
    const { data: { users: matchedUsers } } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = (matchedUsers || []).find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (existingAuthUser) {
      targetSupabaseUid = existingAuthUser.id;
      console.log(`[invite-system-staff] Reusing existing auth user: ${targetSupabaseUid}`);
    } else {
      console.log(`[invite-system-staff] Inviting: ${email}`);
      const { data: invitation, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: portal_link || 'https://the-iotank-project.web.app/reset-password',
        data: { full_name, role: 'system_admin', admin_role: role, portal: 'super_admin' }
      });

      if (inviteError) {
          if (inviteError.message.includes('already')) {
               return errorResponse('Identity Conflict: User already exists but not visible in current list.', 409);
          }
          throw inviteError;
      }
      targetSupabaseUid = invitation.user.id;
    }

    // 3. Provision System User (UPSERT)
    const { data: upsertData, error: upsertError } = await supabaseAdmin
      .from('system_users')
      .upsert({
        email: email.toLowerCase(),
        full_name: full_name,
        role: role,
        auth_user_id: targetSupabaseUid,
        is_active: true,
        created_by: currentSystemUser.id,
      }, { onConflict: 'email' })
      .select()
      .single();

    if (upsertError) throw upsertError;

    // 4. Log Action
    await supabaseAdmin.from('admin_logs').insert([{
      system_user_id: currentSystemUser.id,
      auth_user_id: user.id,
      action_type: 'system_settings_changed',
      description: `Invited/Updated console staff: ${full_name} as ${role}`
    }]);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Staff invitation processed successfully',
      user: upsertData 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err: any) {
    console.error('[invite-system-staff] FATAL:', err.message);
    return errorResponse(err.message || 'Internal Failure', 500);
  }
})
