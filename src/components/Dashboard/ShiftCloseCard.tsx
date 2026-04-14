import React from 'react';
import { FiLock, FiUnlock, FiAlertCircle } from 'react-icons/fi';
import { Tank } from '@/types';
import { useModals } from '@/contexts/ModalContext';
import { useShiftStatus } from '@/hooks/useShiftStatus';
import './ShiftCloseCard.css';

interface ShiftCloseCardProps {
    tank: Tank | null;
}

export const ShiftCloseCard: React.FC<ShiftCloseCardProps> = ({ tank }) => {
    const { status, openedAt, closedAt, uptime } = useShiftStatus();
    const { openModal } = useModals();

    const formatTime = (ts: number | null) => {
        if (!ts) return '--:--';
        const date = new Date(ts);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        return `${dateStr}, ${timeStr}`;
    };

    if (!tank && status === 'closed') {
        return (
            <div className="ds-card ds-card-panel p-4 flex flex-col justify-center bg-slate-50/50 border-dashed border-2 border-slate-200 rounded-2xl">
                <div className="flex items-center gap-2 text-slate-400">
                    <FiAlertCircle size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">No Active Asset for Shift</span>
                </div>
            </div>
        );
    }

    return (
        <div className="ds-card ds-card-panel p-5 w-full h-full flex flex-col justify-between">
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                    <div className="flex flex-col">
                        <span className="text-[14px] font-bold text-slate-700 tracking-tight mb-1">Shift Management</span>
                        
                        {status === 'open' ? (
                            <div className="flex items-center">
                                <span className="text-[12px] font-medium text-slate-500 mr-2">Started</span>
                                <div className="sm-time-pill">
                                    {formatTime(openedAt)}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center">
                                <span className="text-[12px] font-medium text-slate-500 mr-2">Ended at</span>
                                <div className="sm-time-pill w-fit">
                                    {closedAt ? formatTime(closedAt) : '--:--'}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                        STATUS: {status === 'open' ? 'ACTIVE' : 'CLOSED'}
                    </span>
                    <div className={`sm-up-pill ${status !== 'open' ? 'closed' : ''}`}>
                        <span className={`text-[10px] font-bold tracking-wider uppercase ${status === 'open' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {status === 'open' ? 'Up' : 'Down'}
                        </span>
                        <span className={`text-[14px] font-mono font-bold ${status === 'open' ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {uptime}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between mt-6">
                <div className="flex-1"></div>
                {status === 'closed' ? (
                    <button
                        onClick={() => openModal('shift-open')}
                        className="btn-shift-modern btn-open-modern"
                    >
                        <FiUnlock size={14} /> Open
                    </button>
                ) : (
                    <button
                        onClick={() => openModal('shift-close')}
                        className="btn-shift-modern btn-close-modern"
                    >
                        <FiLock size={12} strokeWidth={2.5} /> Close
                    </button>
                )}
            </div>
        </div>
    );
};
