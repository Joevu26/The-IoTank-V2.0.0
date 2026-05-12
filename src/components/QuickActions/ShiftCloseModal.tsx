import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiFileText, FiShield, FiCreditCard, FiDroplet, FiTrendingUp, FiDollarSign, FiAlertTriangle, FiInfo, FiActivity } from 'react-icons/fi';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useTanks, useAllLatestReadings, createShift } from '@/hooks/useSupabase';
import { supabase } from '@/config/supabase';
import { NotificationService } from '@/services/NotificationService';
import { EmailDispatchService } from '@/services/EmailDispatchService';
import { AuditService } from '@/services/AuditService';
import { Tank } from '@/types';
import { logger } from '@/utils/logger';
import '../Inventory/AddTankModal.css';

interface ShiftCloseModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ShiftCloseModal: React.FC<ShiftCloseModalProps> = ({ isOpen, onClose }) => {
    const { currentUser } = useAuth();
    const queryClient = useQueryClient();
    const stationId = currentUser?.stationId || '';
    const { tanks } = useTanks(stationId);
    const { readings } = useAllLatestReadings(stationId, tanks.map((t: Tank) => t.id));
    
    const [activeShiftSnapshot, setActiveShiftSnapshot] = useState<Record<string, number> | null>(null);
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [isClosing, setIsClosing] = useState(false);
    const [isHibernating, setIsHibernating] = useState(false);
    const [dbStartTime, setDbStartTime] = useState<string | null>(null);
    const [isManualOverride, setIsManualOverride] = useState(false);
    const [manualClosingVolumes, setManualClosingVolumes] = useState<Record<string, string>>({});
    const [criticalVarianceThreshold, setCriticalVarianceThreshold] = useState(500);

    // Read opening state from DB on mount/open
    useEffect(() => {
        if (!isOpen || !stationId) return;

        const fetchActiveShift = async () => {
            const { data, error } = await supabase
                .from('current_station_shifts')
                .select('*')
                .eq('station_id', stationId)
                .maybeSingle();
            
            if (error) {
                console.error('Error fetching shift snapshot:', error);
                return;
            }

            if (data) {
                if (data.metadata?.tank_snapshots) {
                    const volumeMap: Record<string, number> = {};
                    Object.entries(data.metadata.tank_snapshots).forEach(([id, info]: [string, any]) => {
                        volumeMap[id] = info.opening_volume;
                    });
                    setActiveShiftSnapshot(volumeMap);
                }
                
                if (data.status === 'OPEN') {
                    setDbStartTime(data.updated_at);
                }
            }
        };

        const fetchSettings = async () => {
            const { data } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'CRITICAL_VARIANCE_THRESHOLD')
                .maybeSingle();
            
            if (data?.value) {
                const parsed = parseInt(data.value, 10);
                if (!isNaN(parsed)) setCriticalVarianceThreshold(parsed);
            }
        };

        fetchActiveShift();
        fetchSettings();
    }, [isOpen, stationId]);

    // Legacy fallback (maintained for zero-downtime transition)
    const startVolumesStr = localStorage.getItem('iotank_shift_start_volumes');
    const legacyVolumes: Record<string, number> = startVolumesStr ? JSON.parse(startVolumesStr) : {};
    
    // Primary source is DB snapshot, fallback is legacy LocalStorage
    const startVolumes = activeShiftSnapshot || legacyVolumes;
    
    const startTimeStr = localStorage.getItem('iotank_shift_start_time');
    const openedByStr = localStorage.getItem('iotank_shift_opened_by');
    const openedBy = openedByStr ? JSON.parse(openedByStr) : null;

    // Step state
    const [spending, setSpending] = useState(0);
    const [notes, setNotes] = useState('');
    const [financials, setFinancials] = useState<Record<string, {cash: number, mpesa: number, card: number, other: number}>>({});

    if (!isOpen) return null;

    const triggerHibernate = () => {
        setIsHibernating(true);
        setTimeout(() => setIsHibernating(false), 800);
    };

    // Metrics calculation
    const volumesDispensed: Record<string, number> = {};
    tanks.forEach((tank: Tank) => {
        const currentReading = readings[tank.id];
        const startVol = startVolumes[tank.id] || tank.currentVolume || 0; 
        
        // Use manual override volume if provided, else use live telemetry
        const manualVolStr = manualClosingVolumes[tank.id];
        const manualVol = manualVolStr ? Number(manualVolStr) : null;
        const currentVol = isManualOverride && manualVol !== null 
            ? manualVol 
            : (currentReading?.volumeCorrected || currentReading?.volume || tank.currentVolume || 0);
            
        const dispensed = startVol - currentVol;
        volumesDispensed[tank.id] = dispensed > 0 ? dispensed : 0; 
    });

    const fuelPriceMap = tanks.reduce((acc: Record<string, number>, tank: Tank) => {
        const price = (tank as any).metadata?.retailPrice || 0;
        if (!acc[tank.fuelType] || price > 0) {
            acc[tank.fuelType] = price;
        }
        return acc;
    }, {} as Record<string, number>);

    const totalVolumetricSold = tanks.reduce((acc: number, tank: Tank) => {
        const vol = volumesDispensed[tank.id] || 0;
        const price = (tank as any).metadata?.retailPrice || 0;
        return acc + (vol * price);
    }, 0);

    const totalDispensedLiters = Object.values(volumesDispensed).reduce((a, b) => a + b, 0);
    const totalCollected = Object.values(financials).reduce((sum, tankFin) => {
        return sum + (tankFin.cash || 0) + (tankFin.mpesa || 0) + (tankFin.card || 0) + (tankFin.other || 0);
    }, 0);

    const deficit = totalVolumetricSold - (totalCollected + spending);
    const isCollusionSuspected = Math.abs(deficit) > criticalVarianceThreshold; 

    const handleFinChange = (tankId: string, key: 'cash'|'mpesa'|'card'|'other', val: number) => {
        setFinancials(prev => ({
            ...prev,
            [tankId]: {
                ...(prev[tankId] || { cash: 0, mpesa: 0, card: 0, other: 0 }),
                [key]: val
            }
        }));
    };

    const handleFinalize = async () => {
        const nowString = new Date().toISOString();
        setIsClosing(true);
        try {
            await AuditService.log(
                'SHIFT',
                isCollusionSuspected ? 'SECURITY_COLLUSION_ALERT' : 'SHIFT_CLOSED',
                stationId,
                isCollusionSuspected 
                    ? `FORENSIC ALERT: Discrepancy detected. Variance: Ksh ${deficit.toFixed(2)}. Threshold exceeded.`
                    : `Shift Closed: Variance balanced at Ksh ${deficit.toFixed(2)}. Operations archived.`,
                isCollusionSuspected ? 'CRITICAL' : 'INFO',
                { 
                    variance: deficit, 
                    isCollusionSuspected, 
                    totalCollected, 
                    totalVolumetricSold, 
                    totalDispensedLiters, 
                    closedBy: currentUser?.email,
                    timestamp: nowString 
                }
            );

            NotificationService.show(
                isCollusionSuspected ? '⚠️ COLLUSION DETECTED' : '🛡️ Shift Closed',
                { body: `Variance: Ksh ${deficit.toFixed(2)}`, tag: 'shift-close' }
            );

            if (isCollusionSuspected) {
                await EmailDispatchService.sendSecurityAlert({
                    to: currentUser?.stationEmail || currentUser?.email || '',
                    type: 'COLLUSION',
                    siteName: currentUser?.companyName || 'Fuel Station',
                    details: { timestamp: nowString, varianceValue: deficit, operator: currentUser?.email || 'Unknown', description: 'Significant discrepancy detected.' }
                });
            }

            const pumpReadings: Record<string, any> = {};
            tanks.forEach((t: Tank) => {
                const manualVol = manualClosingVolumes[t.id] ? Number(manualClosingVolumes[t.id]) : null;
                const endVol = (isManualOverride && manualVol !== null) 
                    ? manualVol 
                    : (readings[t.id]?.volumeCorrected || readings[t.id]?.volume || t.currentVolume || 0);

                pumpReadings[t.name] = {
                    start: startVolumes[t.id] || 0,
                    end: endVol,
                    is_manual_override: isManualOverride
                };
            });

            await createShift(stationId, {
                openedAt: startTimeStr || nowString,
                closedAt: nowString,
                durationMin: startTimeStr ? Math.floor((Date.now() - new Date(startTimeStr).getTime()) / 60000) : 0,
                siteId: tanks[0]?.siteId || null,
                nodeId: tanks[0]?.sensorId || (isManualOverride ? 'MANUAL' : ''),
                tankId: tanks[0]?.id || null,
                pumpReadings,
                volumeSoldLiters: totalDispensedLiters,
                expected: { cash: 0, mpesa: 0, pos: 0, total: totalVolumetricSold },
                received: { cash: totalCollected, mpesa: 0, pos: 0, total: totalCollected + spending, spending },
                variance: { amount: deficit, pct: totalVolumetricSold > 0 ? (deficit/totalVolumetricSold)*100 : 0 },
                status: deficit === 0 ? 'BALANCED' : (deficit > 0 ? 'SHORT' : 'OVER'),
                reviewState: 'CLOSED',
                openedBy: openedBy || { authUserId: '', display: 'Unknown' },
                closedBy: { authUserId: currentUser?.authUserId || '', display: currentUser?.displayName || currentUser?.email || '' },
                closingVolume: tanks.reduce((sum: number, t: Tank) => {
                    const manualVol = manualClosingVolumes[t.id] ? Number(manualClosingVolumes[t.id]) : null;
                    return sum + ((isManualOverride && manualVol !== null) ? manualVol : (readings[t.id]?.volumeCorrected || readings[t.id]?.volume || 0));
                }, 0),
                notes: isManualOverride ? `[MANUAL OVERRIDE]: ${notes}` : notes,
                createdAt: nowString,
                operation_type: 'CLOSE',
                action_label: isManualOverride ? 'Reconciliation Finalized (Manual)' : 'Reconciliation Finalized (Telemetric)'
            } as any);

            // [SYNC]: Update the stateless tracker to CLOSED state with full metadata
            await supabase
                .from('current_station_shifts')
                .upsert({
                    station_id: stationId,
                    status: 'CLOSED',
                    updated_at: nowString,
                    updated_by: currentUser?.authUserId || '',
                    metadata: { 
                        last_opened_at: dbStartTime || startTimeStr || nowString,
                        closed_at: nowString,
                        variance: deficit,
                        operator: currentUser?.displayName || currentUser?.email,
                        is_manual_override: isManualOverride
                    }
                });

            if (isManualOverride) {
                await AuditService.log(
                    'SECURITY',
                    'MANUAL_OVERRIDE',
                    stationId,
                    `OPERATIONAL ALERT: Shift closed via manual volume bypass by ${currentUser?.email}. Forensic sync offline.`,
                    'WARNING',
                    { manualClosingVolumes, deficit }
                );
            }
            
            // [FORENSIC UPGRADE]: Automated Shift Summary Email to Station Admin
            const durationMs = startTimeStr ? (Date.now() - new Date(startTimeStr).getTime()) : 0;
            const hrs = Math.floor(durationMs / 3600000);
            const mins = Math.floor((durationMs % 3600000) / 60000);
            const durationStr = `${hrs}h ${mins}m`;

            EmailDispatchService.sendSecurityAlert({
                to: currentUser?.stationEmail || currentUser?.email || 'admin@iotank.com',
                type: 'SHIFT_REPORT',
                siteName: currentUser?.companyName || 'Fuel Station',
                details: {
                    timestamp: nowString,
                    description: `Shift Summary for ${currentUser?.companyName}. Operator: ${currentUser?.displayName || currentUser?.email}.`,
                    totalSales: totalCollected + spending,
                    totalLiters: totalDispensedLiters,
                    varianceValue: deficit,
                    duration: durationStr,
                    operator: currentUser?.displayName || currentUser?.email || 'Unknown'
                }
            });

            localStorage.removeItem('iotank_shift_start_time');
            localStorage.removeItem('iotank_shift_start_volumes');
            localStorage.removeItem('iotank_shift_opened_by');
            localStorage.setItem('iotank_shift_status', 'closed');

            window.dispatchEvent(new CustomEvent('system-toast', {
                detail: {
                    title: 'Shift Archived',
                    message: `Forensic audit saved successfully. Discrepancy: Ksh ${deficit.toFixed(2)}.`,
                    type: 'success',
                    attribution: 'ARCHIVE SERVICE'
                }
            }));

            // [SYNC]: Instant UI Update (Bypass real-time lag)
            // Optimistically update the active_shift query to show the CLOSED state IMMEDIATELY
            queryClient.setQueryData(['active_shift', stationId], {
                status: 'CLOSED',
                updated_at: nowString,
                updated_by: currentUser?.authUserId || '',
                metadata: {
                    last_opened_at: dbStartTime || startTimeStr || nowString,
                    closed_at: nowString,
                    variance: deficit,
                    operator: currentUser?.displayName || currentUser?.email
                }
            });

            queryClient.invalidateQueries({ queryKey: ['active_shift', stationId] });
            queryClient.invalidateQueries({ queryKey: ['shifts', stationId] });

            onClose();
        } catch (err) {
            logger.error('Shift close error', err, 'SHIFT_CLOSE');
            window.dispatchEvent(new CustomEvent('system-toast', {
                detail: {
                    title: 'Sync Failed',
                    message: 'Could not commit shift to audit cloud.',
                    type: 'error',
                    attribution: 'SYNC SERVICE'
                }
            }));
        } finally {
            setIsClosing(false);
        }
    };

    const renderStep1 = () => (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
            <div className="atm-section">
                <div className="atm-section-header">
                    <div className="atm-section-icon"><FiCreditCard size={14} /></div>
                    <span className="atm-section-title">Collections Per Storage</span>
                </div>
                <div className="atm-section-body p-0">
                    {tanks.length === 0 ? (
                        <div className="p-10 text-center text-slate-400 font-medium italic">No active tanks detected.</div>
                    ) : tanks.map((tank: Tank) => (
                        <div key={tank.id} className="pt-6 pb-8 px-8 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                            <div className="font-black text-slate-900 text-[14px] mb-5 flex items-center gap-2 uppercase tracking-tight">
                                <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(0,212,255,0.5)]"></div>
                                <span className="font-black">{tank.name}</span> <span className="text-slate-400 font-black ml-1">[{tank.fuelType}]</span>
                            </div>
                            <div className="grid grid-cols-4 gap-3">
                                {[
                                    { label: 'Cash', key: 'cash' as const, placeholder: 'Ksh' },
                                    { label: 'M-Pesa', key: 'mpesa' as const, placeholder: 'MP' },
                                    { label: 'POS', key: 'card' as const, placeholder: 'PDQ' },
                                    { label: 'Other', key: 'other' as const, placeholder: 'CRED' }
                                ].map((item) => (
                                    <div key={item.key} className="form-group">
                                        <label className="!text-[9px] !mb-1 text-slate-400">{item.label}</label>
                                        <input 
                                            type="number" 
                                            className="!h-[38px] !text-xs !px-2 font-bold"
                                            placeholder={item.placeholder}
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

            <div className="atm-section mt-5">
                <div className="atm-section-header">
                    <div className="atm-section-icon"><FiDollarSign size={14} /></div>
                    <span className="atm-section-title">Expenditure & Petty Cash</span>
                </div>
                <div className="atm-section-body p-6">
                    <div className="form-group mb-0">
                        <label>Total Shift Operations Spending</label>
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Ksh</div>
                            <input 
                                type="number" 
                                className="h-[52px] pl-8 text-xl font-black text-red-600 border-red-100 focus:border-red-400 focus:ring-red-50"
                                placeholder="0.00"
                                value={spending || ''}
                                onChange={(e) => setSpending(Number(e.target.value))}
                            />
                        </div>
                        <div className="field-info-box">
                            <FiInfo className="info-icon" />
                            <p>Note: Total operations spending will be automatically deducted from revenue during reconciliation.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
            <div className="atm-section">
                <div className="atm-section-header">
                    <div className="atm-section-icon"><FiDroplet size={14} /></div>
                    <span className="atm-section-title">Volumetric Telemetry Overview</span>
                </div>
                <div className="atm-section-body p-6 space-y-10">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Telemetric Reliability</span>
                        <button 
                            type="button"
                            onClick={() => setIsManualOverride(!isManualOverride)}
                            className={`text-[9px] font-black px-3 py-1.5 rounded-full transition-all ${isManualOverride ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        >
                            {isManualOverride ? 'MANUAL OVERRIDE ACTIVE' : 'Sensor Sync Failure?'}
                        </button>
                    </div>

                    {isManualOverride && (
                        <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-5 mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
                            <p className="text-[10px] text-amber-700 font-bold mb-4 flex items-center gap-2 uppercase tracking-tight">
                                <FiShield size={12} />
                                Forensic Bypass: Enter manual closing volumes (Liters)
                            </p>
                            <div className="space-y-3">
                                {tanks.map((tank: Tank) => (
                                    <div key={tank.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-amber-100 shadow-sm">
                                        <span className="text-xs font-black text-slate-700">{tank.name}</span>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                placeholder="0.0"
                                                className="w-24 h-9 text-right pr-6 text-sm font-black text-slate-900 border-none focus:ring-0 bg-transparent"
                                                value={manualClosingVolumes[tank.id] || ''}
                                                onChange={(e) => setManualClosingVolumes(prev => ({ ...prev, [tank.id]: e.target.value }))}
                                            />
                                            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">L</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {tanks.map((tank: Tank) => {
                        const manualVol = manualClosingVolumes[tank.id] ? Number(manualClosingVolumes[tank.id]) : null;
                        const currentVol = (isManualOverride && manualVol !== null) 
                            ? manualVol 
                            : (readings[tank.id]?.volumeCorrected || readings[tank.id]?.volume || tank.currentVolume || 0);
                        
                        const startVol = startVolumes[tank.id] || tank.currentVolume || 0;
                        const dispensed = startVol - currentVol;

                        return (
                            <div key={tank.id} className="storage-analysis-unit">
                                <div className="unit-header mb-5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="unit-indicator-glow"></div>
                                        <h4 className="text-[14px] font-black text-slate-900 uppercase tracking-tighter">
                                            {tank.name} <span className="text-cyan-400 opacity-50 ml-1 font-medium">/{tank.fuelType}</span>
                                        </h4>
                                    </div>
                                    <div className="unit-status-pill">{isManualOverride ? 'Manual Entry' : 'Telemetric Sync Active'}</div>
                                </div>

                                <div className="tm-disclosure-grid !gap-4">
                                    <div className="tm-disclosure-chip forensic">
                                        <span className="tm-chip-label">Opening Profile</span>
                                        <span className="tm-chip-value">{startVol.toFixed(0)}<span className="unit-suffix">L</span></span>
                                        <div className="tm-chip-status ok">Snapshot Verified</div>
                                    </div>
                                    <div className="tm-disclosure-chip forensic">
                                        <span className="tm-chip-label">Closing Profile</span>
                                        <span className={`tm-chip-value ${isManualOverride ? 'text-amber-600' : 'text-blue-600'}`}>{currentVol.toFixed(0)}<span className="unit-suffix">L</span></span>
                                        <div className={`tm-chip-status ${isManualOverride ? 'warning' : 'ok'}`}>{isManualOverride ? 'Manual Override' : 'Real-time Sync'}</div>
                                    </div>
                                    <div className="tm-disclosure-chip forensic accent">
                                        <span className="tm-chip-label">Total Drawdown</span>
                                        <span className="tm-chip-value">{dispensed.toFixed(1)}<span className="unit-suffix">L</span></span>
                                        <div className="tm-chip-status">Net Volumetric {isManualOverride ? '(Manual)' : ''}</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="atm-section mt-8">
                <div className="atm-section-header">
                    <div className="atm-section-icon"><FiActivity size={12} /></div>
                    <span className="atm-section-title">Authorized Market Pricing</span>
                </div>
                <div className="atm-section-body p-6">
                    <div className="price-placeholder-grid">
                        {Object.entries(fuelPriceMap).map(([fuel, price]) => (
                            <div key={fuel} className="price-card-placeholder">
                                <div className="flex items-center justify-between pointer-events-none">
                                    <span className="price-card-label">{fuel} Grade</span>
                                    <span className="text-[9px] bg-emerald-100 text-emerald-700 font-black px-2 py-0.5 rounded-md border border-emerald-200 uppercase tracking-tighter">Verified</span>
                                </div>
                                <div className="price-card-value">
                                    Ksh {Number(price).toFixed(2)}
                                    <span className="text-[10px] text-slate-400 ml-1 font-medium">/ Litre</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="atm-section mt-8">
                <div className="atm-section-header">
                    <div className="atm-section-icon"><FiShield size={12} /></div>
                    <span className="atm-section-title">Forensic Metric Verification</span>
                </div>
                <div className="atm-section-body p-6">
                    <div className="tm-disclosure-grid !mt-0 !gap-4">
                        <div className="tm-disclosure-chip forensic">
                            <span className="tm-chip-label">Expected Revenue</span>
                            <span className="tm-chip-value text-slate-800">Ksh {totalVolumetricSold.toLocaleString()}</span>
                            <div className="tm-chip-status ok">Volumetric Basis</div>
                        </div>
                        <div className="tm-disclosure-chip forensic">
                            <span className="tm-chip-label">Actual Collections</span>
                            <span className="tm-chip-value text-slate-800">Ksh {totalCollected.toLocaleString()}</span>
                            <div className="tm-chip-status ok">Manual Record</div>
                        </div>
                        <div className={`tm-disclosure-chip forensic ${deficit > 0 ? 'critical' : 'accent'}`}>
                            <span className="tm-chip-label">Net Variance</span>
                            <span className={`tm-chip-value ${deficit > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                                {deficit > 0 ? '-' : '+'}Ksh {Math.abs(deficit).toLocaleString()}
                            </span>
                            <div className={`tm-chip-status ${deficit > 0 ? 'critical' : 'ok'}`}>
                                {deficit > 0 ? 'Shortfall Detected' : 'Balanced / Surplus'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
            <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600 border-2 border-blue-200">
                    <FiShield size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Final Reconciliation Audit</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Forensic summary for archive</p>
            </div>

            <div className="forensic-hud-grid grid grid-cols-2 gap-4">
                {[
                    { label: 'Volumetric Drawdown', value: `${totalDispensedLiters.toFixed(1)} L`, color: 'cyan', icon: <FiDroplet size={14} /> },
                    { label: 'Expected Revenue', value: `Ksh ${totalVolumetricSold.toFixed(0)}`, color: 'blue', icon: <FiTrendingUp size={14} /> },
                    { label: 'Cash Collated', value: `Ksh ${totalCollected.toFixed(0)}`, color: 'slate', icon: <FiCreditCard size={14} /> },
                    { label: 'Calculated Variance', value: `Ksh ${Math.abs(deficit).toFixed(0)}`, color: deficit > 0 ? 'rose' : 'emerald', icon: <FiAlertTriangle size={14} />, alert: deficit > (criticalVarianceThreshold / 10) }
                ].map((card, i) => (
                    <div key={i} className={`forensic-hud-card ${card.color} ${card.alert ? 'animate-pulse' : ''}`}>
                        <div className="card-icon">{card.icon}</div>
                        <div className="card-info">
                            <span className="card-label">{card.label}</span>
                            <div className="card-value">{card.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="atm-section mt-6">
                <div className="atm-section-header">
                    <div className="atm-section-icon"><FiFileText size={14} /></div>
                    <span className="atm-section-title">Forensic Remarks</span>
                </div>
                <div className="atm-section-body p-6">
                    <div className="form-group mb-0">
                        <label>Additional Observations</label>
                        <textarea 
                            className="w-full !min-h-[120px] !p-5 !text-[13px] !font-medium !rounded-2xl !border-2 !border-slate-200 !bg-slate-50/30 focus:!bg-white"
                            placeholder="Detail any technical issues or meter overrides..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(
        <div className="add-tank-modal-overlay animate-in fade-in duration-300" onClick={triggerHibernate}>
            <div className="add-tank-modal-content max-w-2xl max-h-[95vh]" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="header-text-container">
                        <h2>Close Shift Archive</h2>
                        <p>Complete forensic reconciliation</p>
                        <div className="modal-header-badges">
                            <span className="modal-badge blue">RECONCILIATION</span>
                            <span className="modal-badge cyan">STATION: {stationId.slice(0, 8)}</span>
                        </div>
                    </div>
                    <button className={`close-btn ${isHibernating ? 'hibernate' : ''}`} type="button" onClick={onClose} title="Abort Audit">
                        <FiX size={18} />
                    </button>
                </div>

                <div className="add-tank-form scrollbar-elegant !px-8 !py-8">
                    <div className="flex justify-center gap-2.5 mb-10 sticky top-0 bg-white/60 backdrop-blur-xl py-4 z-20 border-b border-slate-100/50">
                        {[1, 2, 3].map(s => (
                            <div key={s} className={`h-1.5 rounded-full transition-all duration-700 ${s === step ? 'w-24 bg-cyan-500' : 'w-6 bg-slate-200'}`} />
                        ))}
                    </div>

                    <div className="pb-10">
                        {step === 1 && renderStep1()}
                        {step === 2 && renderStep2()}
                        {step === 3 && renderStep3()}
                    </div>
                </div>

                <div className="form-actions !px-10 py-8 bg-slate-50/80 border-t border-slate-100 flex justify-end gap-4 rounded-b-3xl">
                    <button type="button" className="btn-danger !min-w-[120px]" onClick={step === 1 ? onClose : () => setStep(step === 2 ? 1 : 2)}>
                        {step === 1 ? 'Abort Audit' : 'Go Back'}
                    </button>
                    <button type="button" className="btn-submit !min-w-[180px]" 
                            onClick={step < 3 ? () => setStep(step === 1 ? 2 : 3) : handleFinalize} 
                            disabled={isClosing}>
                        {step < 3 ? (step === 1 ? 'Continue' : 'Verify Metrics') : (isClosing ? 'Finalizing...' : 'Commit & Close Shift')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
