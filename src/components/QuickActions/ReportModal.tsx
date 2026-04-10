import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { MdClose, MdSummarize, MdPictureAsPdf } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import { useClickOutside } from '@/hooks/useClickOutside';
import './QuickActions.css';

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose }) => {
    const [reportType, setReportType] = useState('inventory');
    const [period, setPeriod] = useState('today');
    const navigate = useNavigate();

    const modalRef = useClickOutside(onClose);

    if (!isOpen) return null;

    const handleGenerate = () => {
        navigate(`/reporting?type=${encodeURIComponent(reportType)}&period=${encodeURIComponent(period)}`);
        onClose();
    };

    return createPortal(
        <div className="qa-modal-overlay animate-in fade-in duration-300">
            <div className="qa-modal-container animate-slide-up" style={{ maxWidth: '450px' }} ref={modalRef}>
                <div className="qa-modal-header">
                    <div className="header-title-group">
                        <MdSummarize className="header-icon text-info" />
                        <div>
                            <h2>Generate Intelligent Report</h2>
                            <p className="text-secondary text-xs">Export operational data for audit.</p>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose}><MdClose /></button>
                </div>

                <div className="qa-modal-body space-y-6">
                    <div className="form-group">
                        <label>Report Type</label>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            <button
                                className={`qa-choice-btn ${reportType === 'inventory' ? 'active' : ''}`}
                                onClick={() => setReportType('inventory')}
                            >
                                <MdSummarize /> Inventory
                            </button>
                            <button
                                className={`qa-choice-btn ${reportType === 'delivery' ? 'active' : ''}`}
                                onClick={() => setReportType('delivery')}
                            >
                                <MdSummarize /> Deliveries
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Report Period</label>
                        <select
                            className="qa-input"
                            value={period}
                            onChange={e => setPeriod(e.target.value)}
                        >
                            <option value="today">Today (Last 24h)</option>
                            <option value="week">Past 7 Days</option>
                            <option value="month">Last 30 Days</option>
                            <option value="custom">Custom Range...</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Export Format</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                                <input type="radio" name="format" defaultChecked /> PDF (Rich Visual)
                            </label>
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                                <input type="radio" name="format" /> CSV (Data Only)
                            </label>
                        </div>
                    </div>

                    <div className="qa-modal-footer mt-8">
                        <button className="btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn-primary flex items-center gap-2" onClick={handleGenerate}>
                            <MdPictureAsPdf /> Generate PDF Report
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
