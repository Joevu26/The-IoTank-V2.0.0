import React from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiPlayCircle } from 'react-icons/fi';
import { useAuth } from '@/hooks/useAuth';
import { useTanks, useAllLatestReadings } from '@/hooks/useSupabase';
import { supabase } from '@/config/supabase';
import { NotificationService } from '@/services/NotificationService';
import { EmailDispatchService } from '@/services/EmailDispatchService';
import { AuditService } from '@/services/AuditService';
import '../Inventory/AddTankModal.css';

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
                `Shift opened by ${currentUser.displayName || currentUser.email} at ${now.toLocaleTimeString()}`,
                'INFO',
                { time: nowString }
            );

            // Legacy alert for backward compatibility with notification bell
            await supabase.from('alerts').insert({
                station_id: currentUser.stationId,
                auth_user_id: currentUser.authUserId,
                alert_type: 'info',
                severity: 'info',
                title: 'Operation Started',
                message: `Shift opened by ${currentUser.displayName || currentUser.email} at ${now.toLocaleTimeString()}`,
                alert_data: { type: 'shift_open', user: currentUser.email, time: nowString }
            });

            // 3. Volatile start volumes (kept in localStorage for active session only)
            const startVolumes: Record<string, number> = {};
            tanks.forEach(t => {
                const currentReading = readings[t.id];
                const liveVolume = currentReading?.volumeCorrected || currentReading?.volume || t.currentVolume || 0;
                startVolumes[t.id] = liveVolume;
            });
            localStorage.setItem('iotank_shift_start_volumes', JSON.stringify(startVolumes));
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
        <div className="add-tank-modal-overlay animate-in fade-in duration-300">
            <div className="add-tank-modal-content max-w-lg">
                <div className="modal-header">
                    <div className="header-text-container">
                        <h2>Start Local Shift</h2>
                        <p>Initialize your station operations for the day.</p>
                        <div className="modal-header-badges">
                            <span className="modal-badge amethyst">Session</span>
                            <span className="modal-badge violet">BEGIN</span>
                        </div>
                    </div>
                    <button className="close-btn" type="button" onClick={onClose} title="Close" aria-label="Close"><FiX size={18} /></button>
                </div>

                <div className="p-1">
                    <div className="atm-section plum">
                        <div className="atm-section-header">
                            <div className="atm-section-icon"><FiPlayCircle size={14} /></div>
                            <span className="atm-section-title">Shift Initialization</span>
                        </div>
                        <div className="atm-section-body p-8 text-center bg-white rounded-b-[18px]">
                            <div className="inline-flex items-center px-4 py-2 bg-indigo-50 rounded-xl border border-indigo-100 mb-6">
                                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Session Dashboard</span>
                            </div>

                            <h2 className="text-[28px] font-black text-slate-800 tracking-tight leading-none mb-3">
                                Good day, <span className="text-[#855AFF]">{stationName}</span>!
                            </h2>
                            
                            <p className="text-slate-500 font-semibold leading-relaxed max-w-[300px] mx-auto text-sm">
                                IoTank wishes you success. Your shift recording and telemetry tracking are ready to begin.
                            </p>
                        </div>
                    </div>

                    <div className="form-actions pt-6 pb-2 border-none">
                        <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
                        <button type="button" className="btn-submit" onClick={handleStart} disabled={isStarting}>
                            {isStarting ? 'Committing Shift...' : 'Start Recording Shift'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};




