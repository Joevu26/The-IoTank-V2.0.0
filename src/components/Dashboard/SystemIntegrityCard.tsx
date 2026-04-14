import React from 'react';
import { FiShield, FiActivity, FiLock, FiCpu } from 'react-icons/fi';
import './SystemIntegrityCard.css';

interface SystemIntegrityCardProps {
    stationId: string;
}

export const SystemIntegrityCard: React.FC<SystemIntegrityCardProps> = ({ stationId }) => {
    return (
        <div className="ds-card ds-card-panel protocol-guard-card p-6 h-full flex flex-col justify-between group">
            <div className="flex-1">
                {/* Header Section with Pulse Effect */}
                <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center">
                        <div className="guard-pulse-core">
                            <div className="pulse-ring"></div>
                            <div className="pulse-ring"></div>
                            <div className="guard-icon-box">
                                <FiShield size={24} />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Protocol Guard</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <FiLock size={10} className="text-emerald-500" />
                                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">TLS 1.3 | AES-256</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-100 shadow-sm">
                        <div className="status-active-glow"></div>
                        <span className="text-[9px] font-black text-emerald-700 uppercase tracking-tighter">SECURE</span>
                    </div>
                </div>

                {/* Trust Metrics Section */}
                <div className="mb-10">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">System Trust Index</span>
                            <div className="h-0.5 w-8 bg-emerald-100/50"></div>
                        </div>
                        <span className="text-2xl font-black text-emerald-600 tabular-nums tracking-tighter">99.98%</span>
                    </div>
                    <div className="h-4 bg-slate-100/80 rounded-2xl overflow-hidden p-1 border border-slate-200/50 shadow-inner">
                        <div className="h-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 rounded-xl shadow-lg relative">
                            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.4)_50%,transparent_100%)] animate-[shimmer_2s_infinite]"></div>
                        </div>
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-2.5 tracking-widest text-right italic">Optimized for Ultra-Low Latency</p>
                </div>

                {/* HUD Grid Section */}
                <div className="grid gap-4">
                    <div className="security-hud-metric">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-emerald-100/50 rounded-lg">
                                    <FiActivity size={14} className="text-emerald-600" />
                                </div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Latency Matrix</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
                                <span className="text-[9px] font-black text-emerald-600">LIVE SYNC</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Global Response</p>
                                <p className="text-base font-black text-slate-800 tracking-tight">8.42ms <span className="text-[8px] text-emerald-500">▼ 0.2%</span></p>
                            </div>
                            <div className="h-8 w-px bg-slate-100"></div>
                            <div className="text-right">
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Validation Hub</p>
                                <p className="text-base font-black text-slate-800 tracking-tight">Node-Beta-IX</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="security-hud-metric border-emerald-100/30">
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                                <FiCpu size={12} className="text-slate-400" />
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Network Identity Blueprint</span>
                            </div>
                            <span className="text-[9px] font-black text-slate-400 opacity-60">PRO.v2</span>
                        </div>
                        <div className="terminal-id-box">
                            <span className="truncate max-w-[180px]">IOTANK_NODE_IDENTITY://</span>
                            <span className="glitch-text">{stationId ? stationId.substring(0, 12).toUpperCase() : 'NO_ID_INIT'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
