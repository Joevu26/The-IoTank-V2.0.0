import React, { useState } from 'react';
import { FiUpload, FiSettings, FiDownload, FiLayout } from 'react-icons/fi';
import { useShiftStatus } from '@/hooks/useShiftStatus';
import { useModals } from '@/contexts/ModalContext';
import { Toast } from '../Common/Toast';

interface CalibrationToolsProps {
}

export const CalibrationTools: React.FC<CalibrationToolsProps> = () => {
    const [uploading, setUploading] = useState(false);
    const { isViewOnly } = useShiftStatus();
    const { openModal } = useModals();
    const [toast, setToast] = useState<{ 
        message: string, 
        type: 'info' | 'warning' | 'success' | 'error',
        actionLabel?: string,
        onAction?: () => void
    } | null>(null);

    const handleCSVUpload = () => {
        if (isViewOnly) {
            setToast({
                message: 'Calibration Locked: Strapping table updates restricted while shift is closed.',
                type: 'warning',
                actionLabel: 'Initialize Shift',
                onAction: () => openModal('shift-open')
            });
            return;
        }
        
        setUploading(true);
        setTimeout(() => {
            setUploading(false);
            alert('CSV upload flow is disabled until backend parser endpoint is configured.');
        }, 300);
    };

    return (
        <div className="calibration-tools p-6 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <FiSettings className="text-indigo-600" /> Advanced Calibration & Strapping
                    </h3>
                    <p className="text-sm text-slate-500">Configure non-linear tank geometry and sensor precision.</p>
                </div>
                <div className="flex gap-2">
                    <button className="btn btn-xs btn-outline bg-white flex items-center gap-1">
                        <FiDownload /> Download Template
                    </button>
                    <button
                        className="btn btn-xs btn-primary flex items-center gap-1"
                        onClick={handleCSVUpload}
                        disabled={uploading}
                    >
                        <FiUpload /> {uploading ? 'Processing...' : 'Upload Strapping Table'}
                    </button>
                </div>
            </div>

            <div className="strapping-info-container">
                {/* Strapping Table Info */}
                <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Strapping Intelligence</div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-indigo-50 flex items-center justify-center">
                            <FiLayout className="text-indigo-600" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-slate-800">Dynamic Geometry</div>
                            <div className="text-[10px] text-success font-bold">Linear Interpolation Active</div>
                        </div>
                    </div>
                </div>
            </div>
            {toast && (
                <Toast 
                    message={toast.message} 
                    type={toast.type} 
                    actionLabel={toast.actionLabel}
                    onAction={toast.onAction}
                    onClose={() => setToast(null)} 
                />
            )}
        </div>
    );
};
