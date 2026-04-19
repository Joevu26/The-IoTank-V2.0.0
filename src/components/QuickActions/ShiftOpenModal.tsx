import React from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiShield, FiArrowRight, FiActivity, FiDatabase, FiLock } from 'react-icons/fi';
import { useAuth } from '@/hooks/useAuth';
import { useTanks, useAllLatestReadings, createShift } from '@/hooks/useSupabase';
import { supabase } from '@/config/supabase';
import { NotificationService } from '@/services/NotificationService';
import { EmailDispatchService } from '@/services/EmailDispatchService';
import { AuditService } from '@/services/AuditService';
import { validateIdleStability } from '@/utils/telemetryMath';
import { differenceInHours } from 'date-fns';
import './ShiftOpenModal.css';

interface ShiftOpenModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ShiftOpenModal: React.FC<ShiftOpenModalProps> = ({ isOpen, onClose }) => {
    const { currentUser } = useAuth();
    const { tanks } = useTanks(currentUser?.stationId || '');
    const { readings } = useAllLatestReadings(currentUser?.stationId || '', tanks.map(t => t.id));
    const [isStarting, setIsStarting] = React.useState(false);

    if (!isOpen) return null;

    const handleStart = async () => {
        const now = new Date();
        const nowString = now.toISOString();
        if (!currentUser) return;

        setIsStarting(true);
        try {
            // 0. Forensic Handshake: Detect Idle Gaps (Leak/Theft while closed)
            const { data: lastShift } = await supabase
                .from('shift_closures')
                .select('closed_at, pump_readings')
                .eq('station_id', currentUser.stationId)
                .order('closed_at', { ascending: false })
                .limit(1)
                .single();

            if (lastShift) {
                const closedAt = new Date(lastShift.closed_at);
                const hrsClosed = Math.max(0.1, differenceInHours(now, closedAt));
                const prevReadings = lastShift.pump_readings || {};

                tanks.forEach(async (tank) => {
                    // Search for this tank's closure in the polymorphic pumpReadings object
                    // In ShiftCloseModal, it's saved as: pumpReadings[t.name] = { start, end }
                    const tankClosureData = prevReadings[tank.name];
                    const prevCloseVol = tankClosureData?.end;
                    const currentOpenVol = readings[tank.id]?.volumeCorrected || readings[tank.id]?.volume || tank.currentVolume || 0;

                    if (prevCloseVol !== undefined) {
                        const forensic = validateIdleStability(prevCloseVol, currentOpenVol, hrsClosed);
                        
                        // Notify UI of the change immediately
                        window.dispatchEvent(new CustomEvent('system-toast', {
                            detail: {
                                title: `Idle Sync: ${tank.name}`,
                                message: `Fuel change during closed shift: ${forensic.delta.toFixed(1)} L (${forensic.rateLhr.toFixed(2)} L/hr)`,
                                type: forensic.isTheft ? 'error' : (forensic.isLeak ? 'warning' : 'info'),
                                attribution: 'FORENSIC AUDIT'
                            }
                        }));

                        if (forensic.isTheft || forensic.isLeak) {
                            const violationType = forensic.isTheft ? 'theft-detected' : 'leak-detected';
                            const severity = forensic.isTheft ? 'critical' : 'warning';
                            const title = forensic.isTheft ? '🔴 THEFT ALERT' : '⚠️ PRECISION LEAK';
                            const message = forensic.isTheft 
                                ? `Forensic Gap: Unexpected drop of ${Math.abs(forensic.delta).toFixed(1)}L detected during idle hours. SUSPECTED THEFT.`
                                : `Precision Leak: Constant loss of ${forensic.rateLhr.toFixed(2)}L/hr detected while station was closed.`;

                            // Trigger Forensic Alert for Action Queue
                            await supabase.from('alerts').insert({
                                station_id: currentUser.stationId,
                                tank_id: tank.id,
                                alert_type: violationType,
                                severity: severity,
                                title: title,
                                message: message,
                                timestamp: nowString,
                                alert_data: { delta: forensic.delta, rate: forensic.rateLhr, closedDuration: hrsClosed }
                            });

                            await AuditService.log(
                                'SECURITY',
                                forensic.isTheft ? 'THEFT_DETECTED' : 'LEAK_DETECTED',
                                currentUser.stationId,
                                `Forensic alert for ${tank.name}: ${message}`,
                                forensic.isTheft ? 'CRITICAL' : 'WARNING', 
                                { forensic, tankId: tank.id }
                            );
                        }
                    }
                });
            }

            // 1. Update stateless shift tracker in DB
            const { error: shiftError } = await supabase
                .from('current_station_shifts')
                .upsert({
                    station_id: currentUser.stationId,
                    status: 'OPEN',
                    updated_at: nowString,
                    updated_by: currentUser.authUserId
                });

            if (shiftError) throw shiftError;

            // 2. Database Notification (Unified Timeline)
            await AuditService.log(
                'SHIFT',
                'SHIFT_STARTED',
                currentUser.stationId,
                `Forensic Session Initialized: Shift commenced by personnel [${currentUser.displayName || currentUser.email}] at ${now.toLocaleTimeString()}. Telemetry synchronization verified.`,
                'INFO',
                { 
                    startTime: nowString, 
                    operator: currentUser.email,
                    displayName: currentUser.displayName,
                    stationId: currentUser.stationId
                }
            );

            // Legacy alert for backward compatibility with notification bell
            await supabase.from('alerts').insert({
                station_id: currentUser.stationId,
                auth_user_id: currentUser.authUserId,
                alert_type: 'info',
                severity: 'info',
                title: 'Operation Started',
                message: `Operational shift initialized by ${currentUser.displayName || currentUser.email} at ${now.toLocaleTimeString()}. Telemetry tracking is now active.`,
                alert_data: { type: 'shift_open', user: currentUser.email, time: nowString }
            });

            // 3. Persistent Start Volumes (Cloud Synchronized Snapshot)
            const startVolumes: Record<string, { opening_volume: number, captured_at: string, is_manual_override: boolean }> = {};
            tanks.forEach(t => {
                const currentReading = readings[t.id];
                const liveVolume = currentReading?.volumeCorrected || currentReading?.volume || t.currentVolume || 0;
                startVolumes[t.id] = {
                    opening_volume: liveVolume,
                    captured_at: nowString,
                    is_manual_override: false
                };
            });

            // Update stateless shift tracker with persistent metadata
            const { error: snapshotError } = await supabase
                .from('current_station_shifts')
                .upsert({
                    station_id: currentUser.stationId,
                    status: 'OPEN',
                    updated_at: nowString,
                    updated_by: currentUser.authUserId,
                    metadata: { tank_snapshots: startVolumes }
                });

            if (snapshotError) throw snapshotError;

            // 3.5 [FORENSIC COMMIT]: Permanent record of shift opening
            try {
                await createShift(currentUser.stationId, {
                    siteId: tanks[0]?.siteId || null,
                    nodeId: 'CORE-HUB-01', // Local hub identifier
                    tankId: tanks[0]?.id || null,
                    openedAt: nowString,
                    closedAt: nowString, // Temp value for opening record
                    durationMin: 0,
                    pumpReadings: {},
                    volumeSoldLiters: 0,
                    expected: { cash: 0, mpesa: 0, pos: 0, total: 0 },
                    received: { cash: 0, mpesa: 0, pos: 0, total: 0, spending: 0 },
                    variance: { amount: 0, pct: 0 },
                    status: 'BALANCED',
                    reviewState: 'OPEN',
                    openedBy: { authUserId: currentUser.authUserId, display: currentUser.displayName || currentUser.email },
                    closedBy: { authUserId: currentUser.authUserId, display: currentUser.displayName || currentUser.email },
                    closingVolume: 0,
                    notes: `Shift initialized by ${currentUser.displayName || currentUser.email}. Telemetry anchor created.`,
                    createdAt: nowString,
                    operation_type: 'OPEN',
                    action_label: 'Shift Initialized'
                } as any);
            } catch (commitErr) {
                console.error('[ShiftOpen] Forensic commit failed:', commitErr);
                // Non-blocking but logged
            }

            // Legacy fallback (maintained for zero-downtime transition)
            localStorage.setItem('iotank_shift_start_volumes', JSON.stringify(
                Object.fromEntries(Object.entries(startVolumes).map(([id, data]) => [id, data.opening_volume]))
            ));
            localStorage.setItem('iotank_shift_status', 'open');
            localStorage.setItem('iotank_shift_start_time', nowString);
            localStorage.setItem('iotank_shift_opened_by', JSON.stringify({ 
                authUserId: currentUser.authUserId, 
                display: currentUser.displayName || currentUser.email 
            }));
            
            // 4. Browser Notification
            NotificationService.show('🚀 Shift Initialized', {
                body: `Station: ${currentUser?.stationId}\nTime: ${now.toLocaleTimeString()}\nOperator: ${currentUser.displayName || currentUser.email}`,
                tag: 'shift-open'
            });

            // 5. Off-Platform SMTP Tactical Email
            try {
                await EmailDispatchService.sendSecurityAlert({
                    to: 'admin@iotank.com',
                    type: 'SYSTEM_CRITICAL',
                    siteName: currentUser?.companyName || 'Fuel Station',
                    details: {
                       timestamp: nowString,
                       operator: currentUser?.email || 'Unknown',
                       description: `Operational shift initialized at ${now.toLocaleTimeString()} by ${currentUser?.email}. Telemetry tracking is now active.`
                    }
                });
            } catch (mailErr) {
                console.error('[ShiftOpen] Tactical email failed:', mailErr);
            }

            onClose();
        } catch (err) {
            console.error('[ShiftOpen] Activation failed:', err);
            window.dispatchEvent(new CustomEvent('system-toast', {
                detail: {
                    title: 'Shift Activation Failed',
                    message: 'Check connectivity and try again.',
                    type: 'error',
                    attribution: 'ACTIVATION SERVICE'
                }
            }));
        } finally {
            setIsStarting(false);
        }
    };

    const stationName = currentUser?.companyName || 'Fuel Station';

    return createPortal(
        <div className="shift-modal-overlay">
            <div className="shift-modal-content">
                <div className="shift-modal-header">
                    <div className="shift-header-info">
                        <h2>Commence Shift</h2>
                        <p>Initialize operational tracking and telemetry.</p>
                    </div>
                    <button className="shift-close-btn" type="button" onClick={onClose} title="Close" aria-label="Close">
                        <FiX size={20} />
                    </button>
                </div>

                <div className="shift-modal-body">
                    <div className="shift-hero-icon-container">
                        <div className="shift-icon-glow" />
                        <div className="shift-hero-icon">
                            <FiShield size={48} strokeWidth={2.5} />
                        </div>
                    </div>

                    <div className="shift-welcome">
                        <h3>Welcome back, <span className="shift-station-name">{stationName}</span></h3>
                    </div>

                    <p className="shift-description">
                        IoTank systems are primed. Forensic shift recording and telemetry tracking are ready to initialize.
                    </p>

                    <div className="shift-readiness-grid">
                        <div className="readiness-item">
                            <span className="readiness-label">Telemetry</span>
                            <span className="readiness-status"><FiActivity size={12} className="inline mr-1" /> Active</span>
                        </div>
                        <div className="readiness-item">
                            <span className="readiness-label">Tanks</span>
                            <span className="readiness-status"><FiDatabase size={12} className="inline mr-1" /> Bound</span>
                        </div>
                        <div className="readiness-item">
                            <span className="readiness-label">Security</span>
                            <span className="readiness-status"><FiLock size={12} className="inline mr-1" /> Secured</span>
                        </div>
                    </div>

                    <div className="shift-actions">
                        <button type="button" className="btn-shift-cancel" onClick={onClose}>
                            Cancel
                        </button>
                        <button 
                            type="button" 
                            className="btn-shift-start" 
                            onClick={handleStart} 
                            disabled={isStarting}
                        >
                            {isStarting ? (
                                'Initializing System...'
                            ) : (
                                <>
                                    Commence Recording
                                    <FiArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};




