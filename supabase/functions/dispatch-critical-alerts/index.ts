// @ts-ignore Deno edge import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.40.0'
// @ts-ignore Deno edge import
import { SmtpClient } from 'https://deno.land/x/smtp@v0.7.0/mod.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { renderSecurityEmail } from '../_shared/SecurityEmailTemplate.ts'
import { renderTransactionalEmail } from '../_shared/TransactionalEmailTemplate.ts'

declare const Deno: any;

type ClaimedEvent = {
  id: string;
  event_type: string;
  severity: string;
  source: string;
  endpoint: string | null;
  actor_uid: string | null;
  actor_email: string | null;
  actor_role: string | null;
  actor_auth_level: number | null;
  station_id: string | null;
  scope_key: string | null;
  status_code: number | null;
  reason: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  alert_attempts: number;
};

async function isAuthorized(req: Request, supabaseAdmin: any) {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    console.warn('[isAuthorized] Missing or invalid Authorization header');
    return false;
  }
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    console.warn('[isAuthorized] Empty token');
    return false;
  }

  const cronSecret = Deno.env.get('SECURITY_ALERTS_CRON_SECRET');
  if (cronSecret && token === cronSecret) return true;

  if (token.split('.').length !== 3) {
    console.warn('[isAuthorized] Token is not a JWT');
    return false;
  }
  
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    console.warn('[isAuthorized] Failed to get user from token:', error?.message);
    return false;
  }

  // 1. Check if System Admin
  const { data: systemUser } = await supabaseAdmin
    .from('system_users')
    .select('role, is_active')
    .or(`auth_user_id.eq.${user.id},email.eq.${user.email || ''}`)
    .maybeSingle();

  if (systemUser?.is_active && ['super_admin', 'admin_helper'].includes(systemUser.role)) {
      console.log('[isAuthorized] Authorized as System Admin:', systemUser.role);
      return true;
  }

  // 2. Check if Station Admin
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, station_id')
    .or(`auth_user_id.eq.${user.id},email.eq.${user.email || ''}`)
    .maybeSingle();

  if (profile && ['owner', 'admin'].includes(profile.role)) {
      console.log('[isAuthorized] Authorized as Station Admin:', profile.role);
      return true;
  }

  console.warn('[isAuthorized] Denied: User has no authorized role in system_users or profiles', user.email);
  return false;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  // SMTP Secrets from your Supabase Dashboard
  const SMTP_HOSTNAME = Deno.env.get('SMTP_HOSTNAME') || 'smtp.gmail.com';
  const SMTP_PORT = Number(Deno.env.get('SMTP_PORT')) || 465;
  const SMTP_USERNAME = Deno.env.get('SMTP_USERNAME') || 'iotank.com@gmail.com';
  const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD'); 
  const SEND_FROM_EMAIL = Deno.env.get('SEND_FROM_EMAIL') || SMTP_USERNAME;

  if (!SMTP_PASSWORD) {
    console.warn('[dispatch] SMTP_PASSWORD not configured. Emails will likely fail if authentication is required.');
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Missing Supabase URL/Key' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (!(await isAuthorized(req, supabaseAdmin))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const smtpClient = new SmtpClient();

    const connectSMTP = async () => {
      console.log(`[SMTP] Initiating connection to ${SMTP_HOSTNAME}:${SMTP_PORT}...`);
      
      const isSecure = SMTP_PORT === 465; 
      const isStartTLS = SMTP_PORT === 587; 
      
      try {
        await smtpClient.connect({
          hostname: SMTP_HOSTNAME,
          port: SMTP_PORT,
          username: SMTP_USERNAME,
          password: SMTP_PASSWORD,
          tls: isSecure || isStartTLS,
        });
        
        // [FORENSIC FIX]: Wait for server greeting to stabilize before first command
        // Gmail often errors with 'invalid cmd' if we are too fast.
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log(`[SMTP] Handshake stabilized. Connected to ${SMTP_HOSTNAME}`);
      } catch (connErr) {
        console.error(`[SMTP] Protocol Error at ${SMTP_HOSTNAME}:${SMTP_PORT}:`, connErr.message);
        throw connErr;
      }
    };

    // ── CASE 1: DIRECT SMTP DISPATCH (Secure Server-Side Render) ───
    if ((body.cmd === 'direct_security_alert' || body.action === 'direct_security_alert') && body.to && body.params) {
      await connectSMTP();
      const generatedHtml = renderSecurityEmail(body.params);
      const subjectPrefix = body.params.type === 'SHIFT_REPORT' ? '📊 IOTANK OPERATIONS' : '🚨 IOTANK SECURITY';
      await smtpClient.send({
        from: SEND_FROM_EMAIL,
        to: body.to,
        subject: `${subjectPrefix}: ${body.params.type.replace('_', ' ')} at ${body.params.siteName}`,
        content: generatedHtml, // fallback text-like content
        html: generatedHtml,
      });
      await smtpClient.close();

      return new Response(JSON.stringify({ success: true, method: 'direct_smtp_secure' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── CASE 1.5: DIRECT TRANSACTIONAL DISPATCH (Welcome/Invite) ──
    if ((body.cmd === 'direct_transactional_email' || body.action === 'direct_transactional_email') && body.to && body.params) {
      await connectSMTP();
      const generatedHtml = renderTransactionalEmail(body.params);
      await smtpClient.send({
        from: SEND_FROM_EMAIL,
        to: body.to,
        subject: body.params.type === 'INVITATION' ? `🛡️ Team Invitation: IoTank Fuel Intelligence` : `🚀 Welcome to IoTank: ${body.params.stationName}`,
        content: generatedHtml,
        html: generatedHtml,
      });
      await smtpClient.close();

      return new Response(JSON.stringify({ success: true, method: 'direct_transactional_secure' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── CASE 2: AUTOMATED QUEUE PROCESSING ───────────────────────────────────
    const requestedLimit = Number(body?.limit ?? 20);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(50, requestedLimit)) : 20;

    const { data, error } = await supabaseAdmin.rpc('claim_pending_critical_alert_events', { p_limit: limit });
    if (error) throw new Error(`Queue claim failed: ${error.message}`);

    const events = (data || []) as ClaimedEvent[];
    if (events.length === 0) {
      return new Response(JSON.stringify({ success: true, claimed: 0, sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await connectSMTP();

    let sentCount = 0;
    for (const event of events) {
      try {
        await smtpClient.send({
          from: SEND_FROM_EMAIL,
          to: event.actor_email || SEND_FROM_EMAIL, // Fallback to admin if no email found
          subject: `🚨 CRITICAL SECURITY: ${event.event_type} (${event.severity})`,
          content: `${event.message}\n\nReason: ${event.reason}\nSite: ${event.station_id}\n\nGenerated by IoTank Security AI`,
        });

        await supabaseAdmin.rpc('complete_critical_alert_event', {
          p_event_id: event.id,
          p_sent: true,
          p_error: null,
        });
        sentCount++;
      } catch (sendErr: any) {
        await supabaseAdmin.rpc('complete_critical_alert_event', {
          p_event_id: event.id,
          p_sent: false,
          p_error: `SMTP ERROR: ${sendErr?.message || 'unknown'}`,
        });
      }
    }

    await smtpClient.close();

    return new Response(JSON.stringify({
      success: true,
      claimed: events.length,
      sent: sentCount,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[dispatch] ERROR:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
