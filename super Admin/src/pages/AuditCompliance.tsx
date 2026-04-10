import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { adminAuditService, AuditEntry, FinancialTrail, ComplianceStatus, SecurityIncident } from '../services/adminAuditService';
import { 
    FiShield, FiList, FiDollarSign, FiCheckCircle, 
    FiAlertTriangle, FiUser, FiCalendar, FiSearch, 
    FiDownload, FiTarget, FiActivity, FiKey, 
    FiGlobe, FiCpu, FiExternalLink, FiChevronDown, FiChevronUp,
    FiLock, FiUnlock, FiEye, FiBarChart2, FiChevronRight, FiFileText, FiPlus
} from 'react-icons/fi';
import './AuditCompliance.css';

const AuditCompliance: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'audit' | 'financial' | 'compliance' | 'security' | 'accountability'>('audit');
    const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
    const [financialTrail, setFinancialTrail] = useState<FinancialTrail[]>([]);
    const [compliance, setCompliance] = useState<ComplianceStatus[]>([]);
    const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
    const [riskMetrics, setRiskMetrics] = useState<any>(null);
    const [expandedLog, setExpandedLog] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [auditData, financialData, complianceData, incidentData, metricsData] = await Promise.all([
                    adminAuditService.getAuditLogs(),
                    adminAuditService.getFinancialTrail(),
                    adminAuditService.getComplianceOverview(),
                    adminAuditService.getSecurityIncidents(),
                    adminAuditService.getAdminRiskMetrics()
                ]);
                setAuditLogs(auditData);
                setFinancialTrail(financialData);
                setCompliance(complianceData);
                setIncidents(incidentData);
                setRiskMetrics(metricsData);
            } catch (error) {
                console.error('Error fetching audit data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'compliant': return 'comp-compliant';
            case 'warning': return 'comp-warning';
            case 'expired': return 'comp-expired';
            default: return '';
        }
    };

    const renderAuditLog = () => (
        <div className="audit-log-section animate-fade-in">
            {/* 9.1 Search & Filter */}
            <div className="flex flex-wrap gap-4 mb-8">
                <div className="relative flex-1">
                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" />
                    <input type="text" placeholder="Search by description, resource ID, or IP..." className="support-input pl-12" />
                </div>
                <select className="support-input w-auto font-bold opacity-60">
                    <option>Category: All</option>
                    <option>System</option>
                    <option>Financial</option>
                    <option>Security</option>
                    <option>User Management</option>
                </select>
                <div className="flex gap-2">
                    <input type="date" className="support-input w-auto text-xs" />
                    <button className="btn-secondary flex items-center gap-2 text-xs"><FiDownload /> Export CSV</button>
                </div>
            </div>

            <div className="ticket-table-container">
                <table className="forensic-table">
                    <thead>
                        <tr>
                            <th>Timestamp</th>
                            <th>Identity & Role</th>
                            <th>Category</th>
                            <th>Action & Description</th>
                            <th>IP Origin</th>
                            <th>Status</th>
                            <th className="text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {auditLogs.map(log => (
                            <React.Fragment key={log.id}>
                                <tr className="group cursor-pointer hover:bg-white hover:bg-opacity-5" onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}>
                                    <td className="font-mono text-[10px] opacity-50 whitespace-nowrap">
                                        {new Date(log.timestamp).toLocaleString([], { hour12: false })}
                                    </td>
                                    <td>
                                        <div className="font-bold text-sm tracking-tight">{log.user_name}</div>
                                        <div className="text-[10px] opacity-40 uppercase font-black">{log.user_role}</div>
                                    </td>
                                    <td>
                                        <span className={`badge text-[8px] bg-opacity-10 border border-opacity-20 ${log.action_category === 'Financial' ? 'text-amber-500 border-amber-500' : 'text-primary border-primary'}`}>
                                            {log.action_category}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="font-bold text-xs">{log.action_type}</div>
                                        <div className="text-[10px] opacity-50 mt-1 max-w-[300px] truncate">{log.description}</div>
                                    </td>
                                    <td className="font-mono text-xs opacity-60 italic">{log.ip_address}</td>
                                    <td>
                                        <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${log.result === 'success' ? 'text-success' : 'text-danger'}`}>
                                            {log.result === 'success' ? <FiCheckCircle /> : <FiAlertTriangle />}
                                            {log.result}
                                        </div>
                                    </td>
                                    <td className="text-right">
                                        {expandedLog === log.id ? <FiChevronUp /> : <FiChevronDown />}
                                    </td>
                                </tr>
                                {expandedLog === log.id && (
                                    <tr>
                                        <td colSpan={7} className="bg-white bg-opacity-5 p-6 animate-slide-down">
                                            <div className="grid grid-cols-2 gap-8">
                                                <div>
                                                    <h5 className="info-label mb-2">Technical Context</h5>
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex justify-between text-[10px]"><span className="opacity-40 uppercase">Resource ID:</span> <span className="font-mono font-bold">{log.resource_id || 'N/A'}</span></div>
                                                        <div className="flex justify-between text-[10px]"><span className="opacity-40 uppercase">User Agent:</span> <span className="opacity-60 truncate max-w-[200px]">{log.user_agent}</span></div>
                                                        <div className="flex justify-between text-[10px]"><span className="opacity-40 uppercase">Fingerprint:</span> <span className="font-mono opacity-30">sha256_e3b0...</span></div>
                                                    </div>
                                                </div>
                                                {log.changes && (
                                                    <div>
                                                        <h5 className="info-label mb-2">State Transitions (Before / After)</h5>
                                                        <div className="json-diff-container text-[10px]">
                                                            {Object.keys(log.changes.after).map(key => (
                                                                <div key={key} className="diff-field">
                                                                    <span className="opacity-40">{key}:</span>
                                                                    <div className="flex gap-2">
                                                                        <span className="diff-before">{JSON.stringify(log.changes?.before[key])}</span>
                                                                        <FiChevronRight className="opacity-20" />
                                                                        <span className="diff-after">{JSON.stringify(log.changes?.after[key])}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderFinancialAudit = () => (
        <div className="financial-audit animate-fade-in">
            <div className="incident-card mb-8 py-6 px-8 flex justify-between items-center bg-amber-500 bg-opacity-5 border-amber-500 border-opacity-20">
                <div className="flex items-center gap-6">
                    <FiLock className="text-2xl text-amber-500" />
                    <div>
                        <h3 className="text-lg font-black lowercase tracking-tighter">Immutable Integrity Ledger</h3>
                        <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Financial records cannot be deleted or modified post-settlement</p>
                    </div>
                </div>
                <button className="btn-secondary text-[10px] py-2 px-4 font-black uppercase tracking-[0.2em] border-amber-500 border-opacity-30 text-amber-500">Run Reconciliation Report</button>
            </div>

            <div className="ticket-table-container">
                <table className="forensic-table">
                    <thead>
                        <tr>
                            <th>Record ID</th>
                            <th>Transition Date</th>
                            <th>Entry Type</th>
                            <th>Asset / Client</th>
                            <th className="text-right">Valuation Shift</th>
                            <th className="text-right">New Balance</th>
                            <th>Settled By</th>
                            <th className="text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {financialTrail.map(trail => (
                            <tr key={trail.id}>
                                <td className="font-mono text-xs opacity-40">{trail.id}</td>
                                <td className="font-mono text-[10px] opacity-60">{trail.timestamp}</td>
                                <td><span className={`badge text-[8px] bg-opacity-10 border border-opacity-20 ${trail.type === 'Adjustment' ? 'text-warning border-warning' : 'text-success border-success'}`}>{trail.type}</span></td>
                                <td>
                                    <div className="font-bold text-sm tracking-tight">{trail.client_name}</div>
                                    <div className="text-[10px] opacity-40 uppercase font-bold truncate">REF: {trail.reference}</div>
                                </td>
                                <td className="text-right font-mono font-bold text-sm">
                                    <span className={trail.amount > 0 ? 'text-success' : 'text-danger'}>
                                        {trail.amount > 0 ? '+' : ''}{trail.amount.toLocaleString()} <small className="opacity-50">KES</small>
                                    </span>
                                </td>
                                <td className="text-right font-mono font-bold text-sm">{trail.new_balance.toLocaleString()} <small className="opacity-50">KES</small></td>
                                <td>
                                    <div className="text-xs font-bold opacity-60">{trail.initiated_by}</div>
                                </td>
                                <td className="text-right">
                                    <button className="icon-btn" title="View Related Invoice"><FiFileText /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderCompliance = () => (
        <div className="compliance-section animate-fade-in">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {[
                    { label: 'EPRA Licenses', total: 42, active: 38, expired: 4, color: 'primary' },
                    { label: 'KRA Tax P10', total: 12, active: 12, expired: 0, color: 'success' },
                    { label: 'NEMA Permits', total: 42, active: 30, expired: 12, color: 'warning' },
                    { label: 'Data Registry', total: 1, active: 1, expired: 0, color: 'cyan-400' }
                ].map(cat => (
                    <div key={cat.label} className="glass-card">
                        <span className="kpi-label">{cat.label} Tracking</span>
                        <div className="flex items-end gap-3 mt-4">
                            <h2 className="text-3xl font-black tracking-tighter">{cat.active}</h2>
                            <span className="text-[10px] font-bold opacity-30 uppercase mb-2">/ {cat.total} Active</span>
                        </div>
                        <div className="h-1 bg-white bg-opacity-5 mt-4 rounded-full overflow-hidden">
                            <div className={`h-full bg-${cat.color}`} style={{width: `${(cat.active/cat.total)*100}%`}}></div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-between items-center mb-6">
                <h4 className="font-black lowercase tracking-tighter">Regulatory Compliance Monitor</h4>
                <div className="flex gap-4">
                     <button className="btn-secondary text-[10px] flex items-center gap-2"><FiDownload /> KRA Invoice Register</button>
                     <button className="btn-primary text-[10px] flex items-center gap-2"><FiPlus /> Register Permit</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {compliance.map(comp => (
                    <div key={comp.id} className="report-template-card group">
                        <div className="flex items-center gap-6">
                            <div className="w-12 h-12 rounded-2xl bg-white bg-opacity-5 flex items-center justify-center text-2xl text-primary group-hover:bg-primary group-hover:text-black transition-all">
                                {comp.category === 'EPRA' ? <FiActivity /> : comp.category === 'KRA' ? <FiDollarSign /> : <FiGlobe />}
                            </div>
                            <div>
                                <h5 className="font-bold text-lg">{comp.name}</h5>
                                <div className="text-[10px] font-bold opacity-30 uppercase mb-2">Last Audit: {comp.last_audit} • Registry: {comp.category}</div>
                                <span className={`comp-badge ${getStatusColor(comp.status)}`}>{comp.status}</span>
                            </div>
                        </div>
                        <div className="text-right">
                             {comp.expiry_date && (
                                 <>
                                    <div className="text-[10px] font-black uppercase opacity-20 mb-1">Expires</div>
                                    <div className="font-mono font-bold text-sm whitespace-nowrap">{comp.expiry_date}</div>
                                 </>
                             )}
                             <button className="text-primary mt-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 float-right hover:gap-4 transition-all">
                                 View Docs <FiChevronRight />
                             </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderSecurityAudit = () => (
        <div className="security-audit-section animate-fade-in">
            {incidents.filter(i => i.severity === 'high').map(i => (
                <div key={i.id} className="incident-card critical animate-pulse-slow">
                    <div className="flex items-center justify-between">
                         <div className="flex items-center gap-6">
                            <div className="w-12 h-12 rounded-full bg-danger bg-opacity-20 flex items-center justify-center text-danger text-2xl">
                                <FiAlertTriangle />
                            </div>
                            <div>
                                <h3 className="text-xl font-black lowercase tracking-tighter">unauthorized access attempt flagged</h3>
                                <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-danger">Threat detected at {i.timestamp} from {i.source_ip}</p>
                            </div>
                         </div>
                         <div className="flex gap-3">
                             <button className="btn-primary bg-danger border-none text-[10px] font-black uppercase tracking-widest py-3 px-6">Block Source IP</button>
                             <button className="btn-secondary text-[10px] font-black uppercase tracking-widest py-3 px-6">Ignore Incident</button>
                         </div>
                    </div>
                </div>
            ))}

            <div className="security-grid">
                 <div className="glass-card">
                    <h4 className="font-black text-sm uppercase tracking-widest opacity-40 mb-6">Sensitive Data Access log</h4>
                    <div className="flex flex-col gap-4">
                        {[
                            { user: 'Joseph O.', resource: 'Bulk Client Export', time: '10m ago', status: 'verified' },
                            { user: 'Sarah L.', resource: 'Financial Ledger Access', time: '1h ago', status: 'verified' },
                            { user: 'Security System', resource: 'Admin Permissions Edit', time: '2h ago', status: 'flagged' }
                        ].map((log, i) => (
                            <div key={i} className="flex justify-between items-center p-3 bg-white bg-opacity-5 rounded-xl border border-white border-opacity-5">
                                 <div className="flex items-center gap-3">
                                     <div className="w-8 h-8 rounded-full bg-primary-soft flex items-center justify-center text-xs font-black text-primary">{log.user.charAt(0)}</div>
                                     <div>
                                         <div className="text-xs font-bold">{log.resource}</div>
                                         <div className="text-[10px] opacity-40 font-bold uppercase">{log.user}</div>
                                     </div>
                                 </div>
                                 <div className="text-right">
                                      <div className="text-[10px] opacity-30 mb-1">{log.time}</div>
                                      <span className={`text-[8px] font-black uppercase tracking-widest ${log.status === 'verified' ? 'text-success' : 'text-warning'}`}>{log.status}</span>
                                 </div>
                            </div>
                        ))}
                    </div>
                 </div>

                 <div className="glass-card">
                    <h4 className="font-black text-sm uppercase tracking-widest opacity-40 mb-6">Administrative Session Monitor</h4>
                    <div className="flex flex-col gap-4">
                        {[
                            { user: 'Joseph O.', ip: '192.168.1.42', location: 'Nairobi, KE', status: 'Active' },
                            { user: 'Admin Bot', ip: '10.0.0.12', location: 'Internal', status: 'Active' }
                        ].map((s, i) => (
                             <div key={i} className="flex justify-between items-center p-4 bg-white bg-opacity-5 rounded-xl">
                                  <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-xl bg-success bg-opacity-10 flex items-center justify-center text-success text-xl"><FiUnlock /></div>
                                      <div>
                                          <div className="font-bold text-xs">{s.user}</div>
                                          <div className="text-[10px] opacity-30 font-mono tracking-tighter">{s.ip} • {s.location}</div>
                                      </div>
                                  </div>
                                  <button className="text-danger text-[10px] font-black uppercase tracking-widest px-4 py-2 hover:bg-danger hover:bg-opacity-10 rounded-lg transition-colors">Terminte</button>
                             </div>
                        ))}
                    </div>
                    <button className="w-full mt-6 py-4 bg-white bg-opacity-5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] opacity-40 hover:opacity-100 transition-opacity">View Historical Login Trace</button>
                 </div>
            </div>
        </div>
    );

    const renderAccountability = () => (
        <div className="accountability-section animate-fade-in">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                 <div className="glass-card text-center">
                    <FiBarChart2 size={24} className="mx-auto mb-2 text-primary" />
                    <div className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-1">Critical Adjustments</div>
                    <div className="text-3xl font-black">{riskMetrics?.highRiskActions}</div>
                    <p className="text-[10px] opacity-30 mt-1 uppercase italic">Manual balance shifts this month</p>
                 </div>
                 <div className="glass-card text-center">
                    <FiAlertTriangle size={24} className="mx-auto mb-2 text-warning" />
                    <div className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-1">System Risk Indicators</div>
                    <div className="text-3xl font-black text-warning">MODERATE</div>
                    <div className="risk-meter"><div className="risk-level risk-med" style={{width: '65%'}}></div></div>
                 </div>
                 <div className="glass-card text-center">
                    <FiTarget size={24} className="mx-auto mb-2 text-success" />
                    <div className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-1">Compliance Accuracy</div>
                    <div className="text-3xl font-black text-success">98.2%</div>
                    <p className="text-[10px] opacity-30 mt-1 uppercase italic">Reporting error margin</p>
                 </div>
             </div>

             <div className="glass-card p-0 overflow-hidden">
                <div className="px-8 py-6 border-b border-white border-opacity-5 flex justify-between items-center">
                    <h4 className="font-black lowercase tracking-tighter">Administrative behavioral risk scoring</h4>
                    <button className="btn-secondary text-xs"><FiDownload /> Behavioral Report</button>
                </div>
                <table className="forensic-table">
                    <thead>
                        <tr>
                            <th>Administrative Entity</th>
                            <th>Identity Level</th>
                            <th>Action Volume</th>
                            <th>Adjustments</th>
                            <th>Response Accuracy</th>
                            <th>Risk Score</th>
                            <th className="text-right">Accountability</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            { name: 'Joseph O.', role: 'Super Admin', volume: 1450, adj: 12, accuracy: 99, risk: 4, color: 'success' },
                            { name: 'Sarah L.', role: 'Admin Helper', volume: 840, adj: 2, accuracy: 94, risk: 2, color: 'success' },
                            { name: 'Support Bot', role: 'Automated Bot', volume: 12400, adj: 0, accuracy: 100, risk: 0, color: 'success' }
                        ].map((admin, i) => (
                            <tr key={i}>
                                <td className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-accent-primary flex items-center justify-center text-xs font-black">{admin.name.charAt(0)}</div>
                                    <div className="font-bold">{admin.name}</div>
                                </td>
                                <td><span className="text-[10px] font-black uppercase opacity-40">{admin.role}</span></td>
                                <td className="font-mono text-xs font-bold">{admin.volume.toLocaleString()}</td>
                                <td className="font-mono text-xs font-bold text-amber-500">{admin.adj}</td>
                                <td>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1 bg-white bg-opacity-5 rounded-full min-w-[50px]"><div className="h-full bg-primary" style={{width: `${admin.accuracy}%`}}></div></div>
                                        <span className="text-xs font-black">{admin.accuracy}%</span>
                                    </div>
                                </td>
                                <td><span className={`badge text-[8px] bg-${admin.color} bg-opacity-20 text-${admin.color} border-none`}>{admin.risk === 0 ? 'ZERO' : 'LOW'}</span></td>
                                <td className="text-right"><button className="icon-btn hover:text-primary"><FiEye /></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
        </div>
    );

    return (
        <Layout>
            <div className="audit-page">
                <header className="mb-8 flex justify-between items-start">
                    <div>
                        <h1 className="text-4xl font-black text-primary tracking-tighter lowercase">audit & compliance</h1>
                        <p className="text-secondary font-bold text-sm mt-1 uppercase tracking-widest opacity-60">
                            (Administrative accountability & regulatory transparency terminal)
                        </p>
                    </div>
                     <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-6 py-3 bg-[#0a0a0a] border border-amber-500 border-opacity-20 rounded-2xl">
                            <FiShield className="text-amber-500" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">Forensic Engine: Secure</span>
                        </div>
                    </div>
                </header>

                <div className="hw-tabs mb-8">
                    <button className={`hw-tab-btn ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>System audit log</button>
                    <button className={`hw-tab-btn ${activeTab === 'financial' ? 'active' : ''}`} onClick={() => setActiveTab('financial')}>Financial trail</button>
                    <button className={`hw-tab-btn ${activeTab === 'compliance' ? 'active' : ''}`} onClick={() => setActiveTab('compliance')}>Compliance hub</button>
                    <button className={`hw-tab-btn ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>Security surveillance</button>
                    <button className={`hw-tab-btn ${activeTab === 'accountability' ? 'active' : ''}`} onClick={() => setActiveTab('accountability')}>Accountability Hub</button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-40">
                        <div className="animate-spin mb-4"><FiShield size={32} /></div>
                        <p className="font-bold tracking-widest uppercase text-xs">Authenticating Forensic Archives...</p>
                    </div>
                ) : (
                    <>
                        {activeTab === 'audit' && renderAuditLog()}
                        {activeTab === 'financial' && renderFinancialAudit()}
                        {activeTab === 'compliance' && renderCompliance()}
                        {activeTab === 'security' && renderSecurityAudit()}
                        {activeTab === 'accountability' && renderAccountability()}
                    </>
                )}
            </div>
        </Layout>
    );
};

export default AuditCompliance;
