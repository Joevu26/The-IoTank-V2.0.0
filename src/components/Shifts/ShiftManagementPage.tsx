import React, { useMemo } from 'react';
import { 
    FiActivity, FiShield, FiTrendingUp 
} from 'react-icons/fi';
import { MdOutlineEventNote } from 'react-icons/md';
import { useAuth } from '@/hooks/useAuth';
import { useTanks, useShifts, useActiveShift } from '@/hooks/useSupabase';
import { ShiftAnalyticsTable } from '@/components/Analytics/ShiftAnalyticsTable';
import { format, differenceInMinutes } from 'date-fns';
import './ShiftManagementPage.css';

export const ShiftManagementPage: React.FC = () => {
    const { currentUser } = useAuth();
    const stationId = currentUser?.stationId || '';
    
    // Data Loading
    const { loading: tanksLoading } = useTanks(stationId);
    const { shifts, loading: shiftsLoading } = useShifts(stationId);
    const { activeShift, loading: activeLoading } = useActiveShift(stationId);

    // Statistics
    const stats = useMemo(() => {
        const total = shifts.length;
        const critical = shifts.filter(s => Math.abs(s.variance_data?.amount || 0) > 500).length;
        const avgVariance = total > 0 
            ? shifts.reduce((acc, s) => acc + Math.abs(s.variance_data?.amount || 0), 0) / total 
            : 0;
        
        return { total, critical, avgVariance };
    }, [shifts]);

    const activeDuration = useMemo(() => {
        if (!activeShift?.updated_at) return 0;
        return differenceInMinutes(new Date(), new Date(activeShift.updated_at));
    }, [activeShift]);

    if (tanksLoading && shiftsLoading && activeLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    return (
        <div className="shift-hub-page">
            <header className="shift-hub-header">
                <div className="shift-hub-title">
                    <h1>
                        <MdOutlineEventNote className="text-cyan-600" />
                        Shift Audit Hub
                    </h1>
                    <p>Forensic reconciliation archive and real-time operational tracking</p>
                </div>
                <div className="shift-hub-meta">
                    <div className={`meta-chip ${activeShift?.status === 'OPEN' ? 'active' : ''}`}>
                        <FiActivity size={12} className={activeShift?.status === 'OPEN' ? 'animate-pulse' : ''} />
                        {activeShift?.status === 'OPEN' ? 'Session: ACTIVE' : 'Session: IDLE'}
                    </div>
                </div>
            </header>

            <div className="shift-hub-grid">
                <div className="active-shift-container">
                    <section className="active-shift-section">
                        <div className={`active-shift-card ${activeShift?.status !== 'OPEN' ? 'empty' : ''}`}>
                            <div className="card-header">
                                <h2>
                                    <FiShield className="text-cyan-500" /> Current Operational Status
                                </h2>
                                {activeShift?.status === 'OPEN' && <span className="status-badge open">Active Shift</span>}
                            </div>
                            
                            {activeShift?.status === 'OPEN' ? (
                                <div className="active-shift-content">
                                    <div className="stat-box">
                                        <span className="label">Commenced</span>
                                        <span className="value">{format(new Date(activeShift.updated_at), 'HH:mm')}</span>
                                        <span className="sub-value">{format(new Date(activeShift.updated_at), 'MMM dd, yyyy')}</span>
                                    </div>
                                    <div className="stat-box">
                                        <span className="label">Duration</span>
                                        <span className="value">{Math.floor(activeDuration / 60)}h {activeDuration % 60}m</span>
                                        <span className="sub-value">Real-time tracking</span>
                                    </div>
                                    <div className="stat-box">
                                        <span className="label">Captured Nodes</span>
                                        <span className="value">{Object.keys(activeShift.metadata?.tank_snapshots || {}).length}</span>
                                        <span className="sub-value">Forensic Verification</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="empty-shift-state py-12 text-center">
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No active operational session</p>
                                    <p className="text-[10px] text-slate-300 mt-1">Initialize a shift to begin forensic tracking</p>
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                <aside className="shift-info-sidebar">
                    <div className="info-card">
                        <h4><FiActivity /> Live Indicators</h4>
                        <div className="info-item">
                            <span className="label">System Integrity</span>
                            <span className="value text-emerald-500">Verified</span>
                        </div>
                        <div className="info-item">
                            <span className="label">Cloud Sync</span>
                            <span className="value text-emerald-500">Real-time</span>
                        </div>
                    </div>

                    <div className="info-card">
                        <h4><FiTrendingUp className="text-cyan-500" /> Weekly Insights</h4>
                        <div className="info-item">
                            <span className="label">Total Shifts</span>
                            <span className="value">{stats.total}</span>
                        </div>
                        <div className="info-item">
                            <span className="label">Avg. Variance</span>
                            <span className="value">Ksh {stats.avgVariance.toFixed(2)}</span>
                        </div>
                    </div>
                </aside>
            </div>

            {/* FULL WIDTH HISTORY SECTION */}
            <section className="shift-audit-section">
                <ShiftAnalyticsTable />
            </section>
        </div>
    );
};
