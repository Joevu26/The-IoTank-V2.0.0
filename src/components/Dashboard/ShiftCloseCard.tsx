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
        <div className="ds-card ds-card-panel ds-card-premium glow-cyan p-5 w-full h-full flex flex-col justify-between">
            <div className="stat-content flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.15em] mb-1">Station Operations</span>
                        <h4 className="text-[18px] font-bold text-slate-800 tracking-tight">Shift Management</h4>
                    </div>
                    <div className="flex items-center justify-between bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                        <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase">
                            Operational State
                        </span>
                        <div className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-tighter ${status === 'open' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                            {status === 'open' ? 'ACTIVE SESSION' : 'TERMINATED'}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-50/50 border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Timeline</span>
                        <div className="text-[11px] font-bold text-slate-700">
                            {status === 'open' ? (
                                <div className="flex flex-col">
                                    <span className="opacity-60 text-[8px] uppercase">Started</span>
                                    {formatTime(openedAt)}
                                </div>
                            ) : (
                                <div className="flex flex-col">
                                    <span className="opacity-60 text-[8px] uppercase">Closed</span>
                                    {closedAt ? formatTime(closedAt) : '--:--'}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={`sm-up-pill ${status !== 'open' ? 'closed' : ''}`}>
                        <span className="text-[9px] font-bold tracking-wider uppercase opacity-60">
                            {status === 'open' ? 'Live Uptime' : 'Downtime'}
                        </span>
                        <span className={`text-[15px] font-mono font-black ${status === 'open' ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {uptime}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-end mt-4">
                {status === 'closed' ? (
                    <button
                        onClick={() => openModal('shift-open')}
                        className="btn-shift-modern btn-open-modern w-full"
                    >
                        <FiUnlock size={14} /> Initialize Shift
                    </button>
                ) : (
                    <button
                        onClick={() => openModal('shift-close')}
                        className="btn-shift-modern btn-close-modern w-full"
                    >
                        <FiLock size={12} strokeWidth={2.5} /> Terminate Active Session
                    </button>
                )}
            </div>
        </div>
    );
};
