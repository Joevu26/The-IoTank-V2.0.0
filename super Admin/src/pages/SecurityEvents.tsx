import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import { FiAlertTriangle, FiActivity, FiRefreshCw, FiSearch, FiShield, FiInfo } from 'react-icons/fi';
import { SecurityTelemetryEvent, securityTelemetryService } from '../services/securityTelemetryService';
import { supabase } from '../config/supabase';
import './SecurityEvents.css';

type SeverityFilter = 'all' | 'info' | 'warning' | 'critical';

const SecurityEvents = () => {
  const [events, setEvents] = useState<SecurityTelemetryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [eventTypeOptions, setEventTypeOptions] = useState<string[]>([]);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<string>('');
  const [filters, setFilters] = useState({
    severity: 'all' as SeverityFilter,
    eventType: 'all',
    statusCode: 'all',
    search: '',
  });

  const fetchEvents = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const [rows, types] = await Promise.all([
        securityTelemetryService.getSecurityEvents(filters),
        securityTelemetryService.getEventTypeOptions(),
      ]);
      setEvents(rows);
      setEventTypeOptions(types);
    } catch (err) {
      console.error('Failed to load security telemetry events:', err);
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEvents(true);
  }, [filters.severity, filters.eventType, filters.statusCode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEvents(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const stats = useMemo(() => {
    const last24h = Date.now() - (24 * 60 * 60 * 1000);
    const in24h = events.filter((e) => new Date(e.created_at).getTime() >= last24h);
    return {
      total: events.length,
      critical24h: in24h.filter((e) => e.severity === 'critical').length,
      rateLimited24h: in24h.filter((e) => e.event_type === 'proxy_rate_limit_exceeded').length,
      provisioningAnomalies24h: in24h.filter((e) => e.event_type === 'provisioning_anomaly').length,
      pendingCriticalDispatch: events.filter((e) => e.severity === 'critical' && ['pending', 'failed', 'processing'].includes(e.alert_status)).length,
    };
  }, [events]);

  const severityClass = (severity: string) => {
    if (severity === 'critical') return 'sev-critical';
    if (severity === 'warning') return 'sev-warning';
    return 'sev-info';
  };

  return (
    <Layout>
      <div className="security-events-container">
        <header className="security-events-header">
          <div>
            <h1><FiShield /> Security Events</h1>
            <p>Live telemetry for auth denials, proxy abuse patterns, rate limiting, and provisioning anomalies.</p>
          </div>
          <button
            className="refresh-btn"
            onClick={() => {
              setRefreshing(true);
              fetchEvents(false);
            }}
            disabled={refreshing}
          >
            <FiRefreshCw className={refreshing ? 'spin' : ''} /> Refresh
          </button>
          <button
            className="refresh-btn"
            disabled={dispatching}
            onClick={async () => {
              setDispatching(true);
              setDispatchResult('');
              try {
                const token = (await supabase.auth.getSession()).data.session?.access_token;
                if (!token) throw new Error('No active admin session');
                const { data, error } = await supabase.functions.invoke('dispatch-critical-alerts', {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}` },
                  body: { limit: 20 },
                });
                if (error) throw error;
                setDispatchResult(`Dispatch complete: sent ${data?.sent || 0}, failed ${data?.failed || 0}, claimed ${data?.claimed || 0}.`);
                fetchEvents(false);
              } catch (err: any) {
                setDispatchResult(`Dispatch failed: ${err.message || 'unknown error'}`);
              } finally {
                setDispatching(false);
              }
            }}
          >
            <FiActivity className={dispatching ? 'spin' : ''} /> Dispatch Critical Alerts
          </button>
        </header>
        {dispatchResult && <div className="empty-state">{dispatchResult}</div>}

        <section className="security-stats-grid">
          <div className="stat-card"><span>Total Visible</span><strong>{stats.total}</strong></div>
          <div className="stat-card"><span>Critical (24h)</span><strong>{stats.critical24h}</strong></div>
          <div className="stat-card"><span>Rate-Limit Hits (24h)</span><strong>{stats.rateLimited24h}</strong></div>
          <div className="stat-card"><span>Provisioning Anomalies (24h)</span><strong>{stats.provisioningAnomalies24h}</strong></div>
          <div className="stat-card"><span>Pending/Faulted Alert Dispatch</span><strong>{stats.pendingCriticalDispatch}</strong></div>
        </section>

        <section className="security-filters">
          <label>
            Severity
            <select value={filters.severity} onChange={(e) => setFilters((p) => ({ ...p, severity: e.target.value as SeverityFilter }))}>
              <option value="all">All</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </label>

          <label>
            Event Type
            <select value={filters.eventType} onChange={(e) => setFilters((p) => ({ ...p, eventType: e.target.value }))}>
              <option value="all">All</option>
              {eventTypeOptions.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>

          <label>
            Status Code
            <select value={filters.statusCode} onChange={(e) => setFilters((p) => ({ ...p, statusCode: e.target.value }))}>
              <option value="all">All</option>
              <option value="4xx">4xx</option>
              <option value="5xx">5xx</option>
              <option value="401">401</option>
              <option value="403">403</option>
              <option value="429">429</option>
              <option value="500">500</option>
            </select>
          </label>

          <label className="search-wrap">
            Search
            <div className="search-input-wrap">
              <FiSearch />
              <input
                value={filters.search}
                onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                placeholder="reason, actor email, endpoint, scope..."
              />
            </div>
          </label>
        </section>

        <section className="security-events-list">
          {loading ? (
            <div className="empty-state"><FiActivity className="spin" /> Loading security telemetry...</div>
          ) : events.length === 0 ? (
            <div className="empty-state"><FiInfo /> No matching security events.</div>
          ) : (
            events.map((event) => (
              <article key={event.id} className="event-card">
                <div className="event-top">
                  <span className={`severity-pill ${severityClass(event.severity)}`}>{event.severity}</span>
                  <span className="event-type">{event.event_type}</span>
                  <span className="event-time">{new Date(event.created_at).toLocaleString()}</span>
                </div>
                <div className="event-main">
                  <p><strong>Reason:</strong> {event.reason || 'n/a'}</p>
                  <p><strong>Source:</strong> {event.source}{event.endpoint ? ` | ${event.endpoint}` : ''}</p>
                  <p>
                    <strong>Actor:</strong> {event.actor_email || event.actor_uid || 'unknown'}
                    {event.actor_role ? ` (${event.actor_role})` : ''}
                    {event.actor_auth_level ? ` L${event.actor_auth_level}` : ''}
                  </p>
                  <p>
                    <strong>Status:</strong> {event.status_code || 'n/a'}
                    {event.station_id ? ` | station ${event.station_id}` : ''}
                    {event.scope_key ? ` | ${event.scope_key}` : ''}
                  </p>
                  <p>
                    <strong>Alert Delivery:</strong> {event.alert_status}
                    {typeof event.alert_attempts === 'number' ? ` | attempts ${event.alert_attempts}` : ''}
                    {event.alerted_at ? ` | sent ${new Date(event.alerted_at).toLocaleString()}` : ''}
                  </p>
                  {event.last_alert_error && (
                    <p><strong>Last Alert Error:</strong> {event.last_alert_error}</p>
                  )}
                </div>
                {event.details && Object.keys(event.details).length > 0 && (
                  <details className="event-details">
                    <summary><FiAlertTriangle /> Event details</summary>
                    <pre>{JSON.stringify(event.details, null, 2)}</pre>
                  </details>
                )}
              </article>
            ))
          )}
        </section>
      </div>
    </Layout>
  );
};

export default SecurityEvents;
