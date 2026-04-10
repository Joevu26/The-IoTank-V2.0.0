import React, { useState, useEffect } from 'react';
import { FiTruck, FiCheckCircle, FiArrowRight } from 'react-icons/fi';
import { DeliveryReconciliationForm } from './DeliveryReconciliationForm';
import '../Common/DesignSystemCards.css';

export const DeliveryVerification: React.FC = () => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [lastDelivery, setLastDelivery] = useState(() => {
        try {
            const stored = localStorage.getItem('iotank_last_delivery_result');
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });

    useEffect(() => {
        const handleDelivery = () => {
            const stored = localStorage.getItem('iotank_last_delivery_result');
            setLastDelivery(stored ? JSON.parse(stored) : null);
        };
        window.addEventListener('iotank_delivery_reconciled', handleDelivery);
        return () => window.removeEventListener('iotank_delivery_reconciled', handleDelivery);
    }, []);

    // Defensive fallback
    const displayData = lastDelivery || {
        tankName: 'No recent data',
        expectedVolume: 0,
        actualVolume: 0,
        variance: 0,
        timestamp: new Date().toISOString()
    };

    const isNegative = displayData.variance < 0;

    return (
        <>
            <div className="ds-card ds-card-panel p-6 h-full flex flex-col justify-between group hover:border-blue-200 transition-all duration-300">
                <div className="flex-1">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-50 text-blue-500 rounded-xl shadow-sm border border-blue-100 group-hover:scale-110 transition-transform">
                                <FiTruck size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest">Delivery Verification</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Physical vs Digital Audit</p>
                            </div>
                        </div>
                        <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full uppercase tracking-widest border border-slate-200">Last 24h</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Expected</span>
                            <span className="text-xl font-black text-slate-700 tracking-tight">{(displayData.expectedVolume || 0).toLocaleString()}L</span>
                        </div>
                        <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Actual</span>
                            <span className="text-xl font-black text-slate-700 tracking-tight">{(displayData.actualVolume || 0).toLocaleString()}L</span>
                        </div>
                    </div>

                    <div className={`rounded-2xl p-5 mb-6 relative overflow-hidden ${isNegative ? 'bg-amber-50/50 border border-amber-100' : 'bg-emerald-50/50 border border-emerald-100'}`}>
                        <div className="flex items-center justify-between relative z-10">
                            <div>
                                <span className={`text-[10px] font-black uppercase tracking-widest block mb-1 ${isNegative ? 'text-amber-500' : 'text-emerald-500'}`}>Cumulative Variance</span>
                                <span className={`text-2xl font-black tracking-tighter ${isNegative ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {isNegative ? '' : '+'}{(displayData.variance || 0).toFixed(1)}L
                                </span>
                            </div>
                            <div className={`p-2 rounded-lg ${isNegative ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                <FiCheckCircle size={24} />
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    className="w-full py-4 px-4 rounded-xl font-extrabold text-sm transition-all duration-300
                               bg-white border-2 border-slate-100 text-slate-600 
                               hover:bg-slate-900 hover:text-white hover:border-slate-900
                               flex justify-center items-center gap-3 shadow-sm uppercase tracking-widest group/btn"
                    onClick={() => setIsFormOpen(true)}
                >
                    Reconcile Delivery <FiArrowRight className="group-hover/btn:translate-x-1 transition-transform" />
                </button>
            </div>

            {isFormOpen && (
                <DeliveryReconciliationForm
                    onClose={() => setIsFormOpen(false)}
                    deliveryData={{
                        invoiceVolume: displayData.expectedVolume || 0,
                        measuredStandardized: displayData.actualVolume || 0,
                        variance: displayData.variance || 0,
                        tolerance: 50,
                        status: 'Needs Review'
                    }}
                    onSubmit={(res: any) => {
                        console.log('Reconciliation Success:', res);
                    }}
                />
            )}
        </>
    );
};
