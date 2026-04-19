import React, { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import { 
    FiAlertTriangle, FiActivity, FiRefreshCw, FiSearch, 
    FiShield, FiInfo, FiChevronDown, FiChevronUp, FiZap, 
    FiTarget, FiCpu, FiMessageSquare, FiExternalLink, FiDownload
} from 'react-icons/fi';
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
    const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
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
            setEvents(rows || []);
            setEventTypeOptions(types || []);
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
            <div className="security-events-container animate-fade-in">
                <header className="dp-header">
                    <div className="dp-title-group">
                        <h1 className="lowercase">security & telemetry events</h1>
                        <div className="dp-subtitle">Real-time Auth Denials & Proxy Abuse Detection</div>
                    </div>
                    
                    <div className="dp-header-actions">
                        <button 
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-600 hover:bg-slate-50 transition-all"
                            onClick={() => { setRefreshing(true); fetchEvents(false); }}
                            disabled={refreshing}
                        >
                            <FiRefreshCw className={refreshing ? 'spin' : ''} /> Synchronize Live
                        </button>
                        <button 
                            className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-black hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20"
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
                                    setDispatchResult(`Dispatch successful: ${data?.sent || 0} alerts transmitted.`);
                                    fetchEvents(false);
                                } catch (err: any) {
                                    setDispatchResult(`Dispatch failure: ${err.message}`);
                                } finally {
                                    setDispatching(false);
                                }
                            }}
                        >
                            <FiActivity className={dispatching ? 'spin' : ''} /> Dispatch Critical Alerts
                        </button>
                    </div>
                </header>

                {dispatchResult && (
                    <div className={`mb-8 p-4 rounded-2xl flex items-center gap-3 text-xs font-black uppercase tracking-widest ${dispatchResult.includes('failure') ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                        <FiInfo /> {dispatchResult}
                    </div>
                )}

                <section className="dp-stats-grid">
                    <div className="dp-premium-stat-card">
                        <div className="stat-content">
                            <label>Total events</label>
                            <h3>{stats.total}</h3>
                        </div>
                    </div>
                    <div className="dp-premium-stat-card critical">
                        <div className="stat-content">
                            <label className="text-rose-600">Critical (24h)</label>
                            <h3 className="text-rose-600 font-black">{stats.critical24h}</h3>
                        </div>
                    </div>
                    <div className="dp-premium-stat-card">
                        <div className="stat-content">
                            <label>Rate Limits (24h)</label>
                            <h3>{stats.rateLimited24h}</h3>
                        </div>
                    </div>
                    <div className="dp-premium-stat-card">
                        <div className="stat-content">
                            <label>Anomalies (24h)</label>
                            <h3>{stats.provisioningAnomalies24h}</h3>
                        </div>
                    </div>
                    <div className="dp-premium-stat-card">
                        <div className="stat-content">
                            <label>Pending Alerts</label>
                            <h3 className={stats.pendingCriticalDispatch > 0 ? 'text-amber-600' : ''}>{stats.pendingCriticalDispatch}</h3>
                        </div>
                    </div>
                </section>

                <section className="security-filters">
                    <div className="filter-group">
                        <label>Severity</label>
                        <select value={filters.severity} onChange={(e) => setFilters((p) => ({ ...p, severity: e.target.value as SeverityFilter }))}>
                            <option value="all">All levels</option>
                            <option value="info">Info</option>
                            <option value="warning">Warning</option>
                            <option value="critical">Critical</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label>Event Type</label>
                        <select value={filters.eventType} onChange={(e) => setFilters((p) => ({ ...p, eventType: e.target.value }))}>
                            <option value="all">Every pattern</option>
                            {eventTypeOptions.map((type) => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-group">
                        <label>Response Code</label>
                        <select value={filters.statusCode} onChange={(e) => setFilters((p) => ({ ...p, statusCode: e.target.value }))}>
                            <option value="all">All results</option>
                            <option value="4xx">4xx (Client)</option>
                            <option value="5xx">5xx (Server)</option>
                            <option value="401">401 (Unauthorized)</option>
                            <option value="429">429 (Rate Limit)</option>
                        </select>
                    </div>

                    <div className="filter-group" style={{ flex: 2 }}>
                        <label>Security Search</label>
                        <div className="search-input-wrap">
                            <FiSearch className="text-slate-400" />
                            <input
                                value={filters.search}
                                onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                                placeholder="Search reason, actor, endpoint..."
                            />
                        </div>
                    </div>
                </section>

                <section className="tdv-transaction-table-container">
                    <table className="tdv-transaction-table">
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>Severity</th>
                                <th>Event Type</th>
                                <th>Reason / Context</th>
                                <th>Actor Identity</th>
                                <th>Resource / Scope</th>
                                <th className="text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} className="p-20 text-center text-slate-400 font-black uppercase tracking-widest text-[10px]">Loading Security Streams...</td></tr>
                            ) : events.length === 0 ? (
                                <tr><td colSpan={7} className="p-20 text-center text-slate-400 font-bold">No security events detected matching filters.</td></tr>
                            ) : (
                                events.map((event) => {
                                    const isExpanded = expandedEvent === event.id;
                                    return (
                                        <React.Fragment key={event.id}>
                                            <tr 
                                                className={`cursor-pointer group ${isExpanded ? 'bg-rose-50/30' : ''}`}
                                                onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                                            >
                                                <td className="font-mono text-[10px] opacity-40">{new Date(event.created_at).toLocaleString()}</td>
                                                <td><span className={`severity-pill ${severityClass(event.severity)}`}>{event.severity}</span></td>
                                                <td><div className="font-bold text-xs truncate max-w-[150px]">{event.event_type}</div></td>
                                                <td>
                                                    <div className="font-bold text-xs">{event.reason || 'No description provided'}</div>
                                                    <div className="text-[10px] opacity-40 uppercase font-black">{event.endpoint}</div>
                                                </td>
                                                <td>
                                                    <div className="font-black text-[10px] text-slate-700 truncate max-w-[180px]">{event.actor_email || event.actor_uid || 'UNKNOWN'}</div>
                                                    <div className="text-[9px] opacity-40 uppercase">{event.actor_role} {event.actor_auth_level ? `(L${event.actor_auth_level})` : ''}</div>
                                                </td>
                                                <td><span className="text-[10px] font-bold text-slate-500">{event.scope_key || event.station_id || 'Global'}</span></td>
                                                <td className="text-right">
                                                    <button className="action-circle view">{isExpanded ? <FiChevronUp /> : <FiChevronDown />}</button>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={7} className="p-0">
                                                        <div className="event-details-expansion animate-fade-in">
                                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                                                <div className="lg:col-span-2">
                                                                    <label className="text-[9px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Extended Telemetry JSON</label>
                                                                    <pre>{JSON.stringify(event.details || {}, null, 2)}</pre>
                                                                </div>
                                                                <div className="space-y-6">
                                                                    <div>
                                                                        <label className="text-[9px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Alert Status</label>
                                                                        <div className="bg-white p-4 rounded-2xl border border-slate-100">
                                                                            <div className="flex justify-between text-xs font-bold text-slate-600 mb-2">
                                                                                <span>Delivery Status:</span>
                                                                                <span className="uppercase text-rose-600">{event.alert_status}</span>
                                                                            </div>
                                                                            <div className="flex justify-between text-[10px] opacity-40">
                                                                                <span>Attempts:</span>
                                                                                <span>{event.alert_attempts || 0}</span>
                                                                            </div>
                                                                            {event.alerted_at && <div className="mt-2 text-[10px] font-mono opacity-50 uppercase">Sent: {new Date(event.alerted_at).toLocaleString()}</div>}
                                                                        </div>
                                                                    </div>
                                                                    {event.last_alert_error && (
                                                                        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl">
                                                                            <label className="text-[9px] font-black uppercase text-rose-400 mb-1 block">Last Provider Error</label>
                                                                            <p className="text-[10px] font-bold text-rose-600 leading-relaxed">{event.last_alert_error}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </section>
            </div>
        </Layout>
    );
};

export default SecurityEvents;
