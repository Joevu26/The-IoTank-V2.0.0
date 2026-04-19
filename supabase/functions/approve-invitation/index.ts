// @ts-ignore Deno edge import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.40.0'
import { getCorsHeaders } from '../_shared/cors.ts'
import { emitSecurityTelemetry } from '../_shared/telemetry.ts'
import { requireProxyScope, enforceDurableRateLimit } from '../_shared/auth.ts'
declare const Deno: any;

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authz = await requireProxyScope(req, corsHeaders);
    if ('response' in authz) return authz.response;
    const { user, supabaseAdmin, authLevel } = authz.context;

    // Must be super_admin (1) or admin_helper (2)
    if (authLevel > 2) {
      await emitSecurityTelemetry(supabaseAdmin, {
        eventType: 'provisioning_denied',
        severity: 'warning',
        source: 'approve-invitation',
        endpoint: new URL(req.url).pathname,
        actorUid: user.id,
        actorEmail: user.email || null,
        actorAuthLevel: authLevel,
        statusCode: 403,
        reason: 'insufficient_admin_role',
      })
      return new Response(JSON.stringify({ error: 'Permission denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const limit = await enforceDurableRateLimit(authz.context, corsHeaders, 'approve-invitation', 10, 60);
    if ('response' in limit) return limit.response;

    const body = await req.json()
    const invitationId = body?.invitationId
    if (!invitationId || typeof invitationId !== 'string') {
      throw new Error('invitationId is required')
    }

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('pending_registrations')
      .select('*')
      .eq('id', invitationId)
      .eq('status', 'pending')
      .single()
    if (inviteError || !invite) throw new Error('Pending registration not found or already processed')

    const role = 'operator' // pending_registrations is treated as station owner / operator request
    const tempPassword = crypto.randomUUID().replace(/-/g, '')

    const { data: newAuthUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: invite.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: invite.full_name,
        source: 'pending_registration_approval',
        role,
        station_id: invite.approved_station_id || null
      }
    })
    if (createAuthError) throw new Error(`Auth account creation failed: ${createAuthError.message}`)
    const newUserId = newAuthUser.user.id

    try {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert([{
          auth_user_id: newUserId,
          email: invite.email,
          display_name: invite.full_name,
          role,
          station_id: invite.approved_station_id || null,
          site_ids: []
        }])
      if (profileError) throw new Error(`Profile provisioning failed: ${profileError.message}`)

      const { error: inviteUpdateError } = await supabaseAdmin
        .from('pending_registrations')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_auth_user_id: newUserId,
          approved_station_id: invite.approved_station_id || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', invitationId)
      if (inviteUpdateError) throw new Error(`Registration status update failed: ${inviteUpdateError.message}`)

      let recoveryLink: string | null = null
      try {
        const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: invite.email
        })
        recoveryLink = linkData?.properties?.action_link || null
      } catch (_e) {
        recoveryLink = null
      }

      await supabaseAdmin.from('admin_logs').insert([{
        system_user_id: user.id,
        auth_user_id: user.id,
        action_type: 'registration_approved',
        affected_station_id: invite.approved_station_id || null,
        description: `Approved registration for ${invite.full_name} (${invite.email})`,
        changes_made: { registration_id: invitationId, role, worker_uid: newUserId }
      }])

      return new Response(JSON.stringify({
        success: true,
        userId: newUserId,
        recoveryLink
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } catch (provisionError: any) {
      await emitSecurityTelemetry(supabaseAdmin, {
        eventType: 'provisioning_anomaly',
        severity: 'critical',
        source: 'approve-invitation',
        endpoint: new URL(req.url).pathname,
        actorUid: user.id,
        actorEmail: user.email || null,
        actorAuthLevel: authLevel,
        stationId: invite.station_id || null,
        statusCode: 400,
        reason: 'provisioning_chain_failed',
        details: {
          invitationId,
          error: provisionError?.message || String(provisionError),
        },
      })
      await supabaseAdmin.auth.admin.deleteUser(newUserId)
      throw provisionError
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
