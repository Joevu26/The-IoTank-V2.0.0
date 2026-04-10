import { supabase } from '../config/supabase';

export type SecurityEventSeverity = 'info' | 'warning' | 'critical';

export interface SecurityTelemetryEvent {
  id: string;
  event_type: string;
  severity: SecurityEventSeverity;
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
  alert_status: 'pending' | 'processing' | 'sent' | 'failed' | 'not_applicable';
  alert_attempts: number;
  last_alert_error: string | null;
  alerted_at: string | null;
  created_at: string;
}

type EventTypeRow = { event_type: string | null };

export interface SecurityTelemetryFilters {
  severity: 'all' | SecurityEventSeverity;
  eventType: string;
  statusCode: 'all' | '4xx' | '5xx' | string;
  search: string;
}

export const securityTelemetryService = {
  async getSecurityEvents(filters: SecurityTelemetryFilters, limit = 150) {
    let query = supabase
      .from('security_telemetry_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (filters.severity !== 'all') {
      query = query.eq('severity', filters.severity);
    }

    if (filters.eventType && filters.eventType !== 'all') {
      query = query.eq('event_type', filters.eventType);
    }

    if (filters.statusCode === '4xx') {
      query = query.gte('status_code', 400).lt('status_code', 500);
    } else if (filters.statusCode === '5xx') {
      query = query.gte('status_code', 500).lt('status_code', 600);
    } else if (filters.statusCode !== 'all' && filters.statusCode) {
      query = query.eq('status_code', Number(filters.statusCode));
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []) as SecurityTelemetryEvent[];
    const search = filters.search.trim().toLowerCase();
    if (!search) return rows;

    return rows.filter((row) => {
      const haystack = [
        row.event_type,
        row.source,
        row.endpoint || '',
        row.actor_email || '',
        row.actor_role || '',
        row.reason || '',
        row.scope_key || '',
        JSON.stringify(row.details || {}),
      ].join(' ').toLowerCase();
      return haystack.includes(search);
    });
  },

  async getEventTypeOptions() {
    const { data, error } = await supabase
      .from('security_telemetry_events')
      .select('event_type')
      .order('event_type', { ascending: true });
    if (error) throw error;
    const rows = (data || []) as EventTypeRow[];
    return Array.from(new Set(rows.map((r) => r.event_type).filter((v): v is string => !!v)));
  },
};
