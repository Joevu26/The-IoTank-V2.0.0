import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
    FiUsers, FiActivity, FiAlertCircle, FiTrendingUp, FiSettings,
    FiArrowRight, FiShield, FiClock, FiMapPin, FiDatabase,
    FiCpu, FiGrid, FiGlobe, FiServer, FiHardDrive, FiMessageSquare,
    FiCheckCircle, FiPieChart, FiDollarSign, FiZap,
    FiUserPlus, FiEdit3, FiBell, FiRefreshCw, FiSend,
    FiLifeBuoy, FiAlertTriangle, FiCommand, FiCheck, FiLock
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { dashboardService } from '../services/dashboardService';
import type { DashboardStats } from '../services/dashboardService';
import './Dashboard.css';

const Dashboard = () => {
    const { systemUser } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await dashboardService.getPlatformStats();
                setStats(data);
            } catch (err) {
                console.error("Dashboard Sync Error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
            maximumFractionDigits: 0
        }).format(val);
    };

    if (loading) {
        return (
            <Layout>
                <div className="p-8 flex items-center justify-center min-h-[60vh]">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm font-black text-indigo-600 uppercase tracking-widest">establishing mission sync...</p>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="dashboard-container">
                
                {/* 1. Mission Control Hero - Grid Area 'h' */}
                <div className="mission-control-hero">
                    <div className="hero-content">
                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.22em] mb-4">global command center v2.4.1</p>
                        <h1 className="tracking-tight">Mission Control</h1>
                        
                        <div className="flex items-center gap-6 mt-8">
                            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-2.5 rounded-full shadow-sm">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-[11px] font-black uppercase tracking-wider">Systems Operational</span>
                            </div>
                            
                            <div className="flex items-center gap-2 text-slate-400">
                                <div className="flex -space-x-2">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="w-9 h-9 rounded-full border-2 border-white bg-slate-100 shadow-sm flex items-center justify-center text-[10px] font-bold text-slate-400 overflow-hidden">
                                            <FiUsers size={14} />
                                        </div>
                                    ))}
                                </div>
                                <span className="text-[11px] font-bold uppercase tracking-wide ml-3 border-l border-slate-200 pl-3">
                                    {stats?.health?.totalOperators || 0} active nodes
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="hidden xl:flex gap-16 items-center pr-8">
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nairobi Hub</p>
                            <p className="text-2xl font-black text-slate-900 tracking-tighter">{stats?.health?.queryLatency || '24ms'}</p>
                            <span className="text-[9px] text-emerald-500 font-black tracking-widest">OPTIMAL SYNC</span>
                        </div>
                        <div className="h-14 w-[1px] bg-slate-100"></div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">SLA Uptime</p>
                            <p className="text-2xl font-black text-slate-900 tracking-tighter">{stats?.health?.uptime || '99.9%'}</p>
                            <span className="text-[9px] text-indigo-500 font-black tracking-widest">TARGET: 100%</span>
                        </div>
                    </div>
                </div>

                {/* 2. System Health Bento Grid - Grid Area 's' */}
                <div className="health-grid-bento">
                    <div className="health-status-card-v2">
                        <p className="health-label-v2">Active User Base</p>
                        <h2 className="health-value-v2">{stats?.health?.totalUsers || 0}</h2>
                        <div className="integrity-container">
                            <div className="integrity-label-small">
                                <span>Platform Reach</span>
                                <span>100% Encrypted</span>
                            </div>
                            <div className="integrity-bar-bg"><div className="integrity-bar-fill" style={{ width: '85%' }}></div></div>
                        </div>
                    </div>

                    <div className="health-status-card-v2">
                        <p className="health-label-v2">Total IoT Assets</p>
                        <h2 className="health-value-v2 text-indigo-600">{stats?.health?.espDevices?.total || 0}</h2>
                        <div className="integrity-container">
                            <div className="integrity-label-small">
                                <span>Online Integrity</span>
                                <span>{Math.round(((stats?.health?.espDevices?.online || 0) / (stats?.health?.espDevices?.total || 1)) * 100)}% active</span>
                            </div>
                            <div className="integrity-bar-bg">
                                <div className="integrity-bar-fill" style={{ width: `${((stats?.health?.espDevices?.online || 0) / (stats?.health?.espDevices?.total || 1)) * 100}%` }}></div>
                            </div>
                        </div>
                    </div>

                    <div className="health-status-card-v2">
                        <p className="health-label-v2">Fleet Monitoring</p>
                        <h2 className="health-value-v2">{stats?.health?.totalStations || 0}</h2>
                        <div className="integrity-container">
                            <div className="integrity-label-small">
                                <span>Managed Stations</span>
                                <span>24/7 Monitoring</span>
                            </div>
                            <div className="integrity-bar-bg"><div className="integrity-bar-fill bg-emerald-500" style={{ width: '100%' }}></div></div>
                        </div>
                    </div>
                </div>

                {/* 3. Command Center - Grid Area 'q' */}
                <div className="command-center-bar shadow-2xl">
                    <p className="command-title"><FiCommand /> Command Center</p>
                    <div className="flex flex-col gap-3">
                        {[
                            { title: 'Approve Registrations', desc: 'Process access requests', icon: <FiCheck />, path: '/registrations' },
                            { title: 'Emergency Protocols', desc: 'Alerts & tickets', icon: <FiAlertCircle />, path: '/support' },
                            { title: 'Data Sovereignty', desc: 'Full audit trails', icon: <FiLock />, path: '/logs' },
                            { title: 'Broadcast Relay', desc: 'Global announcements', icon: <FiGlobe />, path: '/announcements' }
                        ].map((cmd, i) => (
                            <button key={i} onClick={() => navigate(cmd.path)} className="cmd-btn">
                                <div className="cmd-icon">{cmd.icon}</div>
                                <div className="cmd-details">
                                    <p className="title">{cmd.title}</p>
                                    <p className="desc">{cmd.desc}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 4. Financial Command Area - Grid Area 'f' */}
                <div className="financial-bento-area">
                    <div className="fin-card-premium accent">
                        <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-4">Platform Recurring Revenue</p>
                        <h3 className="text-5xl font-black mb-6 tracking-tighter">{formatCurrency(stats?.financial?.mrr || 0)}</h3>
                        <div className="mt-auto flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase tracking-wider bg-emerald-400/10 w-fit px-3 py-1.5 rounded-full">
                            <FiTrendingUp /> 12.5% increase
                        </div>
                    </div>
                    
                    <div className="fin-card-premium border-rose-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Outstanding Receivables</p>
                        <h3 className="text-4xl font-black text-rose-600 mb-6 tracking-tighter">{formatCurrency(stats?.financial?.outstandingDebt || 0)}</h3>
                        <div className="mt-auto flex items-center gap-2 text-rose-500 text-[10px] font-black uppercase tracking-wider bg-rose-50 w-fit px-3 py-1.5 rounded-full">
                            <FiAlertCircle /> Priority collection
                        </div>
                    </div>

                    <div className="fin-card-premium col-span-2">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-1">Volatility Monitor</p>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Anomaly detection engine active</p>
                            </div>
                            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
                                <FiActivity size={20} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-10">
                            <div>
                                <p className="text-[10px] font-black text-emerald-600 uppercase mb-4 flex items-center gap-2 border-b border-emerald-100 pb-2"><FiTrendingUp /> Positive Drifts</p>
                                <div className="space-y-4">
                                    {(stats?.financial?.billChanges?.increased || []).slice(0, 2).map((c: any, i: number) => (
                                        <div key={i} className="flex justify-between items-center group">
                                            <span className="text-[11px] font-bold text-slate-600 group-hover:text-slate-900 transition-colors">{c.station_name}</span>
                                            <span className="text-[11px] font-black text-emerald-600">+{c.percentage.toFixed(1)}%</span>
                                        </div>
                                    ))}
                                    {(!stats?.financial?.billChanges?.increased?.length) && <p className="text-[10px] text-slate-400 italic">Stable</p>}
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-rose-500 uppercase mb-4 flex items-center gap-2 border-b border-rose-100 pb-2"><FiTrendingUp className="rotate-180" /> Negative Drifts</p>
                                <div className="space-y-4">
                                    {(stats?.financial?.billChanges?.decreased || []).slice(0, 2).map((c: any, i: number) => (
                                        <div key={i} className="flex justify-between items-center group">
                                            <span className="text-[11px] font-bold text-slate-600 group-hover:text-slate-900 transition-colors">{c.station_name}</span>
                                            <span className="text-[11px] font-black text-rose-600">{c.percentage.toFixed(1)}%</span>
                                        </div>
                                    ))}
                                    {(!stats?.financial?.billChanges?.decreased?.length) && <p className="text-[10px] text-slate-400 italic">No outliers</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 5. Support & activity - Grid Areas 'o' and 'a' */}
                <div className="ops-grid-wrapper">
                    <section className="bg-white rounded-[28px] p-10 shadow-xl border border-slate-100 h-full">
                        <div className="flex justify-between items-center mb-10">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                                    <FiActivity size={24} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">Platform Operations</h2>
                                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Real-time engagement metrics</p>
                                </div>
                            </div>
                            <button onClick={() => navigate('/support')} className="btn btn-secondary text-[11px] font-black text-slate-600 uppercase tracking-widest bg-slate-50 border-slate-100 hover:bg-slate-100 px-6 py-3 rounded-xl transition-all">
                                Full Queue
                            </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                            {[
                                { title: 'Open Tickets', val: stats?.support?.openTickets, icon: <FiLifeBuoy />, color: 'text-sky-500', bg: 'bg-sky-50' },
                                { title: 'Urgent Incidents', val: stats?.support?.urgentTickets, icon: <FiAlertTriangle />, color: 'text-rose-500', bg: 'bg-rose-50' },
                                { title: 'Access Requests', val: stats?.support?.pendingRequests, icon: <FiUserPlus />, color: 'text-indigo-500', bg: 'bg-indigo-50' },
                                { title: 'Billing Audits', val: stats?.support?.pendingAdjustments, icon: <FiEdit3 />, color: 'text-amber-500', bg: 'bg-amber-50' }
                            ].map((card, i) => (
                                <div key={i} className="flex flex-col items-center p-6 rounded-3xl border border-slate-50 bg-slate-50/50 group hover:bg-white hover:shadow-2xl hover:border-indigo-100 transition-all cursor-default">
                                    <div className={`w-14 h-14 rounded-[20px] ${card.bg} ${card.color} flex items-center justify-center mb-5 shadow-sm group-hover:scale-110 transition-transform`}>
                                        {card.icon}
                                    </div>
                                    <p className="text-[11px] font-black text-slate-400 uppercase text-center mb-6 min-h-[32px] leading-tight px-2 tracking-tight">{card.title}</p>
                                    <span className={`text-5xl font-black ${card.color} tracking-tighter`}>{card.val || 0}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="audit-feed-wrapper">
                    <section className="bg-white rounded-[28px] p-8 shadow-xl border border-slate-100 h-full flex flex-col">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-3">
                                <FiActivity className="text-indigo-600 animate-pulse" /> Live Audit Feed
                            </h2>
                            <div className="p-2 rounded-xl bg-indigo-50 shadow-inner">
                                <FiRefreshCw className="text-indigo-600 animate-spin-slow" size={14} />
                            </div>
                        </div>
                        <div className="flex flex-col gap-4 max-h-[480px] overflow-y-auto custom-scrollbar pr-2 flex-grow">
                            {(stats?.recentActivity || []).map((event: any, i: number) => (
                                <div key={i} className="flex items-start gap-5 p-4 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group cursor-pointer shadow-sm hover:shadow-md">
                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                                        {event.type === 'registration' ? <FiUserPlus size={16} /> : <FiZap size={16} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[12px] font-bold text-slate-800 leading-snug mb-1.5 group-hover:text-indigo-600 transition-colors">{event.text}</p>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <FiClock size={10} /> {event.time} <span className="opacity-30">•</span> REF-ID: {event.id.slice(-6).toUpperCase()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {(!stats?.recentActivity?.length) && (
                                <div className="flex flex-col items-center justify-center h-full py-20 text-slate-300">
                                    <FiActivity size={40} className="mb-4 opacity-20" />
                                    <p className="text-xs font-black uppercase tracking-widest">No Recent Activity</p>
                                </div>
                            )}
                        </div>
                        <button className="mt-8 text-[11px] font-black text-indigo-600 uppercase tracking-widest hover:underline text-center w-full pb-2">
                            View Historical Logs
                        </button>
                    </section>
                </div>

            </div>
        </Layout>
    );
};

export default Dashboard;
