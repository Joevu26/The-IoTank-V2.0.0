import React from 'react';
import { FiAlertTriangle, FiX, FiShield, FiClock, FiActivity, FiMapPin } from 'react-icons/fi';
import './SecurityIntrusionModal.css';

interface SecurityIntrusionModalProps {
    event: {
        message: string;
        metadata: {
            forensicData: {
                type: 'THEFT' | 'LEAK';
                dropRate: number;
                volumeLost?: number;
                tankName: string;
                timestamp: string;
            };
        };
    };
    onClose: () => void;
}

export const SecurityIntrusionModal: React.FC<SecurityIntrusionModalProps> = ({ event, onClose }) => {
    const { forensicData } = event.metadata;
    const isTheft = forensicData.type === 'THEFT';

    return (
        <div className="security-modal-overlay" role="dialog" aria-modal="true">
            <div className={`security-modal ${isTheft ? 'theft-alert' : 'leak-alert'}`}>
                {/* Header Section */}
                <div className="security-modal-header">
                    <div className="header-badge">
                        <FiShield className="badge-icon" />
                        <span>Security Protocol Level 1</span>
                    </div>
                    <button onClick={onClose} className="close-trigger" aria-label="Dismiss Alert">
                        <FiX />
                    </button>
                </div>

                {/* Main Alert Banner */}
                <div className="security-alert-banner">
                    <div className="pulse-icon-container">
                        <FiAlertTriangle className="pulse-icon" />
                        <div className="pulse-ring"></div>
                        <div className="pulse-ring-outer"></div>
                    </div>
                    <div className="alert-text-block">
                        <h2 className="alert-title">
                            {isTheft ? 'CRITICAL INTRUSION DETECTED' : 'SYSTEM LEAK DETECTED'}
                        </h2>
                        <p className="alert-subtitle">
                            Forensic anomaly identified on {forensicData.tankName}
                        </p>
                    </div>
                </div>

                {/* Forensic Data Grid */}
                <div className="forensic-grid">
                    <div className="forensic-card">
                        <div className="card-lbl"><FiActivity /> Loss Rate</div>
                        <div className="card-val">{forensicData.dropRate.toFixed(1)} <span className="u">L/hr</span></div>
                    </div>
                    <div className="forensic-card">
                        <div className="card-lbl"><FiShield /> Cumulative Loss</div>
                        <div className="card-val">{forensicData.volumeLost?.toFixed(1) || '--'} <span className="u">L</span></div>
                    </div>
                    <div className="forensic-card">
                        <div className="card-lbl"><FiClock /> Detected At</div>
                        <div className="card-val">{new Date(forensicData.timestamp).toLocaleTimeString()}</div>
                    </div>
                    <div className="forensic-card">
                        <div className="card-lbl"><FiMapPin /> Status</div>
                        <div className="card-val unauth">SHIFT CLOSED</div>
                    </div>
                </div>

                {/* Analysis Message */}
                <div className="security-analysis-box">
                    <div className="analysis-header">Forensic Analysis Report</div>
                    <p className="analysis-body">
                        {event.message}
                        {isTheft 
                            ? " This discharge rate exceeds operational benchmarks for 'Quiet Hours'. Local security dispatch recommended." 
                            : " Persistent downward variance detected without active pump engagement. Maintenance review required."}
                    </p>
                </div>

                {/* Action Footer */}
                <div className="security-modal-footer">
                    <button onClick={onClose} className="btn-dismiss">Log Investigation Only</button>
                    <button onClick={() => {
                        window.dispatchEvent(new CustomEvent('system-toast', {
                            detail: { title: 'Security Notified', message: 'Regional response team has been alerted.', type: 'error' }
                        }));
                        onClose();
                    }} className="btn-action">
                        {isTheft ? 'Dispatch Security Team' : 'Request Maintenance'}
                    </button>
                </div>
            </div>
        </div>
    );
};
