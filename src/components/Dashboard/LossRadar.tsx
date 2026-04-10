import React, { useState, useEffect } from 'react';
import { FiCrosshair, FiAlertTriangle, FiArrowRight } from 'react-icons/fi';
import { TodayVarianceReviewPanel } from './TodayVarianceReviewPanel';
import '../Common/DesignSystemCards.css';

export const LossRadar: React.FC = () => {
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [lossData, setLossData] = useState(() => {
        try {
            const stored = localStorage.getItem('iotank_latest_loss_data');
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });

    useEffect(() => {
        const handleShiftChange = () => {
            const stored = localStorage.getItem('iotank_latest_loss_data');
            setLossData(stored ? JSON.parse(stored) : null);
        };
        window.addEventListener('iotank_shift_changed', handleShiftChange);
        return () => window.removeEventListener('iotank_shift_changed', handleShiftChange);
    }, []);

    // Defensive fallback
    const dataToUse = lossData || {
        pumpSales: 0,
        tankDrawdown: 0,
        difference: 0,
        estimatedValueKes: 0,
        dataConfidence: 100
    };

    return (
        <>
            <div className="ds-card ds-card-panel p-6 h-full flex flex-col justify-between group hover:border-rose-200 transition-all duration-300">
                <div className="flex-1">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-rose-50 text-rose-500 rounded-xl shadow-sm border border-rose-100 group-hover:scale-110 transition-transform">
                                <FiCrosshair size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest">Loss Radar</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Variance Intelligence</p>
                            </div>
                        </div>
                        <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full uppercase tracking-widest border border-slate-200">Today</span>
                    </div>

                    <div className="mb-6 px-1">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Unexplained Loss</div>
                        <div className="flex items-baseline gap-3">
                            <span className={`text-3xl font-black tracking-tight ${dataToUse.difference < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {dataToUse.difference > 0 ? '+' : ''}{(dataToUse.difference || 0).toFixed(1)}L
                            </span>
                            <span className="text-sm font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                                KES {Math.abs(dataToUse.estimatedValueKes || 0).toLocaleString()}
                            </span>
                        </div>
                    </div>

                    <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 mb-6 relative overflow-hidden group/cause">
                        <div className="absolute top-0 right-0 p-2 opacity-5">
                            <FiAlertTriangle size={40} />
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Top Suspected Cause</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                <span className="text-sm font-bold text-slate-700 block mb-0.5">Reconciliation Gap</span>
                                <span className="text-[11px] text-slate-400 font-medium">Last shift closure anomaly</span>
                            </div>
                            <div className="text-right">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Confidence</span>
                                <span className="text-xs font-black bg-amber-100 text-amber-700 px-2.5 py-1 rounded-lg border border-amber-200">
                                    {(dataToUse.dataConfidence || 0)}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    className="w-full py-4 px-4 rounded-xl font-extrabold text-sm transition-all duration-300
                               bg-white border-2 border-slate-100 text-slate-600 
                               hover:bg-slate-900 hover:text-white hover:border-slate-900
                               flex justify-center items-center gap-3 shadow-sm uppercase tracking-widest group/btn"
                    onClick={() => setIsPanelOpen(true)}
                >
                    Open Analysis <FiArrowRight className="group-hover/btn:translate-x-1 transition-transform" />
                </button>
            </div>

            {isPanelOpen && (
                <TodayVarianceReviewPanel
                    onClose={() => setIsPanelOpen(false)}
                    varianceData={dataToUse}
                    onReviewComplete={(data) => {
                        console.log('Variance Review Submitted:', data);
                    }}
                />
            )}
        </>
    );
};
