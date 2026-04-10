import React from 'react';
import { FiClock, FiLock, FiUnlock, FiAlertCircle } from 'react-icons/fi';
import { Tank } from '@/types';
import { useModals } from '@/contexts/ModalContext';
import { useShiftStatus } from '@/hooks/useShiftStatus';

interface ShiftCloseCardProps {
    tank: Tank | null;
}

export const ShiftCloseCard: React.FC<ShiftCloseCardProps> = ({ tank }) => {
    const { status, openedAt, closedAt, uptime } = useShiftStatus();
    const { openModal } = useModals();

    const formatTime = (ts: number | null) => {
        if (!ts) return '--:--';
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ color: '#64748b', marginTop: '2px', background: '#f8fafc', padding: '6px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                        <FiClock size={16} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#334155', letterSpacing: '-0.01em', marginBottom: '6px' }}>Shift Management</span>
                        
                        {status === 'open' ? (
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginRight: '6px' }}>Started at</span>
                                <div className="sm-time-pill">
                                    {formatTime(openedAt)}
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginRight: '6px' }}>Ended at</span>
                                <div className="sm-time-pill" style={{ width: 'fit-content' }}>
                                    {closedAt ? formatTime(closedAt) : '--:--'}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', letterSpacing: '1px', textTransform: 'uppercase' }}>
                        {status === 'open' ? 'Status: Active' : 'Status: Closed'}
                    </span>
                    <div className={`sm-up-pill ${status !== 'open' ? 'closed' : ''}`}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: status === 'open' ? '#059669' : '#e11d48', letterSpacing: '1px', textTransform: 'uppercase' }}>
                            {status === 'open' ? 'Up' : 'Down'}
                        </span>
                        <span style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 700, color: status === 'open' ? '#047857' : '#9f1239' }}>
                            {uptime}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4 mt-6">
                {status === 'closed' ? (
                    <>
                        <span className="text-[14px] font-bold text-slate-800">Inactive</span>
                        <button
                            onClick={() => openModal('shift-open')}
                            className="btn-shift-modern btn-open-modern"
                        >
                            <FiUnlock size={14} /> Open
                        </button>
                    </>
                ) : (
                    <>
                        <span className="text-[14px] font-bold text-slate-800">Active</span>
                        <button
                            onClick={() => openModal('shift-close')}
                            className="btn-shift-modern btn-close-modern"
                        >
                            <FiLock size={12} strokeWidth={2.5} /> Close
                        </button>
                    </>
                )}
            </div>

            <style>{`
                .shift-management-card {
                    box-shadow: 0 10px 30px -10px rgba(0,0,0,0.05);
                }
                .sm-time-pill {
                    background: #f1f5f9;
                    padding: 2px 8px;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 700;
                    color: #334155;
                    border: 1px solid #e2e8f0;
                }
                .sm-up-pill {
                    background: #ecfdf5;
                    border: 1px solid #d1fae5;
                    padding: 4px 10px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.02);
                }
                .sm-up-pill.closed {
                    background: #f8fafc;
                    border-color: #e2e8f0;
                    opacity: 0.8;
                }
                .btn-shift-modern {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 8px 18px;
                    border-radius: 10px;
                    font-size: 0.75rem;
                    font-weight: 800;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    cursor: pointer;
                    letter-spacing: 0.02em;
                }
                .btn-open-modern {
                    background: #f0fdf4;
                    color: #16a34a;
                    border: 1px solid #dcfce7;
                    box-shadow: 0 2px 4px rgba(22, 163, 74, 0.05);
                }
                .btn-open-modern:hover {
                    background: #dcfce7;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 6px rgba(22, 163, 74, 0.1);
                }
                .btn-close-modern {
                    background: #fff1f2;
                    color: #e11d48;
                    border: 1px solid #ffe4e6;
                    box-shadow: 0 2px 4px rgba(225, 29, 72, 0.05);
                }
                .btn-close-modern:hover {
                    background: #ffe4e6;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 6px rgba(225, 29, 72, 0.1);
                }
                .pkg-confirm-shake {
                    background: #e11d48 !important;
                    color: white !important;
                    animation: card-shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
                }
                @keyframes card-shake {
                    10%, 90% { transform: translate3d(-1px, 0, 0); }
                    20%, 80% { transform: translate3d(2px, 0, 0); }
                    30%, 50%, 70% { transform: translate3d(-3px, 0, 0); }
                    40%, 60% { transform: translate3d(3px, 0, 0); }
                }
            `}</style>
        </div>
    );
};
