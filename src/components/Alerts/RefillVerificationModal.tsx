import React, { useState } from 'react';
import { supabase } from '@/config/supabase';
import { FiCheck, FiX, FiTruck } from 'react-icons/fi';
import { Alert } from '@/types';

interface RefillVerificationModalProps {
    alert: Alert;
    orgId: string;
    onClose: () => void;
}

export const RefillVerificationModal: React.FC<RefillVerificationModalProps> = ({ alert: alertProp, orgId: _orgId, onClose }) => {
    const [deliveredVolume, setDeliveredVolume] = useState<number>(alertProp.metadata?.deliveredVolume || 0);
    const [stockPrice, setStockPrice] = useState<number>(190.50); // Kenya Diesel Price example
    const [processing, setProcessing] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        try {
            // 1. Mark alert as resolved
            const { error: alertError } = await supabase
                .from('alerts')
                .update({
                    is_resolved: true,
                    resolved_at: new Date().toISOString(),
                    metadata: {
                        ...alertProp.metadata,
                        verificationData: {
                            physicalVolume: deliveredVolume,
                            stockPrice,
                            variance: deliveredVolume - (alertProp.metadata?.atgVolume || 0)
                        }
                    }
                })
                .eq('id', alertProp.id);

            if (alertError) throw alertError;

            // 2. Update transaction (if exists)
            const txnId = 'txn-refill-live'; // Standard live feed ID
            const { error: txnError } = await supabase
                .from('fuel_transactions')
                .update({
                    amount: deliveredVolume,
                    metadata: {
                        ...alertProp.metadata,
                        physicalVolume: deliveredVolume,
                        pricePerLiter: stockPrice,
                        totalCost: deliveredVolume * stockPrice,
                        variance: deliveredVolume - (alertProp.metadata?.atgVolume || 0),
                        varianceStatus: 'VERIFIED'
                    }
                })
                .eq('id', txnId);

            if (txnError) {
                console.warn('Transaction update failed (may not exist yet):', txnError);
            }
            window.alert(`Reconciliation Successful!\n\nVolume: ${deliveredVolume}L\nPrice: Ksh ${stockPrice}/L\nTotal Cost: Ksh ${(deliveredVolume * stockPrice).toLocaleString()}`);
            onClose();
        } catch (error) {
            console.error('Reconciliation error:', error);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slideUp">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <FiTruck size={20} />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800">Refill Reconciliation</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <FiX />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                        <p className="text-xs text-blue-700 font-bold uppercase tracking-wider mb-1">Electronic Detection (ATG)</p>
                        <div className="flex justify-between items-end">
                            <div>
                                <span className="text-2xl font-black text-blue-900">{alertProp.metadata?.deliveredVolume?.toLocaleString() || '4,250'}</span>
                                <span className="ml-1 text-sm font-bold text-blue-700">Liters</span>
                            </div>
                            <span className="text-xs text-blue-600 italic">Detected at 12:42 PM</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Delivered Volume (Physical)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={deliveredVolume}
                                    onChange={(e) => setDeliveredVolume(Number(e.target.value))}
                                    className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-bold text-slate-800"
                                    required
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">L</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Unit Stock Price (per Liter)</label>
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Ksh</div>
                                <input
                                    type="number"
                                    value={stockPrice}
                                    onChange={(e) => setStockPrice(Number(e.target.value))}
                                    className="w-full pl-14 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-bold text-slate-800"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={processing}
                            className="flex-3 bg-primary hover:bg-primary-dark text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 group"
                        >
                            {processing ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <FiCheck /> Confirm & Record
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
