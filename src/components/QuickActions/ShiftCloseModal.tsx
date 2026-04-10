import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiFileText, FiShield, FiCreditCard, FiDroplet, FiTrendingUp, FiDollarSign, FiAlertTriangle } from 'react-icons/fi';
import { useAuth } from '@/hooks/useAuth';
import { useTanks, useAllLatestReadings } from '@/hooks/useSupabase';
import { supabase } from '@/config/supabase';
import { NotificationService } from '@/services/NotificationService';
import { EmailDispatchService } from '@/services/EmailDispatchService';
import { ExportService } from '@/services/ExportService';
import { AuditService } from '@/services/AuditService';
import '../Inventory/AddTankModal.css';

interface ShiftCloseModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ShiftCloseModal: React.FC<ShiftCloseModalProps> = ({ isOpen, onClose }) => {
    const { currentUser } = useAuth();
    const { tanks } = useTanks(currentUser?.stationId || '');
    const { readings } = useAllLatestReadings(currentUser?.stationId || '', tanks.map(t => t.id));
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [isClosing, setIsClosing] = useState(false);

    // Read opening volumes
    const startVolumesStr = localStorage.getItem('iotank_shift_start_volumes');
    const startVolumes: Record<string, number> = startVolumesStr ? JSON.parse(startVolumesStr) : {};

    // Step 1: Financial State (per tank)
    const [financials, setFinancials] = useState<Record<string, {cash: number, mpesa: number, card: number, other: number}>>({});
    
    // Selling price (per tank)
    const [sellingPrices, setSellingPrices] = useState<Record<string, number>>({});

    // Aggregations
    const totalCollected = Object.values(financials).reduce((sum, tankFin) => {
        return sum + (tankFin.cash || 0) + (tankFin.mpesa || 0) + (tankFin.card || 0) + (tankFin.other || 0);
    }, 0);

    const volumesDispensed: Record<string, number> = {};
    let totalVolumetricSold = 0;
    
    tanks.forEach(tank => {
        const currentReading = Object.values(readings).find(r => r.tankId === tank.id);
        const startVol = startVolumes[tank.id] || tank.currentVolume || 0; 
        const currentVol = currentReading?.volumeCorrected || currentReading?.volume || tank.currentVolume || 0;
        const dispensed = startVol - currentVol;
        volumesDispensed[tank.id] = dispensed > 0 ? dispensed : 0; // Guard against thermal expansion refilling ghost litres

        const price = sellingPrices[tank.id] || 0;
        totalVolumetricSold += (dispensed > 0 ? dispensed : 0) * price;
    });

    const totalDispensedLiters = Object.values(volumesDispensed).reduce((a, b) => a + b, 0);

    const deficit = totalVolumetricSold - totalCollected;

    const handleFinChange = (tankId: string, key: 'cash'|'mpesa'|'card'|'other', val: number) => {
        setFinancials(prev => ({
            ...prev,
            [tankId]: {
                ...(prev[tankId] || { cash: 0, mpesa: 0, card: 0, other: 0 }),
                [key]: val
            }
        }));
    };

    if (!isOpen) return null;

    const handleFinalize = async () => {
        const nowString = new Date().toISOString();
        setIsClosing(true);
        try {
            const startTime = localStorage.getItem('iotank_shift_start_time');
            if (startTime) {
                const diff = Date.now() - new Date(startTime).getTime();
                localStorage.setItem('iotank_shift_last_uptime', diff.toString());
            }

            // Save loss data for Loss Radar
            // totalDispensedLiters is now in component scope
            
            let totalRecordedLiters = 0;
            tanks.forEach(tank => {
                 const price = sellingPrices[tank.id] || 1;
                 const collectedForTank = (financials[tank.id]?.cash || 0) + (financials[tank.id]?.mpesa || 0) + (financials[tank.id]?.card || 0) + (financials[tank.id]?.other || 0);
                 totalRecordedLiters += collectedForTank / price;
            });

            // System Error Calculation: 0.5% tolerance for ATG drift/thermal expansion
            const errorMarginLiters = totalDispensedLiters * 0.005; 
            const isCollusionSuspected = deficit > (errorMarginLiters * Math.max(...Object.values(sellingPrices)));

            const differenceLiters = totalRecordedLiters - totalDispensedLiters;

            const lossData = {
                pumpSales: totalRecordedLiters, 
                tankDrawdown: totalDispensedLiters,
                difference: differenceLiters, 
                estimatedValueKes: deficit,
                dataConfidence: 82,
                isCollusionSuspected,
                timestamp: Date.now()
            };
            localStorage.setItem('iotank_latest_loss_data', JSON.stringify(lossData));

            // Export local Report
            ExportService.generateGenericPDF(
                'Shift Closure Report',
                stationName,
                ['Metric', 'Value'],
                [
                    ['Total Financials', `$${totalCollected.toFixed(2)}`],
                    ['Total Volumetric Sold', `$${totalVolumetricSold.toFixed(2)}`],
                    ['Financial Variance', `$${deficit.toFixed(2)}`],
                    ['Security Status', isCollusionSuspected ? 'COLLUSION RISK' : 'BALANCE CLEAR']
                ],
                { 'Shift Closed': new Date().toLocaleString(), 'User': currentUser?.email || 'Unknown' }
            );

            await AuditService.log(
                isCollusionSuspected ? 'SECURITY_COLLUSION_ALERT' : 'SHIFT_CLOSED', 
                currentUser?.stationId || 'Unknown', 
                `Shift closed. Variance: $${deficit.toFixed(2)}. ${isCollusionSuspected ? 'POTENTIAL COLLUSION DETECTED (Exceeds System Tolerance).' : 'Within expected system error margin.'}`
            );

            // 1. Database Notification & "Happenings" Log
            try {
                const { score } = isCollusionSuspected 
                    ? { score: 95 } // CRITICAL
                    : { score: 15 }; // INFO

                await supabase.from('alerts').insert({
                    station_id: currentUser?.stationId,
                    auth_user_id: currentUser?.authUserId,
                    alert_type: isCollusionSuspected ? 'anomaly' : 'compliance-deadline',
                    severity: isCollusionSuspected ? 'critical' : 'info',
                    title: isCollusionSuspected ? 'SECURITY: Collusion Suspected' : 'OPERATIONAL: Shift Closed',
                    message: `Station: ${stationName} | Closed by: ${currentUser?.email} | Variance: $${deficit.toFixed(2)}`,
                    alert_data: { 
                        type: isCollusionSuspected ? 'THEFT_RECONCILIATION' : 'SHIFT_CLOSE', 
                        user: currentUser?.email, 
                        variance: deficit, 
                        isCollusionSuspected,
                        score,
                        timestamp: nowString
                    },
                    is_resolved: !isCollusionSuspected // Auto-resolve info alerts
                });
            } catch (err) {
                console.error('[ShiftClose] Alert insert failed:', err);
            }

            // 2. Browser Notification
            NotificationService.show(
                isCollusionSuspected ? '⚠️ COLLUSION DETECTED' : '🛡️ Shift Closed & Reconciled',
                {
                    body: `Site: ${stationName}\nOperator: ${currentUser?.email}\nVariance: $${deficit.toFixed(2)}\nStatus: ${isCollusionSuspected ? 'CRITICAL AUDIT REQUIRED' : 'Balance Clear'}`,
                    tag: 'shift-close'
                }
            );

            // 3. Off-Platform SMTP Tactical Email
            if (isCollusionSuspected) {
                await EmailDispatchService.sendSecurityAlert({
                    to: 'admin@iotank.com', // In production, this would be the destination admin email
                    type: 'COLLUSION',
                    siteName: stationName,
                    details: {
                        timestamp: nowString,
                        varianceValue: deficit,
                        operator: currentUser?.email || 'Unknown',
                        description: `A volumetric/financial discrepancy of $${deficit.toFixed(2)} was detected during shift closure by ${currentUser?.email}. This exceeds the 0.5% system tolerance margin.`
                    }
                });
            }

            // Save start timer for downtime
            localStorage.setItem('iotank_shift_closed_at', new Date().toISOString());

            localStorage.removeItem('iotank_shift_status');
            localStorage.removeItem('iotank_shift_start_time');
            window.dispatchEvent(new Event('iotank_shift_changed'));
            onClose();
        } catch (err) {
            console.error('Failed to close shift properly', err);
        } finally {
            setIsClosing(false);
        }
    };

    const stationName = currentUser?.companyName || 'Fuel Station';

    const renderStep1 = () => (
        <div className="animate-in fade-in duration-300 relative h-[80vh] overflow-y-auto pr-2 pb-10">
            <div className="atm-section amethyst">
                <div className="atm-section-header">
                    <div className="atm-section-icon"><FiCreditCard size={14} /></div>
                    <span className="atm-section-title">Record Payment Methods</span>
                </div>
                <div className="atm-section-body p-0">
                    {tanks.length === 0 ? (
                        <div className="p-4 text-center text-slate-500">No active tanks found.</div>
                    ) : tanks.map(tank => (
                        <div key={tank.id} className="pt-4 pb-5 px-6 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                            <div className="font-bold text-slate-800 text-sm mb-3 flex items-center justify-between">
                                <span>{tank.name} <span className="text-slate-400 font-normal">({tank.fuelType})</span></span>
                                <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{startVolumes[tank.id] ? Math.round(startVolumes[tank.id]) : 0} L at open</span>
                            </div>
                            <div className="atm-grid atm-grid-2">
                                {[
                                    { label: 'Cash Sales', key: 'cash' as const },
                                    { label: 'M-Pesa / Mobile', key: 'mpesa' as const },
                                    { label: 'Cards / POS', key: 'card' as const },
                                    { label: 'Others / Vouchers', key: 'other' as const }
                                ].map((item) => (
                                    <div key={item.key} className="form-group mb-0">
                                        <label className="text-[10px]">{item.label}</label>
                                        <input 
                                            type="number" 
                                            className="h-[34px] text-sm"
                                            placeholder="0.00"
                                            value={financials[tank.id]?.[item.key] || ''}
                                            onChange={(e) => handleFinChange(tank.id, item.key, Number(e.target.value))}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-6 mt-4 rounded-xl border bg-slate-50/50 border-slate-200 text-center">
                <p className="text-[12px] font-bold uppercase tracking-widest text-[#a855f7] mb-1">Total Money Recorded</p>
                <h3 className="text-3xl font-black text-slate-800 tracking-tight">
                    <span className="text-lg mr-1 opacity-50">$</span>{totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </h3>
            </div>

            <div className="form-actions pt-6 pb-2 pr-0 flex justify-end gap-3">
                <button type="button" className="btn-cancel !bg-red-50 !text-red-600 !border-red-600 hover:!bg-red-100" onClick={onClose}>Abort</button>
                <button type="button" className="btn-submit !bg-[#a855f7] hover:!bg-[#9333ea] !text-white border-0" onClick={() => setStep(2)}>
                    Reconcile Volumes
                </button>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="animate-in fade-in duration-300 relative h-[80vh] overflow-y-auto pr-2 pb-10">
            <div className="atm-section plum">
                <div className="atm-section-header">
                    <div className="atm-section-icon"><FiFileText size={14} /></div>
                    <span className="atm-section-title">Volumetric Overview</span>
                </div>
                
                <div className="atm-section-body px-6 py-4 space-y-4">
                    {tanks.length === 0 && <div className="text-sm text-center">No tanks configured.</div>}
                    {tanks.map(tank => {
                        const dispensed = volumesDispensed[tank.id] || 0;
                        return (
                        <div key={tank.id} className="atm-grid atm-grid-2 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                            <div className="form-group pb-0 mb-0">
                                <label className="text-[10px]">{tank.name} Dispensed (L)</label>
                                <div className="relative flex items-center w-full h-[36px] px-[14px] rounded-[10px] border border-slate-200 bg-slate-50">
                                    <span className="font-bold text-slate-700 text-sm">{dispensed.toFixed(2)} L</span>
                                </div>
                            </div>
                            
                            <div className="form-group pb-0 mb-0">
                                <label className="text-[10px]">Selling Price</label>
                                <input 
                                    className="h-[36px] text-sm"
                                    type="number" 
                                    step="0.01"
                                    value={sellingPrices[tank.id] || ''}
                                    placeholder="e.g. 145.50"
                                    onChange={(e) => setSellingPrices(prev => ({...prev, [tank.id]: Number(e.target.value)}))}
                                />
                            </div>
                        </div>
                    )})}
                </div>
            </div>

            <div className={`p-6 mt-4 rounded-xl border ${deficit > 0 ? 'bg-red-50/50 border-red-200' : 'bg-emerald-50/50 border-emerald-200'}`}>
                <div className="space-y-4 text-sm font-semibold text-slate-600">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                        <span className="uppercase tracking-wide text-xs">Total Sold (Volumetric)</span>
                        <span className="font-black text-slate-800">${totalVolumetricSold.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                        <span className="uppercase tracking-wide text-xs">Actual Recorded (Financials)</span>
                        <span className="font-black text-slate-800">${totalCollected.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                        <span className="text-[14px] font-black uppercase text-slate-800 tracking-wide">Financial Deficit / Variance</span>
                        <span className={`font-black tracking-tight text-lg ${deficit > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {deficit > 0 ? `-$${Math.abs(deficit).toFixed(2)}` : `+$${Math.abs(deficit).toFixed(2)}`}
                        </span>
                    </div>
                </div>
                
                {deficit > 0 && (
                    <div className={`mt-4 p-3 rounded-lg border flex gap-3 items-start ${
                        deficit > (totalDispensedLiters * 0.005 * Math.max(...Object.values(sellingPrices))) 
                        ? 'bg-red-600 border-red-700 text-white' 
                        : 'bg-amber-100 border-amber-200 text-amber-800'
                    }`}>
                        <FiShield className="mt-0.5 shrink-0" />
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider">
                                {deficit > (totalDispensedLiters * 0.005 * Math.max(...Object.values(sellingPrices))) 
                                ? 'Collusion Risk Detected' 
                                : 'Minor Reconciliation Variance'}
                            </p>
                            <p className="text-[11px] opacity-90 leading-relaxed">
                                {deficit > (totalDispensedLiters * 0.005 * Math.max(...Object.values(sellingPrices))) 
                                ? 'Variance exceeds 0.5% system error threshold. Possible internal collusion detected. Review pump readings manually.' 
                                : 'Variance within 0.5% system tolerance. Potential sensor drift or thermal expansion calculation error.'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <div className="form-actions pt-6 pb-2 pr-0 flex justify-end gap-3">
                <button type="button" className="btn-cancel !bg-slate-100 !text-slate-600 !border-slate-300 hover:!bg-slate-200" onClick={() => setStep(1)}>Go Back</button>
                <button type="button" className="btn-submit !bg-[#a855f7] hover:!bg-[#9333ea] !text-white border-0" onClick={() => setStep(3)}>
                    Final Review
                </button>
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className="animate-in fade-in duration-300">
            <div className="forensic-hud-grid grid grid-cols-2 gap-4 mt-4 mb-6">
                {/* Card 1: Drawdown */}
                <div className="forensic-hud-card violet">
                    <div className="card-icon"><FiDroplet /></div>
                    <div className="card-info">
                        <span className="card-label">Physical Drawdown</span>
                        <div className="card-value">{totalDispensedLiters.toFixed(2)} <span className="unit">Litres</span></div>
                        <span className="card-sub">ATG Volume Change</span>
                    </div>
                </div>

                {/* Card 2: Expected */}
                <div className="forensic-hud-card indigo">
                    <div className="card-icon"><FiTrendingUp /></div>
                    <div className="card-info">
                        <span className="card-label">Expected Revenue</span>
                        <div className="card-value">${totalVolumetricSold.toFixed(2)}</div>
                        <span className="card-sub">Volumetric x Price</span>
                    </div>
                </div>

                {/* Card 3: Collected */}
                <div className="forensic-hud-card plum">
                    <div className="card-icon"><FiDollarSign /></div>
                    <div className="card-info">
                        <span className="card-label">Total Collected</span>
                        <div className="card-value">${totalCollected.toFixed(2)}</div>
                        <span className="card-sub">User Recorded Cash</span>
                    </div>
                </div>

                {/* Card 4: Variance */}
                <div className={`forensic-hud-card ${deficit > 0 ? 'rose' : 'emerald'}`}>
                    <div className="card-icon">{deficit > 0 ? <FiAlertTriangle /> : <FiShield />}</div>
                    <div className="card-info">
                        <span className="card-label">Net Variance</span>
                        <div className="card-value">
                            {deficit > 0 ? `-$${Math.abs(deficit).toFixed(2)}` : `+$${Math.abs(deficit).toFixed(2)}`}
                        </div>
                        <span className="card-sub">{deficit > 0 ? 'Deficit Tracked' : 'Balance Surplus'}</span>
                    </div>
                </div>
            </div>

            <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                    <FiShield className="text-indigo-600" size={16} />
                </div>
                <p className="text-[11px] font-medium text-indigo-700 leading-relaxed">
                    Final confirmation required. By proceeding, you lock all financial records for the current station session into the immutable forensic log.
                </p>
            </div>
        </div>
    );

    return createPortal(
        <div className="add-tank-modal-overlay animate-in fade-in duration-300">
            <div className="add-tank-modal-content max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-0">
                {/* Header: Fixed */}
                <div className="modal-header shrink-0 px-8 py-6 bg-gradient-to-br from-slate-900 to-[#1e293b] border-b border-slate-700/50">
                    <div className="header-text-container">
                        <h2 className="text-white">End Local Shift</h2>
                        <p className="text-slate-400">Complete reconciliation to close operations.</p>
                        <div className="modal-header-badges mt-2">
                            <span className="modal-badge plum">Action</span>
                            <span className="modal-badge violet">END SHIFT</span>
                        </div>
                    </div>
                    <button className="close-btn !bg-white/5 hover:!bg-white/10 !text-white" type="button" onClick={onClose}><FiX size={18} /></button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-8 py-6 scrollbar-elegant">
                    <div className="flex justify-center gap-2 mb-8 sticky top-0 bg-white/80 backdrop-blur-md py-4 z-20 border-b border-slate-100">
                        {[1, 2, 3].map(s => (
                            <div key={s} className={`h-1.5 rounded-full transition-all duration-700 ${s === step ? 'w-16 bg-[#a855f7]' : 'w-4 bg-slate-200'}`} />
                        ))}
                    </div>

                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                </div>

                {/* Footer: Fixed Sticky */}
                <div className="modal-footer shrink-0 px-8 py-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 z-30">
                    {step === 1 ? (
                         <button type="button" className="btn-cancel !m-0" onClick={onClose}>Abort</button>
                    ) : (
                         <button type="button" className="btn-cancel !m-0" onClick={() => setStep(step === 2 ? 1 : 2)}>Go Back</button>
                    )}
                    
                    {step < 3 ? (
                        <button type="button" className="btn-submit !m-0 !bg-[#a855f7] hover:!bg-[#9333ea]" onClick={() => setStep(step === 1 ? 2 : 3)}>
                            {step === 1 ? 'Reconcile Volumes' : 'Final Review'}
                        </button>
                    ) : (
                        <button type="button" className="btn-submit !m-0 !bg-emerald-600 hover:!bg-emerald-700 !text-white border-0 shadow-emerald-200/50" 
                                onClick={handleFinalize} disabled={isClosing}>
                            {isClosing ? 'Finalizing Sync...' : 'Close Shift Now'}
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};



