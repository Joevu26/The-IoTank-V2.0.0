import React from 'react';
import { FiShield, FiActivity } from 'react-icons/fi';
import '../Common/DesignSystemCards.css';

interface SystemIntegrityCardProps {
    stationId: string;
}

export const SystemIntegrityCard: React.FC<SystemIntegrityCardProps> = ({ stationId }) => {
    return (
        <div className="ds-card ds-card-panel p-6 h-full flex flex-col justify-between group hover:border-emerald-200 transition-all duration-300">
            <div className="flex-1">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-50 text-emerald-500 rounded-xl shadow-sm border border-emerald-100 group-hover:scale-110 transition-transform">
                            <FiShield size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest">System Integrity</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Data Trust Protocol</p>
                        </div>
                    </div>
                </div>

                <div className="mb-6">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Confidence Score</span>
                        <span className="text-sm font-black text-emerald-600">94%</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full" style={{ width: '94%' }}></div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2">
                            <FiActivity size={14} className="text-slate-400" />
                            <span className="text-xs font-bold text-slate-600">Gateway Status</span>
                        </div>
                        <span className="text-xs font-black text-emerald-600 bg-emerald-100/50 px-2.5 py-1 rounded-lg border border-emerald-200">ACTIVE</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Encryption Layer</span>
                            <span className="text-[11px] font-black text-slate-700">AES-256</span>
                        </div>
                        <div className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Latency</span>
                            <span className="text-[11px] font-black text-slate-700">38ms</span>
                        </div>
                    </div>

                    <div className="p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Firmware Baseline</span>
                            <span className="text-[10px] font-black text-slate-700">v2.1.4-Stable</span>
                        </div>
                        <div className="text-[10px] font-medium text-slate-400 truncate">{stationId}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
