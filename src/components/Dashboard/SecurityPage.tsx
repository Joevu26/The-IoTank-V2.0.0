import React from 'react';
import { LossRadar } from '../Dashboard/LossRadar';
import { PageHeader } from '../Common/PageHeader';
import { FiShield, FiTrendingUp, FiActivity } from 'react-icons/fi';

const SecurityPage: React.FC = () => {
    return (
        <div className="security-page-container p-8 max-w-7xl mx-auto">
            <PageHeader 
                title="Forensic Security & Volatility"
                description="Real-time variance detection and nocturnal loss monitoring"
                action={
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                        <span className="flex items-center gap-1"><FiActivity className="text-emerald-500" /> System Live</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span className="flex items-center gap-1"><FiShield className="text-primary" /> Forensic Shield Active</span>
                    </div>
                }
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
                {/* Main Radar Card */}
                <div className="lg:col-span-8">
                    <LossRadar />
                </div>

                {/* Security Metrics Sidebar */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="ds-card p-6 bg-slate-900 border-slate-800 text-white">
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-4 text-slate-400">Security Status</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Node Integrity</span>
                                <span className="text-emerald-400 font-bold">100%</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Variance Threshold</span>
                                <span className="text-amber-400 font-bold">0.5% (Strict)</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Last Pattern Audit</span>
                                <span className="text-slate-300">2h ago</span>
                            </div>
                        </div>
                    </div>

                    <div className="ds-card p-6 border-amber-500/20 bg-amber-500/5">
                        <div className="flex items-center gap-2 mb-4">
                            <FiTrendingUp className="text-amber-600" />
                            <h3 className="text-sm font-black uppercase tracking-widest text-amber-800">Observation Mode</h3>
                        </div>
                        <p className="text-xs leading-relaxed text-amber-900/70">
                            The Volatility Radar is currently monitoring Site A for rhythmic overnight drawdowns.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SecurityPage;
