import React, { useState, useEffect, useRef } from 'react';
import { FiX } from 'react-icons/fi';
import './GlobalToast.css';

interface ToastData {
    id: string;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'market' | 'refill';
    attribution?: string;
    visible: boolean;
    progress: number;
}

export const GlobalToast: React.FC = () => {
    const [toasts, setToasts] = useState<ToastData[]>([]);
    const toastsRef = useRef<ToastData[]>([]);

    // Sync ref with state for use in intervals/timers
    useEffect(() => {
        toastsRef.current = toasts;
    }, [toasts]);

    useEffect(() => {
        const handleToast = (event: Event) => {
            const customEvent = event as CustomEvent<any>;
            const detail = customEvent.detail;
            const id = Math.random().toString(36).substring(2, 11);
            
            let newToast: ToastData;
            
            if (event.type === 'market-news-update') {
                const signal = detail;
                newToast = {
                    id,
                    title: signal.title,
                    message: signal.summary,
                    type: 'market',
                    attribution: `${signal.sourceType} • ${signal.attribution}`,
                    visible: true,
                    progress: 100
                };
            } else {
                newToast = {
                    ...detail,
                    id,
                    visible: true,
                    progress: 100
                };
            }
            
            setToasts(prev => [newToast, ...prev].slice(0, 5)); // Keep last 5 toasts

            const duration = detail?.type === 'refill' ? 8000 : 5000;
            const step = 100;
            
            // Progress bar interval
            const progressInterval = setInterval(() => {
                setToasts(prev => prev.map(t => 
                    t.id === id 
                        ? { ...t, progress: Math.max(0, t.progress - (step / duration) * 100) }
                        : t
                ));
            }, step);

            // Visibility timer
            setTimeout(() => {
                setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t));
                clearInterval(progressInterval);
                
                // Cleanup from array after animation
                setTimeout(() => {
                    setToasts(prev => prev.filter(t => t.id !== id));
                }, 500);
            }, duration);
        };

        window.addEventListener('market-news-update', handleToast);
        window.addEventListener('system-toast', handleToast);
        
        return () => {
            window.removeEventListener('market-news-update', handleToast);
            window.removeEventListener('system-toast', handleToast);
        };
    }, []);

    const removeToast = (id: string) => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t));
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 500);
    };

    const getSeverityLabel = (type: string) => {
        switch (type) {
            case 'error': return 'CRITICAL';
            case 'market': return 'MARKET_SIGNAL';
            case 'refill': return 'HARDWARE';
            case 'success': return 'OPERATIONAL';
            default: return 'WATCH';
        }
    };

    return (
        <div className="precision-toast-stack">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`precision-toast-container ${toast.visible ? 'active' : 'exiting'}`}
                    role="alert"
                >
                    <div className={`precision-toast-card-industrial status-${toast.type}`}>
                        <div className="toast-body-industrial">
                            <div className="toast-pill-wrapper">
                                <span className={`industrial-pill pill-${toast.type}`}>
                                    {getSeverityLabel(toast.type)}
                                </span>
                            </div>
                            
                            <div className="toast-content-industrial text-slate-800">
                                <div className="flex justify-between items-start">
                                    <h4 className="toast-title-industrial">{toast.title}</h4>
                                    <button onClick={() => removeToast(toast.id)} className="toast-close-mini">
                                        <FiX size={12} />
                                    </button>
                                </div>
                                <p className="toast-message-industrial">{toast.message}</p>
                                
                                <div className="toast-footer-industrial">
                                    <span className="toast-action-link">
                                        Investigate <span className="arrow">→</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="toast-progress-industrial">
                            <div className="toast-progress-bar-industrial" style={{ width: `${toast.progress}%` }} />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
