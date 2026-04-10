import React, { useMemo } from 'react';
import { FiCheckCircle, FiAlertCircle, FiActivity } from 'react-icons/fi';
import { Tank, FuelTransaction } from '@/types';

interface WetstockReconciliationProps {
    tanks: Tank[];
    transactions: FuelTransaction[];
    currency: 'USD' | 'KES';
}

export const WetstockReconciliation: React.FC<WetstockReconciliationProps> = ({ tanks, transactions, currency }) => {
    // Mocking reconciliation data for the demo
    const reconData = useMemo(() => {
        const openingStock = tanks.reduce((sum, t) => sum + (t.capacity * 0.4), 0);
        const deliveries = transactions.filter(tx => tx.type === 'delivery').reduce((sum, tx) => sum + tx.amount, 0);
        const dispensed = transactions.filter(tx => tx.type === 'sale').reduce((sum, tx) => sum + tx.amount, 0);
        const measuredClosing = tanks.reduce((sum, t) => sum + (t.currentVolume || 0), 0);

        const expectedClosing = openingStock + deliveries - dispensed;
        const variance = measuredClosing - expectedClosing;
        const variancePct = expectedClosing > 0 ? (variance / expectedClosing) * 100 : 0;
        const varianceCost = Math.abs(variance) * (currency === 'KES' ? 190.50 : 1.45);

        return {
            openingStock,
            deliveries,
            dispensed,
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
        <div className="acp-card mb-6">
            <div className="acp-card-header border-b pb-4 mb-4">
                <div className="acp-card-title">
                    <div className="acp-section-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}><FiCheckCircle /></div>
                    <h3>Wetstock Reconciliation (WRe)</h3>
                </div>
                <div className="text-[10px] font-black px-3 py-1 rounded-md border" style={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.2)', background: 'rgba(16, 185, 129, 0.05)', textTransform: 'uppercase' }}>
                    Recon Score: {reconData.score.toFixed(1)}%
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Opening Stock</span>
                    <span className="text-lg font-black text-slate-800">{reconData.openingStock.toLocaleString()} L</span>
                </div>
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">+ Deliveries</span>
                    <span className="text-lg font-black" style={{ color: '#10b981' }}>+{reconData.deliveries.toLocaleString()} L</span>
                </div>
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">- Dispensed</span>
                    <span className="text-lg font-black" style={{ color: '#ef4444' }}>-{reconData.dispensed.toLocaleString()} L</span>
                </div>
                <div className="bg-white p-4 rounded-xl border-2 border-indigo-100 shadow-sm" style={{ borderColor: 'rgba(124, 58, 237, 0.2)' }}>
                    <span className="text-[10px] font-bold uppercase block mb-1" style={{ color: '#7c3aed' }}>= Expected Closing</span>
                    <span className="text-xl font-black" style={{ color: '#7c3aed' }}>{reconData.expectedClosing.toLocaleString()} L</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-2">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Measured Closing (Physical)</span>
                    <span className="text-xl font-black text-slate-900">{reconData.measuredClosing.toLocaleString()} L</span>
                </div>
            </div>

            <div className="p-5" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', borderRadius: '16px', color: 'white', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, right: 0, padding: '1rem', opacity: 0.1 }}>
                    <FiActivity size={80} />
                </div>
                <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 ${isHealthy ? 'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'}`}>
                            {isHealthy ? <FiCheckCircle size={28} /> : <FiAlertCircle size={28} />}
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Variance Analysis</div>
                            <div className="text-2xl font-black">{reconData.variance.toFixed(1)} L <span className="text-sm font-normal opacity-50 ml-1">({reconData.variancePct.toFixed(2)}%)</span></div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Financial Impact</div>
                        <div className="text-2xl font-black" style={{ color: '#a855f7' }}>
                            {currency} {reconData.varianceCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                    </div>
                </div>

                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
                    <div className="bg-success h-full" style={{ width: '45%' }}></div>
                    <div className="bg-danger h-full" style={{ width: '1%' }}></div>
                    <div className="bg-slate-700 h-full flex-1"></div>
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-slate-500 font-bold font-mono">
                    <span>-0.5% (TOLERANCE)</span>
                    <span>TARGET: 0.00%</span>
                    <span>+0.5% (TOLERANCE)</span>
                </div>
            </div>
        </div>
    );
};
