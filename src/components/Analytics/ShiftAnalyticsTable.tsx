import React from 'react';
import { useShifts } from '@/hooks/useShifts'; // Standardized hook
import { useAuth } from '@/hooks/useAuth';
import { FiUser, FiAlertCircle, FiClipboard, FiClock, FiCalendar, FiDroplet, FiDollarSign, FiFileText, FiShield, FiAlertTriangle } from 'react-icons/fi';
import { format } from 'date-fns';
import './AnalyticsPage.css';

export const ShiftAnalyticsTable: React.FC = () => {
    const { currentUser } = useAuth();
    const stationId = currentUser?.stationId || '';
    const { shifts, loading, error } = useShifts(stationId);

    if (loading) return (
        <div className="logistics-card mt-12 p-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-200">
            <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Synchronizing Intelligence Archive...</p>
        </div>
    );
    
    if (error) return (
        <div className="logistics-card mt-12 p-10 text-center border-2 border-red-100 bg-red-50/20">
            <FiAlertCircle className="mx-auto text-red-500 mb-2" size={24} />
            <h4 className="text-red-700 font-black uppercase text-xs">Intelligence Interrupted</h4>
            <p className="text-red-500/70 text-[11px] mt-1 font-medium">{error}</p>
        </div>
    );

    return (
        <div className="logistics-card mt-12 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="logistics-header border-b border-slate-50 bg-gradient-to-r from-white to-slate-50/50">
                <div className="logistics-title-group">
                    <div className="acp-section-icon acp-icon-accent-purple shadow-sm">
                        <FiClipboard size={18} />
                    </div>
                    <div>
                        <h3 className="text-slate-800 font-black text-lg tracking-tight">Shift Operational Logs</h3>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Historical Reconciliation Archive</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button className="text-[11px] font-black text-slate-400 hover:text-purple-600 uppercase tracking-widest transition-colors flex items-center gap-2">
                        <FiFileText size={14} /> Export Decrypt
                    </button>
                    <div className="h-4 w-px bg-slate-200"></div>
                     <button className="flex items-center gap-1.5 text-[11px] font-black text-orange-500 hover:text-orange-600 uppercase tracking-widest transition-transform hover:scale-105 active:scale-95">
                        <FiAlertCircle size={14} /> View Discrepancies
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto scrollbar-elegant">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead className="logistics-table-head">
                        <tr>
                            <th className="w-[100px]">Forensic ID</th>
                            <th>Creator / Operator</th>
                            <th>Date Snapshot</th>
                            <th>Time Window</th>
                            <th className="text-right">Closing Vol (L)</th>
                            <th className="text-right">Closing Cash</th>
                            <th className="text-right">Spending</th>
                            <th className="text-right">Variance</th>
                            <th>Analytical Notes</th>
                            <th className="text-right">Sync Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {shifts.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="px-6 py-20 text-center">
                                    <div className="flex flex-col items-center opacity-30">
                                        <FiShield size={48} className="text-slate-400 mb-4" />
                                        <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[11px]">No shift logs found in the intelligence archive.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : shifts.map((shift: any) => {
                            const received = shift.received_collections || {};
                            const variance = shift.variance_data || {};
                            const openedBy = received.opened_by?.display || 'Unknown';
                            const spending = received.spending || 0;
                            const closingVol = received.closing_volume || 0;
                            const closingCash = received.cash || 0;
                            
                            // Forensic alert check
                            const isCritical = Math.abs(variance.amount) > 100;

                            return (
                                <tr key={shift.id} className={`logistics-row ${isCritical ? 'has-alert' : ''} group`}>
                                    <td className="logistics-cell">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-black text-slate-400 font-mono tracking-tighter">#{shift.id.slice(0, 8).toUpperCase()}</span>
                                        </div>
                                    </td>
                                    <td className="logistics-cell">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-500 shadow-sm border border-white group-hover:from-purple-500 group-hover:to-indigo-600 group-hover:text-white transition-all duration-300">
                                                <FiUser size={14} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="logistics-operator-bold">{openedBy}</span>
                                                <span className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">System Operator</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="logistics-cell">
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <FiCalendar size={12} className="text-slate-300" />
                                            <span className="text-xs font-black">{format(new Date(shift.opened_at), 'MMM dd, yyyy')}</span>
                                        </div>
                                    </td>
                                    <td className="logistics-cell">
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <FiClock size={12} className="text-purple-300" />
                                            <span className="text-[10px] font-bold uppercase">{format(new Date(shift.opened_at), 'HH:mm')} — {format(new Date(shift.closed_at), 'HH:mm')}</span>
                                        </div>
                                    </td>
                                    <td className="logistics-cell text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="logistics-value-bold flex items-center gap-1">
                                                <FiDroplet size={11} className="text-indigo-400" />
                                                {Math.round(closingVol).toLocaleString()}
                                            </span>
                                            <span className="text-[9px] text-slate-400 font-black uppercase">Liters</span>
                                        </div>
                                    </td>
                                    <td className="logistics-cell text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm font-black text-slate-800">${closingCash.toLocaleString()}</span>
                                            <span className="text-[9px] text-emerald-500 font-black uppercase items-center flex gap-1">
                                                <FiDollarSign size={8} /> Revenue
                                            </span>
                                        </div>
                                    </td>
                                    <td className="logistics-cell text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm font-black text-red-500">${spending.toLocaleString()}</span>
                                            <span className="text-[9px] text-red-400/60 font-black uppercase">Spent</span>
                                        </div>
                                    </td>
                                    <td className="logistics-cell text-right">
                                         <div className="flex flex-col items-end">
                                            <div className={`text-sm font-black px-3 py-1 rounded-lg border flex items-center gap-2 group-hover:scale-105 transition-transform ${
                                                variance.amount > 0 
                                                    ? 'text-red-600 bg-red-50 border-red-100' 
                                                    : variance.amount < 0 
                                                    ? 'text-emerald-600 bg-emerald-50 border-emerald-100' 
                                                    : 'text-slate-400 bg-slate-50 border-slate-100'
                                            }`}>
                                                {variance.amount === 0 ? 'BALANCED' : (
                                                    <>
                                                        {variance.amount > 0 ? '-' : '+'}${Math.abs(variance.amount).toFixed(2)}
                                                        {isCritical && <FiAlertTriangle className="animate-bounce" size={14} />}
                                                    </>
                                                )}
                                            </div>
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Variance Delta</span>
                                        </div>
                                    </td>
                                    <td className="logistics-cell">
                                        <div className="max-w-[180px]">
                                            <p className="acp-note-truncate text-[11px] font-bold text-slate-500 italic leading-tight" title={shift.notes}>
                                                {shift.notes || 'No forensic remarks documented for this session.'}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="logistics-cell text-right">
                                        <button className="px-4 py-2 rounded-xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-purple-600 hover:shadow-lg hover:shadow-purple-200 transition-all duration-300">
                                            Details
                                        </button>
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
