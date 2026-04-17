import React, { useMemo } from 'react';
import { FiCheckCircle, FiAlertCircle, FiActivity } from 'react-icons/fi';
import { Tank, FuelTransaction } from '@/types';

interface WetstockReconciliationProps {
    tanks: Tank[];
    transactions: FuelTransaction[];
    currency: 'Ksh';
}

export const WetstockReconciliation: React.FC<WetstockReconciliationProps> = ({ tanks, transactions, currency }) => {
    // Mocking reconciliation data for the demo
    const reconData = useMemo(() => {
        // [ONE TRUTH]: Opening stock is derived from the active shift snapshot
        const startVolumes = JSON.parse(localStorage.getItem('iotank_shift_start_volumes') || '{}');
        const openingStock = tanks.reduce((sum, t) => sum + (startVolumes[t.id] || t.currentVolume || 0), 0);
        
        // Deliveries and Sales from transactions for "Expected" profile
        const deliveries = transactions.filter(tx => tx.type === 'delivery').reduce((sum, tx) => sum + tx.amount, 0);
        const transactionalSales = transactions.filter(tx => tx.type === 'sale').reduce((sum, tx) => sum + tx.amount, 0);
        
        // Measured Closing (Live Telemetry)
        const measuredClosing = tanks.reduce((sum, t) => sum + (t.currentVolume || 0), 0);

        // [TELEMETRIC DELTA]: As requested, 'Dispensed' shown in UI follows telemetry
        const dispensedTelemetric = Math.max(0, openingStock - measuredClosing);
        
        // Reconciliation: Reality (Measured) vs Expected (Opening + Deliveries - Transactions)
        const expectedClosing = openingStock + deliveries - transactionalSales;
        const variance = measuredClosing - expectedClosing;
        const variancePct = expectedClosing > 0 ? (variance / expectedClosing) * 100 : 0;
        const varianceCost = Math.abs(variance) * (currency === 'Ksh' ? 190.50 : 1.45);

        return {
            openingStock,
            deliveries,
            dispensed: dispensedTelemetric, // Telemetrically derived
            expectedClosing,
            measuredClosing,
            variance,
            variancePct,
            varianceCost,
            score: Math.max(0, 100 - Math.abs(variancePct) * 50)
        };
    }, [tanks, transactions, currency]);

    const isHealthy = Math.abs(reconData.variancePct) < 0.5;

    return (
        <div className="acp-card mb-4 !p-4">
            <div className="acp-card-header border-b border-slate-100 pb-3 mb-3">
                <div className="acp-card-title !gap-2">
                    <div className="acp-section-icon !w-7 !h-7 !text-sm wre-icon-container"><FiCheckCircle /></div>
                    <h3 className="!text-sm">Wetstock Reconciliation (WRe)</h3>
                </div>
                <div className="wre-score-badge !px-2 !py-0.5 !text-[9px]">
                    Score: {reconData.score.toFixed(1)}%
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
                <div className="bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[9px] text-slate-500 font-bold uppercase block mb-0.5">Opening</span>
                    <span className="text-sm font-black text-slate-800">{reconData.openingStock.toLocaleString()} L</span>
                </div>
                <div className="bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[9px] text-slate-500 font-bold uppercase block mb-0.5">+ Deliveries</span>
                    <span className="text-sm font-black text-emerald-600">{reconData.deliveries.toLocaleString()} L</span>
                </div>
                <div className="bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[9px] text-slate-500 font-bold uppercase block mb-0.5">- Dispensed</span>
                    <span className="text-sm font-black text-rose-600">{reconData.dispensed.toLocaleString()} L</span>
                </div>
                <div className="bg-indigo-50/30 p-2 rounded-lg border border-indigo-100/50">
                    <span className="text-[9px] text-indigo-500 font-bold uppercase block mb-0.5">= Expected</span>
                    <span className="text-sm font-black text-indigo-700">{reconData.expectedClosing.toLocaleString()} L</span>
                </div>
            </div>

            <div className="wre-summary-panel !p-3 bg-slate-50/30 border border-slate-200/50 rounded-xl relative overflow-hidden">
                <div className="wre-summary-icon-bg !opacity-5">
                    <FiActivity size={60} />
                </div>
                
                <div className="flex items-center justify-between mb-3 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${isHealthy ? 'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'}`}>
                            {isHealthy ? <FiCheckCircle size={20} /> : <FiAlertCircle size={20} />}
                        </div>
                        <div>
                            <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Variance</div>
                            <div className="text-lg font-black leading-none">{reconData.variance.toFixed(1)} L <span className="text-[10px] font-bold opacity-60 ml-1">{reconData.variancePct.toFixed(2)}%</span></div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Fin. Impact</div>
                        <div className="text-lg font-black text-slate-700">
                            {currency} {reconData.varianceCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                    </div>
                </div>

                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden flex">
                    <div 
                        className="wre-progress-success h-full" 
                        style={{ width: '45%' }}
                    ></div>
                    <div 
                        className="wre-progress-danger h-full" 
                        style={{ width: '1%' }}
                    ></div>
                </div>
                <div className="flex justify-between mt-1.5 text-[8px] text-slate-500 font-bold uppercase tracking-tighter">
                    <span>-0.5% Tol</span>
                    <span>Target: 0.00%</span>
                    <span>+0.5% Tol</span>
                </div>
            </div>
        </div>
    );
};
