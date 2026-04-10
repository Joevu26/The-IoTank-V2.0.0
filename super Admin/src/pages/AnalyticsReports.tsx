import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { analyticsService, BusinessKPIs, UsageStats, ScheduledReport } from '../services/analyticsService';
import { 
    FiBarChart2, FiPieChart, FiTrendingUp, FiTrendingDown, 
    FiActivity, FiFileText, FiCalendar, FiUsers, 
    FiMap, FiTarget, FiZap, FiDownload, FiPlus,
    FiFilter, FiMail, FiClock, FiCheckCircle, FiChevronRight
} from 'react-icons/fi';
import './AnalyticsReports.css';

const AnalyticsReports: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'overview' | 'usage' | 'reports' | 'behavior' | 'automation'>('overview');
    const [kpis, setKpis] = useState<BusinessKPIs | null>(null);
    const [usage, setUsage] = useState<UsageStats | null>(null);
    const [scheduled, setScheduled] = useState<ScheduledReport[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [kpiData, usageData, scheduledData] = await Promise.all([
                    analyticsService.getBusinessKPIs(),
                    analyticsService.getUsageStats(),
                    analyticsService.getScheduledReports()
                ]);
                setKpis(kpiData);
                setUsage(usageData);
                setScheduled(scheduledData);
            } catch (error) {
                console.error('Error fetching analytics data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const renderBusinessDashboard = () => (
        <div className="analytics-overview animate-fade-in">
            {/* 7.1 Key Performance Indicators */}
            <div className="kpi-grid">
                <div className="kpi-card">
                    <span className="kpi-label">MRR Growth</span>
                    <h2 className="kpi-value">+{kpis?.mrrGrowth}%</h2>
                    <span className="kpi-growth positive">
                        <FiTrendingUp className="inline mr-1" /> Superior
                    </span>
                </div>
                <div className="kpi-card highlight">
                    <span className="kpi-label">Annual Run Rate (ARR)</span>
                    <h2 className="kpi-value text-primary">{formatCurrency(kpis?.arr || 0)}</h2>
                    <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Target: 20M</span>
                </div>
                <div className="kpi-card">
                    <span className="kpi-label">Churn Rate</span>
                    <h2 className="kpi-value text-danger">{kpis?.churnRate}%</h2>
                    <span className="kpi-growth negative">
                         Below industry avg
                    </span>
                </div>
                <div className="kpi-card">
                    <span className="kpi-label">Average ARPU</span>
                    <h2 className="kpi-value text-cyan-400">{formatCurrency(kpis?.arpu || 0)}</h2>
                    <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Per client/mo</span>
                </div>
            </div>

            <div className="analytics-dashboard-grid">
                {/* Simulated Growth Chart */}
                <div className="chart-container relative overflow-hidden">
                     <div className="flex justify-between items-start mb-6">
                        <div>
                            <h4 className="font-black text-sm uppercase tracking-widest opacity-40">Client Growth Over Time</h4>
                            <p className="text-xl font-bold">Total Hubs: 4,285</p>
                        </div>
                        <FiTrendingUp className="text-success text-2xl" />
                     </div>
                     <div className="h-48 flex items-end gap-2 px-2">
                        {[40, 60, 45, 80, 55, 90, 75, 110, 95, 130, 120, 156].map((v, i) => (
                            <div key={i} className="flex-1 bg-primary bg-opacity-20 rounded-t-lg transition-all hover:bg-opacity-50 group relative" style={{height: `${v}%`}}>
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black p-1 rounded text-[8px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                    {v} nodes
                                </div>
                            </div>
                        ))}
                     </div>
                     <div className="flex justify-between mt-4 text-[8px] font-black uppercase tracking-widest opacity-30 px-2">
                        <span>Jan 25</span>
                        <span>Jun 25</span>
                        <span>Dec 25</span>
                     </div>
                </div>

                {/* Simulated Geodistribution */}
                <div className="chart-container">
                    <h4 className="font-black text-sm uppercase tracking-widest opacity-40 mb-6">Regional Distribution</h4>
                    <div className="flex flex-col gap-4">
                        {[
                            { county: 'Nairobi', share: 45, color: 'bg-primary' },
                            { county: 'Mombasa', share: 22, color: 'bg-cyan-400' },
                            { county: 'Kisumu', share: 15, color: 'bg-amber-500' },
                            { county: 'Nakuru', share: 18, color: 'bg-indigo-500' }
                        ].map(c => (
                            <div key={c.county}>
                                <div className="flex justify-between text-[10px] font-bold opacity-60 uppercase mb-1">
                                    <span>{c.county}</span>
                                    <span>{c.share}%</span>
                                </div>
                                <div className="h-2 bg-white bg-opacity-5 rounded-full overflow-hidden">
                                    <div className={`h-full ${c.color}`} style={{width: `${c.share}%`}}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
                 <div className="glass-card text-center">
                    <FiActivity size={24} className="mx-auto mb-2 text-primary" />
                    <div className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-1">System Uptime</div>
                    <div className="text-2xl font-black">{kpis?.uptime}%</div>
                 </div>
                 <div className="glass-card text-center">
                    <FiZap size={24} className="mx-auto mb-2 text-cyan-400" />
                    <div className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-1">API Success Rate</div>
                    <div className="text-2xl font-black">{kpis?.apiSuccess}%</div>
                 </div>
                 <div className="glass-card text-center">
                    <FiUsers size={24} className="mx-auto mb-2 text-amber-500" />
                    <div className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-1">CAC Recovery</div>
                    <div className="text-2xl font-black">4.2 Months</div>
                 </div>
            </div>
        </div>
    );

    const renderUsageAnalytics = () => (
        <div className="usage-analytics animate-fade-in">
            <div className="usage-grid mb-8">
                <div className="usage-card glass-card">
                    <div className="kpi-label">Fuel Volume Monitored</div>
                    <h2 className="text-3xl font-black tracking-tighter text-primary">{usage?.totalFuel.toLocaleString()} <small className="text-xs opacity-50 uppercase tracking-widest font-bold">Liters</small></h2>
                    <div className="text-[10px] font-bold opacity-40 mt-1 uppercase tracking-widest">Daily Average: 42k Liters</div>
                </div>
                <div className="usage-card glass-card">
                    <div className="kpi-label">API Requests (30d)</div>
                    <h2 className="text-3xl font-black tracking-tighter text-cyan-400">{usage?.apiCalls30d.toLocaleString()}</h2>
                    <div className="text-[10px] font-bold opacity-40 mt-1 uppercase tracking-widest text-success">99.9% Latency compliant</div>
                </div>
                <div className="usage-card glass-card highlight">
                    <div className="kpi-label">Alerts Triggered (30d)</div>
                    <h2 className="text-3xl font-black tracking-tighter text-amber-500">{usage?.alertsTriggered30d}</h2>
                    <div className="text-[10px] font-bold opacity-40 mt-1 uppercase tracking-widest">Critial incidents flagged</div>
                </div>
            </div>

            <div className="glass-card">
                <h4 className="font-black text-sm uppercase tracking-widest opacity-40 mb-8">Feature Adoption Performance</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                    {Object.entries(usage?.featureAdoption || {}).map(([feature, adoption]) => (
                        <div key={feature} className="adoption-row">
                            <div className="flex-1">
                                <span className="text-xs font-bold">{feature}</span>
                                <div className="progress-track mt-1"><div className="progress-bar bg-primary" style={{width: `${adoption}%`}}></div></div>
                            </div>
                            <span className="text-xs font-black opacity-60">{adoption}%</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderFinancialReports = () => (
        <div className="financial-reports animate-fade-in">
            <div className="builder-layout">
                <div className="builder-controls">
                    <h5 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30">Configurator</h5>
                    <div>
                        <label className="kpi-label block mb-2">Report Template</label>
                        <select className="support-input w-full text-xs">
                            <option>Monthly Revenue Report</option>
                            <option>Tax Compliance (KRA)</option>
                            <option>Quarterly Analysis</option>
                            <option>Debt Aging</option>
                        </select>
                    </div>
                    <div>
                        <label className="kpi-label block mb-2">Date Range</label>
                        <input type="month" className="support-input w-full text-xs" defaultValue="2026-03" />
                    </div>
                    <div>
                        <label className="kpi-label block mb-2">Filters</label>
                        <div className="flex flex-col gap-2">
                             <div className="flex items-center gap-2"><input type="checkbox" defaultChecked /> <span className="text-[10px] font-bold opacity-60">Enterprise Tier</span></div>
                        </div>
                    </div>
                    <button className="btn-primary w-full py-4 text-xs font-black uppercase tracking-widest mt-4">
                        <FiFileText className="inline mr-2" /> Build Custom Report
                    </button>
                </div>

                <div className="report-library">
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="font-black lowercase tracking-tighter">Generated archives</h4>
                        <div className="flex gap-2">
                            <button className="icon-btn text-xs"><FiFilter /></button>
                            <button className="icon-btn text-xs"><FiDownload /></button>
                        </div>
                    </div>
                    <div className="flex flex-col gap-4">
                        {[
                            { name: 'Monthly Revenue - Feb 2026', type: 'Tax compliant', date: 'Mar 1, 2026', size: '2.4 MB' },
                            { name: 'KRA P10 - Annual Summary', type: 'KRA/PDF', date: 'Feb 15, 2026', size: '1.8 MB' },
                            { name: 'Quarterly Audit (Q4 2025)', type: 'Internal Use', date: 'Jan 10, 2026', size: '5.2 MB' }
                        ].map((r, i) => (
                            <div key={i} className="report-template-card">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center text-primary text-xl">
                                        <FiFileText />
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm">{r.name}</div>
                                        <div className="text-[10px] font-bold opacity-30 uppercase">{r.type} • {r.date}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-mono opacity-30">{r.size}</span>
                                    <button className="icon-btn hover:text-primary"><FiDownload /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderBehavior = () => (
        <div className="behavior-analytics animate-fade-in">
            <div className="grid grid-cols-2 gap-8 mb-12">
                <div className="glass-card">
                    <h4 className="font-black text-sm uppercase tracking-widest opacity-40 mb-6">Client engagement funnel</h4>
                    <div className="funnel-container">
                        {[
                            { step: 'Registration Started', val: '1,240', drop: '0%' },
                            { step: 'Completed Setup', val: '850', drop: '31% drop' },
                            { step: 'First Connection', val: '720', drop: '15% drop' },
                            { step: 'Activated Pro Tier', val: '450', drop: '37% drop' }
                        ].map((s, i) => (
                            <div key={i} className="funnel-step" style={{ opacity: 1 - (i * 0.15), width: `${100 - (i * 10)}%`, margin: '0 auto' }}>
                                <span className="text-xs font-bold text-white uppercase tracking-widest">{s.step}</span>
                                <div className="text-right">
                                    <div className="text-sm font-black font-mono">{s.val}</div>
                                    <div className="text-[8px] font-bold opacity-60 uppercase">{s.drop}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="glass-card">
                    <h4 className="font-black text-sm uppercase tracking-widest opacity-40 mb-6">Retention & Stickiness</h4>
                    <div className="flex flex-col gap-6 mt-12">
                        <div className="flex justify-between items-center p-6 bg-white bg-opacity-5 rounded-3xl">
                            <div>
                                <span className="text-[10px] font-black uppercase opacity-40">Daily Active Hubs</span>
                                <div className="text-4xl font-black text-primary">84%</div>
                            </div>
                            <FiTrendingUp size={32} className="text-primary opacity-30" />
                        </div>
                        <div className="flex justify-between items-center p-6 bg-white bg-opacity-5 rounded-3xl">
                            <div>
                                <span className="text-[10px] font-black uppercase opacity-40">Monthly Active Hubs</span>
                                <div className="text-4xl font-black text-cyan-400">96%</div>
                            </div>
                            <FiActivity size={32} className="text-cyan-400 opacity-30" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderAutomation = () => (
        <div className="report-automation animate-fade-in">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-black lowercase tracking-tighter">automated distributions</h2>
                    <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Scheduled recurring reporting engine</p>
                </div>
                <button className="btn-primary flex items-center gap-2"><FiPlus /> New Schedule</button>
            </div>

            <div className="scheduler-list glass-card p-0 overflow-hidden">
                <table className="ticket-table">
                    <thead>
                        <tr>
                            <th>Distribution Type</th>
                            <th>Frequency</th>
                            <th>Next Run</th>
                            <th>Recipients</th>
                            <th>Status</th>
                            <th className="text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {scheduled.map(s => (
                            <tr key={s.id}>
                                <td className="font-bold">{s.type}</td>
                                <td><span className="badge badge-medium capitalize">{s.frequency}</span></td>
                                <td className="font-mono text-xs opacity-60">{s.last_run}</td>
                                <td>
                                    <div className="flex items-center gap-2">
                                        <FiMail className="opacity-40" />
                                        <span className="text-xs truncate max-w-[150px]">{s.recipients.join(', ')}</span>
                                    </div>
                                </td>
                                <td><span className="text-success text-xs font-black uppercase tracking-widest">Active</span></td>
                                <td className="text-right"><button className="icon-btn hover:text-primary"><FiCalendar /></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <Layout>
            <div className="analytics-page">
                <header className="mb-8 flex justify-between items-start">
                    <div>
                        <h1 className="text-4xl font-black text-primary tracking-tighter lowercase">analytics & reports</h1>
                        <p className="text-secondary font-bold text-sm mt-1 uppercase tracking-widest opacity-60">
                            (Administrative intelligence terminal & KRA reporting bridge)
                        </p>
                    </div>
                    <button className="btn-secondary flex items-center gap-2">
                        <FiDownload /> Unified Export
                    </button>
                </header>

                <div className="hw-tabs mb-8">
                    <button className={`hw-tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Business dashboard</button>
                    <button className={`hw-tab-btn ${activeTab === 'usage' ? 'active' : ''}`} onClick={() => setActiveTab('usage')}>Usage analytics</button>
                    <button className={`hw-tab-btn ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>Financial reports</button>
                    <button className={`hw-tab-btn ${activeTab === 'behavior' ? 'active' : ''}`} onClick={() => setActiveTab('behavior')}>Client behavior</button>
                    <button className={`hw-tab-btn ${activeTab === 'automation' ? 'active' : ''}`} onClick={() => setActiveTab('automation')}>Automated Reports</button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-40">
                        <div className="animate-spin mb-4"><FiTrendingUp size={32} /></div>
                        <p className="font-bold tracking-widest uppercase text-xs">Synchronizing Intelligence Engine...</p>
                    </div>
                ) : (
                    <>
                        {activeTab === 'overview' && renderBusinessDashboard()}
                        {activeTab === 'usage' && renderUsageAnalytics()}
                        {activeTab === 'reports' && renderFinancialReports()}
                        {activeTab === 'behavior' && renderBehavior()}
                        {activeTab === 'automation' && renderAutomation()}
                    </>
                )}
            </div>
        </Layout>
    );
};

export default AnalyticsReports;
