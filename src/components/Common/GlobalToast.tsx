import React, { useState, useEffect } from 'react';
import { FiBell, FiX, FiCheckCircle, FiAlertCircle, FiInfo, FiTruck, FiActivity } from 'react-icons/fi';
import './GlobalToast.css';

interface ToastData {
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'market' | 'refill';
    attribution?: string;
}

export const GlobalToast: React.FC = () => {
    const [toast, setToast] = useState<ToastData | null>(null);
    const [visible, setVisible] = useState(false);
    const [progress, setProgress] = useState(100);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        let progressInterval: ReturnType<typeof setInterval>;

        const handleToast = (event: Event) => {
            const customEvent = event as CustomEvent<any>;
            
            if (event.type === 'market-news-update') {
                const signal = customEvent.detail;
                setToast({
                    title: signal.title,
                    message: signal.summary,
                    type: 'market',
                    attribution: `${signal.sourceType} • ${signal.attribution}`
                });
            } else {
                setToast(customEvent.detail);
            }
            
            setVisible(true);
            setProgress(100);

            if (timer) clearTimeout(timer);
            if (progressInterval) clearInterval(progressInterval);

            const duration = customEvent.detail?.type === 'refill' ? 8000 : 5000;
            const step = 100;
            
            progressInterval = setInterval(() => {
                setProgress(prev => Math.max(0, prev - (step / duration) * 100));
            }, step);

            timer = setTimeout(() => {
                setVisible(false);
                clearInterval(progressInterval);
            }, duration);
        };

        window.addEventListener('market-news-update', handleToast);
        window.addEventListener('system-toast', handleToast);
        
        return () => {
            window.removeEventListener('market-news-update', handleToast);
            window.removeEventListener('system-toast', handleToast);
            if (timer) clearTimeout(timer);
            if (progressInterval) clearInterval(progressInterval);
        };
    }, []);

    if (!toast) return null;

    const getIcon = () => {
        switch (toast.type) {
            case 'success': return <FiCheckCircle size={18} />;
            case 'error': return <FiAlertCircle size={18} />;
            case 'market': return <FiBell size={18} />;
            case 'refill': return <FiTruck size={18} />;
            default: return <FiInfo size={18} />;
        }
    };

    const getSeverityLabel = () => {
        switch (toast.type) {
            case 'success': return 'OPERATIONAL_SUCCESS';
            case 'error': return 'SYSTEM_EXCEPTION';
            case 'market': return 'MARKET_SIGNAL';
            case 'refill': return 'HARDWARE_TELEMETRY';
            default: return 'SYSTEM_ADVISORY';
        }
    };

    return (
        <div
            className={`precision-toast-container ${visible ? 'active' : ''}`}
            role="alert"
        >
            <div className={`precision-toast-card status-${toast.type}`}>
                <div className="toast-accent-line" />
                <div className="toast-header-compact">
                    <div className="toast-title-stack">
                        <span className="toast-attribution">{toast.attribution || 'SYSTEM INTERFACE'}</span>
                        <h4 className="toast-title-text">{toast.title}</h4>
                    </div>
                    <button onClick={() => setVisible(false)} className="toast-close-trigger">
                        <FiX size={14} />
                    </button>
                </div>

                <div className="toast-body-tactical">
                    <div className="toast-icon-wrapper">
                        {getIcon()}
                    </div>
                    <div className="toast-content-wrapper">
                        <span className="toast-severity-pill">{getSeverityLabel()}</span>
                        <p className="toast-message-text">{toast.message}</p>
                    </div>
                </div>

                <div className="toast-progress-container">
                    <div className="toast-progress-bar" style={{ width: `${progress}%` }} />
                </div>
            </div>
        </div>
    );
};
