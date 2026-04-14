import React, { useState } from 'react';
import { supabase } from '@/config/supabase';
import { FiCheck, FiX, FiTruck } from 'react-icons/fi';
import { Alert } from '@/types';
import './RefillVerificationModal.css';

interface RefillVerificationModalProps {
    alert: Alert;
    stationId: string;
    onClose: () => void;
}

export const RefillVerificationModal: React.FC<RefillVerificationModalProps> = ({ alert: alertProp, stationId: _stationId, onClose }) => {
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
        <div className="rv-overlay" role="dialog" aria-modal="true" aria-labelledby="rv-title">
            <div className="rv-modal">
                <div className="rv-header">
                    <div className="rv-header-left">
                        <div className="rv-header-icon">
                            <FiTruck size={20} />
                        </div>
                        <h3 id="rv-title">Refill Reconciliation</h3>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="rv-close-btn"
                        title="Close Modal"
                        aria-label="Close"
                    >
                        <FiX />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="rv-body">
                    <div className="rv-atg-banner">
                        <span className="rv-atg-label">Electronic Detection (ATG)</span>
                        <div className="rv-atg-value-row">
                            <div>
                                <span className="rv-atg-value">{alertProp.metadata?.deliveredVolume?.toLocaleString() || '4,250'}</span>
                                <span className="rv-atg-unit">Liters</span>
                            </div>
                            <span className="rv-atg-ts">Detected Today</span>
                        </div>
                    </div>

                    <div className="rv-input-area">
                        <div className="rv-form-group">
                            <label className="rv-form-label" htmlFor="delivered-vol">Delivered Volume (Physical)</label>
                            <div className="rv-input-wrapper">
                                <input
                                    id="delivered-vol"
                                    type="number"
                                    value={deliveredVolume}
                                    onChange={(e) => setDeliveredVolume(Number(e.target.value))}
                                    className="rv-input"
                                    required
                                    placeholder="4250"
                                />
                                <span className="rv-unit-tag">L</span>
                            </div>
                        </div>

                        <div className="rv-form-group">
                            <label className="rv-form-label" htmlFor="stock-price">Unit Stock Price (per Liter)</label>
                            <div className="rv-input-wrapper">
                                <div className="rv-currency-tag">KSh</div>
                                <input
                                    id="stock-price"
                                    type="number"
                                    value={stockPrice}
                                    onChange={(e) => setStockPrice(Number(e.target.value))}
                                    className="rv-input rv-input--currency"
                                    required
                                    placeholder="190.50"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="rv-actions">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rv-btn-cancel"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={processing}
                            className="rv-btn-submit"
                        >
                            {processing ? (
                                <div className="rv-spinner" />
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
