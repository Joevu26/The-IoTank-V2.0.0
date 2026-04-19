// @ts-ignore Deno edge import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.40.0'
// @ts-ignore Deno edge import
import { SmtpClient } from 'https://deno.land/x/smtp@v0.7.0/mod.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { renderSecurityEmail } from '../_shared/SecurityEmailTemplate.ts'

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
  if (!authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return false;

  const cronSecret = Deno.env.get('SECURITY_ALERTS_CRON_SECRET');
  if (cronSecret && token === cronSecret) return true;

  if (token.split('.').length !== 3) return false;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return false;

  const { data: systemUser } = await supabaseAdmin
    .from('system_users')
    .select('role, is_active')
    .or(`auth_user_id.eq.${user.id},email.eq.${user.email || ''}`)
    .maybeSingle();

  return !!(systemUser?.is_active && ['super_admin', 'admin_helper'].includes(systemUser.role));
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SUPABASE_URL = 'https://suifvborodwergtrbjez.supabase.co';
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  // SMTP Secrets from your Supabase Dashboard
  const SMTP_HOSTNAME = Deno.env.get('SMTP_HOSTNAME') || 'smtp.gmail.com';
  const SMTP_PORT = Number(Deno.env.get('SMTP_PORT')) || 465;
  const SMTP_USERNAME = Deno.env.get('SMTP_USERNAME') || 'iotank.com@gmail.com';
  const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD'); 
  const SEND_FROM_EMAIL = Deno.env.get('SEND_FROM_EMAIL') || SMTP_USERNAME;

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
      await smtpClient.connect({
        hostname: SMTP_HOSTNAME,
        port: SMTP_PORT,
        username: SMTP_USERNAME,
        password: SMTP_PASSWORD,
      });
    };

    // ── CASE 1: DIRECT SMTP DISPATCH (Secure Server-Side Render) ───
    if (body.action === 'direct_security_alert' && body.to && body.params) {
      await connectSMTP();
      const generatedHtml = renderSecurityEmail(body.params);
      await smtpClient.send({
        from: SEND_FROM_EMAIL,
        to: body.to,
        subject: `🚨 IOTANK SECURITY: ${body.params.type} at ${body.params.siteName}`,
        content: generatedHtml, // fallback text-like content
        html: generatedHtml,
      });
      await smtpClient.close();

      return new Response(JSON.stringify({ success: true, method: 'direct_smtp_secure' }), {
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
