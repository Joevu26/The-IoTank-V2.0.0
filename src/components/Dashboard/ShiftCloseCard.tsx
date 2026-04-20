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
    const { status, openedAt, uptime } = useShiftStatus();
    const { openModal } = useModals();

    const formatTime = (ts: number | null) => {
        if (!ts) return '--:--';
        const date = new Date(ts);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (ts: number | null) => {
        if (!ts) return '';
        return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    if (!tank && status === 'closed') {
        return (
            <div className="shift-card-clean">
                <div className="shift-card-clean-empty">
                    <FiAlertCircle size={16} className="shift-empty-icon" />
                    <span>No tank selected for shift</span>
                </div>
            </div>
        );
    }

    const isOpen = status === 'open';

    return (
        <div className="shift-card-clean">
            {/* Header */}
            <div className="shift-card-header">
                <div className="shift-card-title-group">
                    <div className={`shift-status-dot ${isOpen ? 'live' : ''}`} />
                    <div>
                        <p className="shift-card-label">Shift Control</p>
                        <h4 className="shift-card-title">
                            {isOpen ? 'Shift Active' : 'No Active Shift'}
                        </h4>
                    </div>
                </div>
                <span className={`shift-status-badge ${isOpen ? 'open' : 'closed'}`}>
                    {isOpen ? 'Active' : 'Idle'}
                </span>
            </div>

            {/* Stats row */}
            <div className="shift-stats-row">
                <div className="shift-stat">
                    <p className="shift-stat-label">Started</p>
                    <p className="shift-stat-value">{isOpen ? formatTime(openedAt) : '—'}</p>
                    {isOpen && openedAt && (
                        <p className="shift-stat-sub">{formatDate(openedAt)}</p>
                    )}
                </div>
                <div className="shift-stat shift-stat-right">
                    <p className="shift-stat-label">Duration</p>
                    <p className={`shift-stat-value mono ${isOpen ? 'text-green' : 'text-gray'}`}>
                        {isOpen ? uptime : '—'}
                    </p>
                </div>
            </div>

            {/* Action */}
            <div className="shift-action">
                {!isOpen ? (
                    <button
                        onClick={() => openModal('shift-open')}
                        className="shift-btn shift-btn-start"
                    >
                        <FiUnlock size={13} /> Start Shift
                    </button>
                ) : (
                    <button
                        onClick={() => openModal('shift-close')}
                        className="shift-btn shift-btn-end"
                    >
                        <FiLock size={13} /> Close Shift
                    </button>
                )}
            </div>
        </div>
    );
};
