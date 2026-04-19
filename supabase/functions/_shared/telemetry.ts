import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.40.0'

type SupabaseAdminClient = ReturnType<typeof createClient>;

type SecurityTelemetryInput = {
  eventType: string;
  severity?: 'info' | 'warning' | 'critical';
  source?: string;
  endpoint?: string | null;
  actorUid?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  actorAuthLevel?: number | null;
  stationId?: string | null;
  scopeKey?: string | null;
  statusCode?: number | null;
  reason?: string | null;
  details?: Record<string, unknown>;
};

export async function emitSecurityTelemetry(
  supabaseAdmin: SupabaseAdminClient,
  payload: SecurityTelemetryInput
) {
  try {
    await supabaseAdmin.rpc('log_security_telemetry_event', {
      p_event_type: payload.eventType,
      p_severity: payload.severity || 'info',
      p_source: payload.source || 'edge_function',
      p_endpoint: payload.endpoint || null,
      p_actor_uid: payload.actorUid || null,
      p_actor_email: payload.actorEmail || null,
      p_actor_role: payload.actorRole || null,
      p_actor_auth_level: payload.actorAuthLevel ?? null,
      p_station_id: payload.stationId || null,
      p_scope_key: payload.scopeKey || null,
      p_status_code: payload.statusCode ?? null,
      p_reason: payload.reason || null,
      p_details: payload.details || {},
    });
  } catch (_err) {
    // Telemetry must never break critical auth/provisioning paths.
  }
}
