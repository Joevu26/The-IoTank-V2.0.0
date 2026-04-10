import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAlertCircle, FiClock, FiZap, FiInfo, FiCheckCircle } from 'react-icons/fi';
import { useTelemetryQueue, TelemetryEvent } from '@/contexts/TelemetryQueueContext';
import { useShiftStatus } from '@/hooks/useShiftStatus';
import { useAuth } from '@/hooks/useAuth';
import { Toast } from '../Common/Toast';
import { useModals } from '@/contexts/ModalContext';
import '../Common/DesignSystemCards.css';

// Map each action to a destination route
const ACTION_ROUTES: Record<string, string> = {
    'attention-refuel':    '/inventory',
    'attention-predictive': '/analytics',
    'attention-team':      '/team',
};

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    critical:     { bg: '#fff1f2', text: '#e11d48', border: '#fecdd3' },
    system_error: { bg: '#fff1f2', text: '#dc2626', border: '#fecdd3' },
    watch:        { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
    due:          { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
    suggested:    { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
};

export const ActionQueue: React.FC = () => {
    const { events, clearEvent } = useTelemetryQueue();
    const navigate = useNavigate();
    const { isViewOnly } = useShiftStatus();
    const { currentUser } = useAuth();
    const { openModal } = useModals();

    const [toast, setToast] = useState<{ 
        message: string, 
        type: 'info' | 'warning' | 'success' | 'error',
        actionLabel?: string,
        onAction?: () => void
    } | null>(null);

    const displayEvents = events;

    const handleItemClick = (item: TelemetryEvent) => {
        if (item.onAction) {
            item.onAction();
        } else if (item.metadata?.modalType) {
            openModal(item.metadata.modalType);
        } else if (ACTION_ROUTES[item.id]) {
            navigate(ACTION_ROUTES[item.id]);
        }
    };

    const handleDismiss = (e: React.MouseEvent, item: TelemetryEvent) => {
        e.stopPropagation();

        const isAdmin = (currentUser?.authLevel || 99) <= 5;
        
        if (isViewOnly && !isAdmin) {
            setToast({
                message: 'Operational Lock: Only Admins can resolve alerts while shift is closed.',
                type: 'warning',
                actionLabel: 'Initialize Shift',
                onAction: () => openModal('shift-open')
            });
            return;
        }

        clearEvent(item.id);
    };

    const getIcon = (type: TelemetryEvent['type']) => {
        const color = TYPE_COLORS[type]?.text || '#64748b';
        switch (type) {
            case 'critical':     return <FiAlertCircle size={14} style={{ color, strokeWidth: 2 }} />;
            case 'system_error': return <FiAlertCircle size={14} style={{ color, strokeWidth: 2 }} />;
            case 'watch':        return <FiClock size={14} style={{ color, strokeWidth: 2 }} />;
            case 'due':          return <FiInfo size={14} style={{ color, strokeWidth: 2 }} />;
            case 'suggested':    return <FiZap size={14} style={{ color, strokeWidth: 2 }} />;
            default:             return <FiInfo size={14} style={{ color: '#94a3b8', strokeWidth: 2 }} />;
        }
    };

    const getTypeLabel = (type: TelemetryEvent['type']) => {
        if (type === 'system_error') return 'System Alert';
        return type.charAt(0).toUpperCase() + type.slice(1);
    };

    return (
        <div
            className="ds-card"
            style={{
                background: '#fff',
                borderRadius: '20px',
                border: '1px solid #f1f5f9',
                boxShadow: '0 4px 24px -8px rgba(30,27,75,0.08)',
                overflow: 'hidden',
                height: '360px',
                display: 'flex',
                flexDirection: 'column',
                marginBottom: '16px',
            }}
        >
            {/* ── Colored Header ── */}
            <div style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FiZap size={16} style={{ color: '#c4b5fd', strokeWidth: 2.5 }} />
                    <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
                        Action Queue
                    </span>
                </div>
                <div style={{
                    background: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: '20px',
                    padding: '3px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                }}>
                    <span style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#fff',
                    }}>
                        {displayEvents.length}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>
                        Active
                    </span>
                </div>
            </div>

            {/* ── Scrollable Items ── */}
            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '8px 0' }} className="custom-scrollbar">
                {displayEvents.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#ecfdf5', border: '1px solid #d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FiCheckCircle size={22} style={{ color: '#10b981', strokeWidth: 2.5 }} />
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#6ee7b7', letterSpacing: '0.08em', textTransform: 'uppercase' }}>All Clear</span>
                    </div>
                ) : (
                    displayEvents.map((item, idx) => {
                        const colors = TYPE_COLORS[item.type] || TYPE_COLORS.due;
                        return (
                            <div
                                key={item.id}
                                onClick={() => handleItemClick(item)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '12px',
                                    padding: '14px 20px',
                                    cursor: 'pointer',
                                    borderBottom: idx < displayEvents.length - 1 ? '1px solid #f8fafc' : 'none',
                                    transition: 'background 0.15s ease',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                {/* Type pill + icon */}
                                <div style={{ flexShrink: 0, paddingTop: '2px' }}>
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        background: colors.bg,
                                        border: `1px solid ${colors.border}`,
                                        borderRadius: '6px',
                                        padding: '3px 7px',
                                    }}>
                                        {getIcon(item.type)}
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: colors.text, letterSpacing: '0.01em' }}>
                                            {getTypeLabel(item.type)}
                                        </span>
                                    </div>
                                </div>

                                {/* Content */}
                                <div style={{ flexGrow: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', lineHeight: '1.45', margin: '0 0 6px 0' }}>
                                        {item.message}
                                    </p>
                                    {item.actionLabel && (
                                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#4f46e5', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                            {item.actionLabel}
                                            <span style={{ fontSize: '13px' }}>→</span>
                                        </span>
                                    )}
                                </div>

                                {/* Tick dismiss button */}
                                <button
                                    onClick={(e) => handleDismiss(e, item)}
                                    title="Mark as done"
                                    style={{
                                        flexShrink: 0,
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        color: '#cbd5e1',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'color 0.2s, background 0.2s',
                                        marginTop: '2px',
                                    }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLButtonElement).style.color = '#10b981';
                                        (e.currentTarget as HTMLButtonElement).style.background = '#ecfdf5';
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLButtonElement).style.color = '#cbd5e1';
                                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                                    }}
                                >
                                    <FiCheckCircle size={18} strokeWidth={2} />
                                </button>
                            </div>
                        );
                    })
                )}
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
