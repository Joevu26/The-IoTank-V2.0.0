import React, { useState } from 'react';
import { supabase } from '@/config/supabase';
import { FiCheck, FiX, FiTruck, FiAlertCircle, FiDatabase } from 'react-icons/fi';
import { Alert } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { NotificationService } from '@/services/NotificationService';
import './RefillVerificationModal.css';

interface RefillVerificationModalProps {
    alert: Alert;
    stationId: string;
    onClose: () => void;
}

export const RefillVerificationModal: React.FC<RefillVerificationModalProps> = ({ alert: alertProp, stationId, onClose }) => {
    const { currentUser } = useAuth();
    const meta = alertProp.metadata || {};
    
    // ATG Sensing Values (Auto-brought)
    const atgStartVolume = meta.startVolume || 0;
    const atgEndVolume = meta.endVolume || 0;
    const atgDeliveredVolume = meta.deliveredVolume || (atgEndVolume - atgStartVolume);
    const isUnauthorized = alertProp.type === 'unauthorized_refill';

    // Form State
    const [invoiceVolume, setInvoiceVolume] = useState<number>(atgDeliveredVolume);
    const [supplier, setSupplier] = useState<string>('');
    const [bolNumber, setBolNumber] = useState<string>('');
    const [unitPrice, setUnitPrice] = useState<number>(184.50); // Default placeholder for Kenya market
    const [processing, setProcessing] = useState(false);

    // Real-time Variance Tracking
    const variance = invoiceVolume - atgDeliveredVolume;
    const variancePcnt = atgDeliveredVolume > 0 ? (variance / atgDeliveredVolume) * 100 : 0;
    const isVarianceHigh = Math.abs(variance) > 50;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        
        setProcessing(true);
        try {
            // 1. Create a Formal Delivery Record (Unifying with Add Delivery Modal)
            const deliveryPayload = {
                station_id: stationId,
                tank_id: alertProp.tankId,
                auth_user_id: currentUser.authUserId,
                delivery_date: new Date().toISOString(),
                supplier_name: supplier || 'DSRS_LOCAL_OFFLOAD',
                bol_number: bolNumber || `ATG-AUTO-${Date.now().toString().slice(-6)}`,
                bol_claimed_volume: invoiceVolume,
                actual_received_volume: invoiceVolume, // Reconciled value
                tank_before_volume: atgStartVolume,
                tank_after_volume: atgEndVolume,
                actual_temperature: 25.0, // Placeholder
                metadata: {
                    atg_measured_volume: atgDeliveredVolume,
                    variance: variance,
                    variance_percentage: variancePcnt,
                    unit_price: unitPrice,
                    total_cost: invoiceVolume * unitPrice,
                    source: 'AUTOMATED_REFILL_DETECTION',
                    alert_id: alertProp.id
                }
            };

            const { error: deliveryError } = await supabase
                .from('deliveries')
                .insert([deliveryPayload]);

            if (deliveryError) throw deliveryError;

            // 2. Resolve the underlying alert
            const { error: alertError } = await supabase
                .from('alerts')
                .update({
                    is_resolved: true,
                    resolved_at: new Date().toISOString(),
                    metadata: {
                        ...meta,
                        reconciliation: {
                            invoiceVolume,
                            supplier,
                            bolNumber,
                            variance,
                            verifiedBy: currentUser.email
                        }
                    }
                })
                .eq('id', alertProp.id);

            if (alertError) throw alertError;

            NotificationService.show('Refill Synchronized', {
                body: `Inventory successfully reconciled for ${alertProp.tankId}. Variance: ${variance.toFixed(1)}L`,
                type: 'success'
            } as any);

            onClose();
        } catch (error: any) {
            console.error('Reconciliation error:', error);
            window.dispatchEvent(new CustomEvent('system-toast', {
                detail: {
                    title: 'Sync Error',
                    message: `Synchronization error: ${error.message}`,
                    type: 'error',
                    attribution: 'RECONCILIATION ENGINE'
                }
            }));
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="rv-overlay" role="dialog" aria-modal="true">
            <div className="rv-modal">
                <div className="rv-header">
                    <div className="rv-header-left">
                        <div className="rv-header-icon">
                            <FiTruck size={20} />
                        </div>
                        <div className="flex flex-col">
                            <h3 id="rv-title">{isUnauthorized ? 'Forensic Security Reconciliation' : 'Refill Reconciliation'}</h3>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isUnauthorized ? 'text-rose-600' : 'text-indigo-500'}`}>
                                {isUnauthorized ? 'SECURITY PROTOCOL ACTIVE' : 'Automatic Delivery Verification'}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="rv-close-btn" aria-label="Close Interface">
                        <FiX />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="rv-body custom-scrollbar">
                    {/* ATG DATA PANEL (Immutable) */}
                    {isUnauthorized && (
                        <div className="px-4 py-2 bg-rose-50 border-y border-rose-100 mb-4 flex items-center gap-3">
                            <FiAlertCircle className="text-rose-600 animate-pulse" />
                            <p className="text-[10px] font-bold text-rose-800 uppercase tracking-tight">
                                SECURITY BREACH: Unscheduled Out-of-Hours Delivery Detected while shift was CLOSED.
                            </p>
                        </div>
                    )}
                    <div className="rv-atg-banner">
                        <div className="flex justify-between items-center mb-2">
                            <span className="rv-atg-label flex items-center gap-1.5"><FiDatabase size={10} /> ATG Sensing Report</span>
                            <span className="text-[9px] font-bold py-0.5 px-2 bg-indigo-500 text-white rounded-full">SYSTEM_VERIFIED</span>
                        </div>
                        <div className="rv-atg-value-row">
                            <div className="flex flex-col">
                                <span className="rv-atg-value">+{atgDeliveredVolume.toLocaleString()}</span>
                                <span className="rv-atg-unit">Measured Cubic Liters</span>
                            </div>
                            <div className="rv-atg-forensics">
                                <div className="forensic-point">
                                    <span>START (t₀):</span>
                                    <strong>{atgStartVolume.toLocaleString()}L</strong>
                                </div>
                                <div className="forensic-point">
                                    <span>END (t₁):</span>
                                    <strong>{atgEndVolume.toLocaleString()}L</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rv-input-area">
                        {/* INVOICE ENTRY SECTION */}
                        <div className="section-divider">
                            <span>Verification Data</span>
                        </div>

                        <div className="rv-form-group">
                            <label className="rv-form-label">Waybill / Invoice Volume</label>
                            <div className="rv-input-wrapper">
                                <input
                                    type="number"
                                    value={invoiceVolume}
                                    onChange={(e) => setInvoiceVolume(Number(e.target.value))}
                                    className="rv-input font-black text-indigo-700"
                                    required
                                />
                                <span className="rv-unit-tag">L</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="rv-form-group">
                                <label className="rv-form-label">Supplier</label>
                                <input
                                    type="text"
                                    value={supplier}
                                    onChange={(e) => setSupplier(e.target.value)}
                                    className="rv-input text-sm"
                                    placeholder="e.g. Shell"
                                    required
                                />
                            </div>
                            <div className="rv-form-group">
                                <label className="rv-form-label">BOL / Invoice #</label>
                                <input
                                    type="text"
                                    value={bolNumber}
                                    onChange={(e) => setBolNumber(e.target.value)}
                                    className="rv-input text-sm"
                                    placeholder="INV-XXXXX"
                                    required
                                />
                            </div>
                        </div>

                        <div className="rv-form-group">
                            <label className="rv-form-label">Unit Price (KES)</label>
                            <div className="rv-input-wrapper">
                                <div className="rv-currency-tag">KSh</div>
                                <input
                                    type="number"
                                    value={unitPrice}
                                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                                    className="rv-input rv-input--currency"
                                    step="0.01"
                                />
                            </div>
                        </div>

                        {/* Real-time Variance Summary */}
                        <div className={`variance-indicator ${isVarianceHigh ? 'danger' : 'safe'}`}>
                            <div className="flex items-center gap-2">
                                {isVarianceHigh ? <FiAlertCircle /> : <FiCheck />}
                                <span className="text-sm font-bold">
                                    Net Variance: {variance > 0 ? '+' : ''}{variance.toFixed(1)}L 
                                    ({variancePcnt > 0 ? '+' : ''}{variancePcnt.toFixed(2)}%)
                                </span>
                            </div>
                            <p className="text-[10px] opacity-70 mt-1 uppercase font-black tracking-tight">
                                {isVarianceHigh ? 'Critical deviation detected. Review invoice volume.' : 'Variance within acceptable forensic tolerance.'}
                            </p>
                        </div>
                    </div>

                    <div className="rv-actions">
                        <button type="button" onClick={onClose} className="rv-btn-cancel">Discard Event</button>
                        <button type="submit" disabled={processing} className="rv-btn-submit">
                            {processing ? <div className="rv-spinner" /> : <><FiCheck /> Finalize & Sync</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
