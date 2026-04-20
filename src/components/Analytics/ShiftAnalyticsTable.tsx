import React from 'react';
import { useShifts } from '@/hooks/useShifts';
import { useAuth } from '@/hooks/useAuth';
import { FiUser, FiAlertCircle, FiClipboard, FiAlertTriangle, FiFileText } from 'react-icons/fi';
import { format } from 'date-fns';

export const ShiftAnalyticsTable: React.FC = () => {
    const { currentUser } = useAuth();
    const stationId = currentUser?.stationId || '';
    const { shifts, loading, error } = useShifts(stationId);

    if (loading) return (
        <div style={{ padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent"></div>
            <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Loading shift records...</p>
        </div>
    );

    if (error) return (
        <div style={{ padding: '2rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: '#fef2f2', borderRadius: '0.75rem', margin: '1rem' }}>
            <FiAlertCircle style={{ color: '#dc2626', marginTop: '2px', flexShrink: 0 }} size={18} />
            <div>
                <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#991b1b', margin: 0 }}>Failed to load records</p>
                <p style={{ fontSize: '0.8125rem', color: '#b91c1c', margin: '0.25rem 0 0' }}>{error}</p>
            </div>
        </div>
    );

    return (
        <div>
            {/* TABLE HEADER */}
            <div className="audit-table-header">
                <div className="audit-table-title">
                    <div className="audit-table-icon">
                        <FiClipboard size={16} />
                    </div>
                    <div>
                        <h3>Shift Records</h3>
                        <p>All closed shifts and reconciliation data</p>
                    </div>
                </div>
                <div className="audit-table-actions">
                    <button className="audit-btn">
                        <FiFileText size={13} /> Export
                    </button>
                    <button className="audit-btn danger">
                        <FiAlertTriangle size={13} /> View Flagged
                    </button>
                </div>
            </div>

            {/* TABLE */}
            <div className="audit-table-scroll">
                <table className="audit-data-table">
                    <thead>
                        <tr>
                            <th>Operator</th>
                            <th>Date & Time</th>
                            <th className="text-right">Volume (L)</th>
                            <th className="text-right">Revenue</th>
                            <th className="text-center">Variance</th>
                            <th>Notes</th>
                            <th className="text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {shifts.length === 0 ? (
                            <tr>
                                <td colSpan={7}>
                                    <div className="audit-empty-state">
                                        <FiUser size={36} />
                                        <p>No shift records found</p>
                                        <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Closed shifts will appear here</p>
                                    </div>
                                </td>
                            </tr>
                        ) : shifts.map((shift: any) => {
                            const received = shift.received_collections || {};
                            const variance = shift.variance_data || {};
                            const operatorName = received.opened_by?.display || shift.operatorName || 'Unknown';
                            const closingVol = received.closing_volume || 0;
                            const revenue = received.total || 0;
                            const isOpening = (shift.operation_type || 'CLOSE') === 'OPEN';
                            const varAmt = variance.amount || 0;
                            const isCritical = Math.abs(varAmt) > 500;

                            // Derive initials for avatar
                            const initials = operatorName
                                .split(' ')
                                .map((n: string) => n[0] || '')
                                .slice(0, 2)
                                .join('')
                                .toUpperCase();

                            // Variance badge class
                            let varianceClass = 'init';
                            if (!isOpening) {
                                if (varAmt === 0) varianceClass = 'balanced';
                                else if (varAmt > 0) varianceClass = 'over';
                                else varianceClass = 'short';
                            }

                            const dateField = isOpening
                                ? shift.opened_at
                                : (shift.closed_at || shift.recorded_at);

                            return (
                                <tr key={shift.id}>
                                    {/* Operator */}
                                    <td>
                                        <div className="td-operator">
                                            <div className="td-operator-avatar">{initials || <FiUser size={14} />}</div>
                                            <div>
                                                <span className="td-operator-name">{operatorName}</span>
                                                <span className="td-operator-id">#{shift.id.slice(0, 8)}</span>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Date */}
                                    <td>
                                        <span className="td-date-primary">
                                            {dateField ? format(new Date(dateField), 'MMM d, yyyy') : '—'}
                                        </span>
                                        <span className="td-date-secondary">
                                            {dateField ? format(new Date(dateField), 'HH:mm') : ''}
                                        </span>
                                    </td>

                                    {/* Volume */}
                                    <td>
                                        <div className="td-number">
                                            {isOpening ? '—' : `${closingVol.toLocaleString()} L`}
                                        </div>
                                        {!isOpening && <span className="td-number-sub">At close</span>}
                                    </td>

                                    {/* Revenue */}
                                    <td>
                                        <div className="td-number">
                                            {isOpening ? '—' : `Ksh ${revenue.toLocaleString()}`}
                                        </div>
                                        {!isOpening && <span className="td-number-sub">Collected</span>}
                                    </td>

                                    {/* Variance */}
                                    <td style={{ textAlign: 'center' }}>
                                        <span className={`variance-badge ${varianceClass}`}>
                                            {isOpening
                                                ? 'Initialization'
                                                : varAmt === 0
                                                ? '✓ Balanced'
                                                : `${varAmt > 0 ? '-' : '+'}Ksh ${Math.abs(varAmt).toLocaleString()}`
                                            }
                                            {isCritical && <FiAlertTriangle size={11} />}
                                        </span>
                                    </td>

                                    {/* Notes */}
                                    <td style={{ maxWidth: '200px' }}>
                                        <p style={{
                                            fontSize: '0.8125rem',
                                            color: '#6b7280',
                                            margin: 0,
                                            overflow: 'hidden',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical' as any,
                                        }} title={shift.notes}>
                                            {shift.notes || (isOpening ? 'Shift opened.' : 'No notes recorded.')}
                                        </p>
                                    </td>

                                    {/* Status */}
                                    <td>
                                        <div className="td-status-dot">
                                            <div className="status-dot" />
                                            Synced
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
