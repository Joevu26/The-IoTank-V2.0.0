import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FiCheck, FiSearch, FiCheckCircle, FiArrowRight,
    FiZap, FiActivity, FiShield, FiAlertTriangle, FiInfo, FiSliders, FiAlertOctagon, FiSettings, FiMail, FiBell
} from 'react-icons/fi';
import './AlertsCenter.css';
import { useAlerts, resolveAlert, useTanks, updateTank } from '@/hooks/useSupabase';
import { useAuth } from '@/hooks/useAuth';
import { NotificationService } from '../../services/NotificationService';
import { Alert, AlertSeverityLabel } from '@/types';
import { getSeverityClass } from '../../services/AlertScoringEngine';
import { SkeletonDashboard, SkeletonTable } from '../Common/SkeletonLoader';

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'mission' | 'thresholds' | 'preferences';
type SeverityFilter = 'ALL' | AlertSeverityLabel | 'RESOLVED';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getAlertAge(timestamp: number): string {
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 60) return `${diffMins}m`;
    const diffHrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${diffHrs}h ${mins}m`;
}

function getAlertSeverityLabel(alert: Alert): AlertSeverityLabel {
    if (alert.severityLabel) return alert.severityLabel;
    if (alert.score != null) {
        if (alert.score >= 90) return 'CRITICAL';
        if (alert.score >= 70) return 'HIGH';
        if (alert.score >= 40) return 'WATCH';
        return 'INFO';
    }
    if (alert.severity === 'critical') return 'CRITICAL';
    if (alert.severity === 'warning') return 'HIGH';
    return 'INFO';
}

// ── Sub-Components ─────────────────────────────────────────────────────────────

const RiskIndexCards: React.FC<{ activeAlerts: Alert[] }> = ({ activeAlerts }) => {
    const fuelRiskCount = activeAlerts.filter(a => ['leak-detected', 'theft-detected', 'low-fuel'].includes(a.type)).length;
    const systemRiskCount = activeAlerts.filter(a => ['telemetry-gap', 'sensor-failure'].includes(a.type)).length;
    const complianceCount = activeAlerts.filter(a => a.severity === 'info').length;

    return (
        <div className="risk-index-grid">
            <div className="risk-card-premium fuel">
                <div className="label-stack">
                    <label>Fuel Inventory Risk</label>
                    <h3>{fuelRiskCount > 0 ? `${fuelRiskCount} Active Vectors` : 'Nominal State'}</h3>
                </div>
                <div className="risk-icon-box">
                    <FiZap />
                </div>
            </div>
            <div className="risk-card-premium system">
                <div className="label-stack">
                    <label>System Integrity</label>
                    <h3>{systemRiskCount > 0 ? `${systemRiskCount} Neural Gaps` : 'Maximum Uptime'}</h3>
                </div>
                <div className="risk-icon-box">
                    <FiActivity />
                </div>
            </div>
            <div className="risk-card-premium compliance">
                <div className="label-stack">
                    <label>Governance & Audit</label>
                    <h3>{complianceCount > 0 ? `${complianceCount} Advisory Items` : 'Full Compliance'}</h3>
                </div>
                <div className="risk-icon-box">
                    <FiShield />
                </div>
            </div>
        </div>
    );
};

const EscalationLadder: React.FC<{ activeAlerts: Alert[] }> = ({ activeAlerts }) => {
    const counts = {
        CRITICAL: activeAlerts.filter(a => getAlertSeverityLabel(a) === 'CRITICAL').length,
        HIGH: activeAlerts.filter(a => getAlertSeverityLabel(a) === 'HIGH').length,
        WATCH: activeAlerts.filter(a => getAlertSeverityLabel(a) === 'WATCH').length,
        INFO: activeAlerts.filter(a => getAlertSeverityLabel(a) === 'INFO').length,
    };
    
    const total = activeAlerts.length || 1;
    const getWidth = (count: number) => (count / total) * 100;

    return (
        <div className="escalation-ladder-container">
            <div className="ladder-header">
                <h4>Escalation Ladder</h4>
                <div className="ladder-legend">
                    <div className="legend-item"><span className="dot critical" /> Critical</div>
                    <div className="legend-item"><span className="dot high" /> High</div>
                    <div className="legend-item"><span className="dot watch" /> Watch</div>
                    <div className="legend-item"><span className="dot info" /> Info</div>
                </div>
            </div>
            <div className="ladder-bar">
                <div className="ladder-segment critical" style={{ width: `${getWidth(counts.CRITICAL)}%` }} />
                <div className="ladder-segment high" style={{ width: `${getWidth(counts.HIGH)}%` }} />
                <div className="ladder-segment watch" style={{ width: `${getWidth(counts.WATCH)}%` }} />
                <div className="ladder-segment info" style={{ width: `${getWidth(counts.INFO)}%` }} />
            </div>
        </div>
    );
};

interface AlertRowProps {
    alert: Alert;
    onResolve: (id: string) => void;
    onInvestigate: (alert: Alert) => void;
}
const AlertRow: React.FC<AlertRowProps> = ({ alert, onResolve, onInvestigate }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const label = getAlertSeverityLabel(alert);
    const cssClass = getSeverityClass(label);
    const age = getAlertAge(alert.timestamp);
    const score = alert.score ?? 0;

    return (
        <div className={`alert-item-modern ${cssClass} ${label === 'CRITICAL' ? 'premium-glow-critical' : ''}`}>
            <div className="alert-icon-box">
                {label === 'CRITICAL' ? <FiAlertOctagon size={24} /> : label === 'HIGH' ? <FiAlertTriangle size={24} /> : <FiInfo size={24} />}
            </div>
            
            <div className="alert-content-main" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="alert-header-row">
                    <span className="alert-type-label">{alert.type.replace(/-/g, ' ')}</span>
                    <span className="alert-time-stamp">{age} ago</span>
                </div>
                <h4 className="alert-main-title">{alert.title ?? alert.message}</h4>
                <div className="alert-badge-row">
                    <span className={`severity-pill ${cssClass}`}>
                        {score > 0 && <span className="score-inset">{score}</span>}
                        {label}
                    </span>
                    {alert.isComposite && <span className="ai-logic-pill">AI ANALYZED</span>}
                </div>

                {isExpanded && (
                    <div className="alert-expanded-details animate-in fade-in slide-in-from-top-2">
                        <p className="detail-text">{alert.description || alert.message || 'No additional telemetry data available.'}</p>
                    </div>
                )}
            </div>

            <div className="alert-content-actions">
                <button className="action-btn-pill investigate" onClick={(e) => { e.stopPropagation(); onInvestigate(alert); }} title="Investigate Root Cause">
                    <FiZap />
                </button>
                <button className="action-btn-pill resolve" onClick={(e) => { e.stopPropagation(); onResolve(alert.id); }} title="Resolve Vector">
                    <FiCheck />
                </button>
            </div>
        </div>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────
export const AlertsCenter: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>('mission');
    const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL');
    const [isLoading, setIsLoading] = useState(true);

    // History filters
    const [historySearch, setHistorySearch] = useState('');

    // Global Calibration State (Restored)
    const [telemetryGap, setTelemetryGap] = useState(15);
    const [deliveryVariance, setDeliveryVariance] = useState(2);

    // Preference states
    const [emailEnabled, setEmailEnabled] = useState(true);
    const [escalationDelay, setEscalationDelay] = useState('2h');

    const { currentUser } = useAuth();
    const orgId = currentUser?.stationId || '';

    const { alerts: rawActiveAlerts, loading: activeLoading } = useAlerts(orgId, false);
    const { alerts: alertHistory } = useAlerts(orgId, true);
    const { tanks, loading: tanksLoading } = useTanks(orgId);

    useEffect(() => {
        setIsLoading(true);
        const timer = setTimeout(() => setIsLoading(false), 800);
        return () => clearTimeout(timer);
    }, [activeTab]);

    const [localThresholds, setLocalThresholds] = useState<Record<string, {critical: number, low: number}>>({});

    useEffect(() => {
        if (!tanksLoading && tanks.length > 0) {
            const init: any = {};
            tanks.forEach(t => {
                init[t.id] = { critical: t.criticalLevelThreshold || 0, low: t.lowLevelThreshold || 0 };
            });
            setLocalThresholds(init);
        }
    }, [tanks, tanksLoading]);

    const handleLocalThresholdChange = (tankId: string, type: 'critical' | 'low', val: number) => {
        setLocalThresholds(prev => ({
            ...prev,
            [tankId]: { ...(prev[tankId] || {critical: 0, low: 0}), [type]: val }
        }));
    };

    const commitThresholdUpdate = (tankId: string, type: 'critical' | 'low') => {
        const val = localThresholds[tankId]?.[type];
        if (val !== undefined) handleThresholdUpdate(tankId, type, val);
    };

    const activeAlerts = useMemo(() => {
        return rawActiveAlerts.map(a => ({
            ...a,
            severityLabel: a.severityLabel ?? getAlertSeverityLabel(a),
        }));
    }, [rawActiveAlerts]);

    const filteredActive = useMemo(() => {
        if (severityFilter === 'ALL') return activeAlerts;
        return activeAlerts.filter(a => getAlertSeverityLabel(a) === severityFilter);
    }, [activeAlerts, severityFilter]);

    const filteredHistory = useMemo(() => {
        return alertHistory.filter(a => {
            const matchSearch = !historySearch || (a.title ?? a.message).toLowerCase().includes(historySearch.toLowerCase());
            return matchSearch;
        });
    }, [alertHistory, historySearch]);

    const handleResolve = (id: string) => { resolveAlert(id, currentUser?.authUserId || 'SYSTEM'); };
    const handleInvestigate = (alert: Alert) => { 
        if (alert.rootCauseLink) {
            const { type, id } = alert.rootCauseLink;
            let path = '/';
            if (type === 'tank') path = `/tanks/${id}`;
            else if (type === 'delivery') path = `/deliveries/${id}`;
            else if (type === 'shift') path = `/shifts/${id}`;
            navigate(path);
        }
    };

    const handleThresholdUpdate = async (tankId: string, type: 'low' | 'critical', value: number) => {
        try {
            const updates = type === 'low' 
                ? { lowLevelThreshold: value } 
                : { criticalLevelThreshold: value };
            await updateTank(tankId, updates);
        } catch (err) {
            console.error('Threshold update failed:', err);
        }
    };


    return (
        <div className="alerts-hud-container">
            {/* ── Side HUD: Neural Status ── */}
            <aside className="hud-neural-sidebar">
                <div className="hud-brand-stack">
                    <h1 className="hud-brand-title">
                        Risk <span className="amethyst-glimmer">Command HUD</span>
                    </h1>
                    <div className="hud-status-line">
                        <span className="live-pulse-dot" /> Operational Intelligence v2.5
                    </div>
                </div>

                <div className="neural-stats-scroller">
                    <div className="sidebar-group">
                        <label className="sidebar-label">Neural Integrity</label>
                        <RiskIndexCards activeAlerts={activeAlerts} />
                    </div>

                    <div className="sidebar-group">
                        <label className="sidebar-label">Criticality Spread</label>
                        <EscalationLadder activeAlerts={activeAlerts} />
                    </div>

                    <div className="sidebar-meta-block">
                        <div className="meta-item">
                            <FiActivity size={12} />
                            <span>System Uptime: <strong>99.98%</strong></span>
                        </div>
                        <div className="meta-item">
                            <FiZap size={12} />
                            <span>Neural Latency: <strong>42ms</strong></span>
                        </div>
                    </div>
                </div>
            </aside>

            {/* ── Main Pane: Forensic Logic ── */}
            <main className="hud-content-area">
                <header className="hud-top-navigation">
                    <nav className="tactical-tabs">
                        <button className={`tactical-tab ${activeTab === 'mission' ? 'active' : ''}`} onClick={() => setActiveTab('mission')}>
                            <FiActivity /> Mission Control
                            {rawActiveAlerts.length > 0 && <span className="tab-count">{rawActiveAlerts.length}</span>}
                        </button>
                        <button className={`tactical-tab ${activeTab === 'thresholds' ? 'active' : ''}`} onClick={() => setActiveTab('thresholds')}>
                            <FiSliders /> Calibration
                        </button>
                        <button className={`tactical-tab ${activeTab === 'preferences' ? 'active' : ''}`} onClick={() => setActiveTab('preferences')}>
                            <FiSettings /> Dispatch
                        </button>
                    </nav>

                    <div className="hud-top-actions">
                        {activeTab === 'thresholds' && (
                            <button className="tactical-btn-primary btn-sm">
                                <FiCheckCircle /> Propagate Logic
                            </button>
                        )}
                        {activeTab === 'preferences' && (
                            <button className="tactical-btn-primary btn-sm">
                                <FiCheckCircle /> Commit Orchestration
                            </button>
                        )}
                    </div>
                </header>

                <div className="hud-view-viewport">
                    {(isLoading || activeLoading) ? (
                        <div className="hud-loader-container">
                            <SkeletonDashboard />
                        </div>
                    ) : (
                        <div className="view-pane-wrapper">
                            {activeTab === 'mission' && (
                                <div className="mission-dashboard-container animate-hud-in">
                                    <div className="mission-scroll-area scrollable-hud">
                                        {/* SECTION 1: ACTIONABLE VECTORS */}
                                        <section className="dashboard-section">
                                            <div className="section-header-compact">
                                                <h3 className="section-title">Active Vectors <span className="dim">/ Intelligence Stream</span></h3>
                                                <div className="filter-reel">
                                                    {(['ALL', 'CRITICAL', 'HIGH', 'WATCH', 'INFO'] as SeverityFilter[]).map(f => (
                                                        <button 
                                                            key={f} 
                                                            className={`filter-reel-chip ${severityFilter === f ? 'active' : ''}`} 
                                                            data-severity={f.toLowerCase()}
                                                            onClick={() => setSeverityFilter(f)}
                                                        >
                                                            {f}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="vectors-grid">
                                                {filteredActive.length === 0 ? (
                                                    <div className="empty-tactical-state unified">
                                                        <FiShield size={48} className="empty-icon-glow" />
                                                        <p>Zero immediate threats detected.</p>
                                                    </div>
                                                ) : (
                                                    filteredActive.map(a => <AlertRow key={a.id} alert={a} onResolve={handleResolve} onInvestigate={handleInvestigate} />)
                                                )}
                                            </div>
                                        </section>

                                        <div className="dashboard-separator" />

                                        {/* SECTION 2: FORENSIC LOG */}
                                        <section className="dashboard-section pb-20">
                                            <div className="section-header-compact">
                                                <h3 className="section-title">Forensic Pulse <span className="dim">/ Historical Audit</span></h3>
                                                <div className="input-group-tactical max-w-xs">
                                                    <FiSearch className="input-icon" />
                                                    <input
                                                        type="text"
                                                        placeholder="Query log history..."
                                                        value={historySearch}
                                                        onChange={e => setHistorySearch(e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            <div className="tactical-table-overflow">
                                                <table className="forensic-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Telemetry Event</th>
                                                            <th>Signature</th>
                                                            <th>Severity</th>
                                                            <th>Timestamp</th>
                                                            <th>Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredHistory.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={5} className="empty-table-row">End of relevant log history.</td>
                                                            </tr>
                                                        ) : filteredHistory.map(item => (
                                                            <tr key={item.id} className="forensic-row">
                                                                <td>
                                                                    <div className="event-identity">
                                                                        <div className={`status-orb ${getSeverityClass(getAlertSeverityLabel(item))}`} />
                                                                        <span className="event-title">{item.title ?? item.message}</span>
                                                                    </div>
                                                                </td>
                                                                <td><span className="signature-tag">{item.type.replace(/-/g, ' ')}</span></td>
                                                                <td>
                                                                    <span className={`severity-tag ${getSeverityClass(getAlertSeverityLabel(item))}`}>
                                                                        {getAlertSeverityLabel(item)}
                                                                    </span>
                                                                </td>
                                                                <td className="timestamp-cell">{new Date(item.timestamp).toLocaleDateString()}</td>
                                                                <td>
                                                                    <button className="row-action-btn" onClick={() => handleInvestigate(item)}>
                                                                        Audit <FiArrowRight size={12} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </section>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'thresholds' && (
                                <div className="view-pane flex-column animate-hud-in scrollable-hud">
                                    <div className="hud-glass-card-compact border-none">
                                        <header className="pane-header-compact">
                                            <div className="header-text">
                                                <h2 className="card-title">Calibration Engine</h2>
                                                <span className="card-subtitle">Local & Global Operational Policy [STABLE]</span>
                                            </div>
                                        </header>

                                        {/* SECTION 1: GLOBAL NEURAL POLICY */}
                                        <div className="system-intelligence-grid mb-10">
                                            <div className="calibration-module full-width">
                                                <h4 className="module-title"><FiActivity /> System Resilience</h4>
                                                <div className="logic-control-stack-horizontal">
                                                    <div className="logic-control">
                                                        <div className="control-meta">
                                                            <label>Sensor Dropout Tolerance</label>
                                                            <span className="control-value">{telemetryGap}m</span>
                                                        </div>
                                                        <input 
                                                            type="range" min="5" max="120" value={telemetryGap} 
                                                            onChange={e => setTelemetryGap(Number(e.target.value))} 
                                                            className="tactical-range" 
                                                        />
                                                        <p className="control-hint">Allowed neural disconnect before critical integrity alerts.</p>
                                                    </div>
                                                    <div className="logic-control">
                                                        <div className="control-meta">
                                                            <label>Delivery Audit Variance</label>
                                                            <span className="control-value">{deliveryVariance}%</span>
                                                        </div>
                                                        <input 
                                                            type="range" min="1" max="25" value={deliveryVariance} 
                                                            onChange={e => setDeliveryVariance(Number(e.target.value))} 
                                                            className="tactical-range" 
                                                        />
                                                        <p className="control-hint">Maximum neural discrepancy allowed in fuel audit reconciliation.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="dashboard-separator" />

                                        {/* SECTION 2: PER-TANK THRESHOLDS */}
                                        <div className="calibration-module-header mt-6">
                                            <h4 className="module-title"><FiShield /> Volume Alerts [Per Tank]</h4>
                                        </div>

                                        {/* STANDARDIZED THRESHOLDS REFERENCE CARD */}
                                        <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6 mb-8 flex items-start gap-5 animate-in fade-in slide-in-from-top-4 duration-500">
                                            <div className="w-12 h-12 bg-blue-600/10 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                                                <FiInfo size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-blue-900 font-extrabold text-sm uppercase tracking-widest mb-3">Standardized Detection Engine Thresholds</h4>
                                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                                    {[
                                                        { label: 'High-High', val: '98%', status: 'Critical Overfill' },
                                                        { label: 'High', val: '95%', status: 'Operator Warning' },
                                                        { label: 'Info', val: '50%', status: 'Mid-point Check' },
                                                        { label: 'Low', val: '20%', status: 'Reorder' },
                                                        { label: 'Critical Low', val: '5%', status: 'Emergency Stop' },
                                                    ].map((t, i) => (
                                                        <div key={i} className="bg-white/80 p-3 rounded-xl border border-blue-100 shadow-sm">
                                                            <div className="flex justify-between items-start mb-1">
                                                                <span className="text-[10px] font-black text-blue-500 uppercase">{t.label}</span>
                                                                <span className="text-xs font-black text-blue-800">{t.val}</span>
                                                            </div>
                                                            <p className="text-[9px] font-bold text-slate-500 leading-tight uppercase tracking-tighter">{t.status}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                                <p className="text-[10px] text-blue-500/70 font-bold mt-4 italic">
                                                    * These thresholds are deterministic and hardcoded into the detection neural matrix to ensure safety compliance.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="calibration-scroller-grid">
                                            {tanksLoading ? <SkeletonTable /> : (
                                                tanks.map(tank => (
                                                    <div key={tank.id} className="tank-logic-card">
                                                        <div className="tank-card-meta">
                                                            <h4 className="tank-name">{tank.name}</h4>
                                                            <span className="fuel-tag">{tank.fuelType}</span>
                                                        </div>
                                                        <div className="logic-stack">
                                                            <div className="logic-control">
                                                                <div className="control-meta">
                                                                    <label>Critical Fuel Volume</label>
                                                                    <span className="control-value">{localThresholds[tank.id]?.critical ?? tank.criticalLevelThreshold}L</span>
                                                                </div>
                                                                <input 
                                                                    type="range" 
                                                                    min="0" 
                                                                    max={tank.capacity || 1000} 
                                                                    value={localThresholds[tank.id]?.critical ?? tank.criticalLevelThreshold} 
                                                                    onChange={e => handleLocalThresholdChange(tank.id, 'critical', Number(e.target.value))} 
                                                                    onMouseUp={() => commitThresholdUpdate(tank.id, 'critical')}
                                                                    onTouchEnd={() => commitThresholdUpdate(tank.id, 'critical')}
                                                                    className="tactical-range" 
                                                                />
                                                            </div>
                                                            <div className="logic-control">
                                                                <div className="control-meta">
                                                                    <label>Low Fuel Volume</label>
                                                                    <span className="control-value">{localThresholds[tank.id]?.low ?? tank.lowLevelThreshold}L</span>
                                                                </div>
                                                                <input 
                                                                    type="range" 
                                                                    min="0" 
                                                                    max={tank.capacity || 1000} 
                                                                    value={localThresholds[tank.id]?.low ?? tank.lowLevelThreshold} 
                                                                    onChange={e => handleLocalThresholdChange(tank.id, 'low', Number(e.target.value))} 
                                                                    onMouseUp={() => commitThresholdUpdate(tank.id, 'low')}
                                                                    onTouchEnd={() => commitThresholdUpdate(tank.id, 'low')}
                                                                    className="tactical-range" 
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'preferences' && (
                                <div className="view-pane flex-column animate-hud-in">
                                    <div className="hud-glass-card-compact border-none">
                                        <header className="pane-header-compact">
                                            <h2 className="card-title">Dispatch Orchestration</h2>
                                        </header>

                                        <div className="dispatch-layout">
                                            <div className="dispatch-section">
                                                <h4 className="dispatch-subtitle">Primary Channels</h4>
                                                <div className="tactical-toggle-row">
                                                    <div className="toggle-info">
                                                        <div className="toggle-label"><FiBell /> Native Push Services</div>
                                                        <p>Biological bypass for real-time tactical pulses.</p>
                                                    </div>
                                                    <button className={`tactical-switch ${NotificationService.isEnabled() ? 'active' : ''}`} onClick={() => {}}>
                                                        <div className="switch-knob" />
                                                    </button>
                                                </div>
                                                <div className="tactical-toggle-row">
                                                    <div className="toggle-info">
                                                        <div className="toggle-label"><FiMail /> Email Intelligence</div>
                                                        <p>Forensic summaries delivered to mission control.</p>
                                                    </div>
                                                    <button className={`tactical-switch ${emailEnabled ? 'active' : ''}`} onClick={() => setEmailEnabled(!emailEnabled)}>
                                                        <div className="switch-knob" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="dispatch-section">
                                                <h4 className="dispatch-subtitle">Escalation Logic</h4>
                                                <div className="select-group-tactical">
                                                    <label>Chain of Command Delay</label>
                                                    <select value={escalationDelay} onChange={e => setEscalationDelay(e.target.value)} className="select-tactical w-full">
                                                        <option value="1h">1 hour (High Priority)</option>
                                                        <option value="2h">2 hours (Operational)</option>
                                                        <option value="4h">4 hours (Deep Maintenance)</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

