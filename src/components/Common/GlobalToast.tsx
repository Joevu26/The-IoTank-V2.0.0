import React, { useState, useEffect } from 'react';
import { FiBell, FiX, FiCheckCircle, FiAlertCircle, FiInfo } from 'react-icons/fi';
import './GlobalToast.css';

interface ToastData {
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'market';
    attribution?: string;
}

export const GlobalToast: React.FC = () => {
    const [toast, setToast] = useState<ToastData | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const handleToast = (event: Event) => {
            const customEvent = event as CustomEvent<any>;
            
            // Handle both market signals and generic system toasts
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

            const timer = setTimeout(() => {
                setVisible(false);
            }, 6000);

            return () => clearTimeout(timer);
        };

        window.addEventListener('market-news-update', handleToast);
        window.addEventListener('system-toast', handleToast);
        
        return () => {
            window.removeEventListener('market-news-update', handleToast);
            window.removeEventListener('system-toast', handleToast);
        };
    }, []);

    if (!toast) return null;

    const getIcon = () => {
        switch (toast.type) {
            case 'success': return <FiCheckCircle size={20} className="text-emerald-500" />;
            case 'error': return <FiAlertCircle size={20} className="text-rose-500" />;
            case 'market': return <FiBell size={20} className="text-indigo-500" />;
            default: return <FiInfo size={20} className="text-blue-500" />;
        }
    };

    const getBorderColor = () => {
        switch (toast.type) {
            case 'success': return 'border-l-emerald-500';
            case 'error': return 'border-l-rose-500';
            case 'market': return 'border-l-indigo-500';
            default: return 'border-l-blue-500';
        }
    };

    return (
        <div
            className={`fixed top-6 right-6 z-[10000] transition-all duration-500 ease-in-out transform ${visible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-10 opacity-0 scale-95 pointer-events-none'}`}
            role="alert"
        >
            <div className={`ds-card ds-card-panel flex items-start gap-4 p-4 min-w-[320px] max-w-sm bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-l-4 ${getBorderColor()} shadow-2xl`}>
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full shrink-0">
                    {getIcon()}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {toast.attribution || 'System Message'}
                        </span>
                        <span className="text-[10px] text-slate-300 font-medium">Just Now</span>
                    </div>

                    <h4 className="font-bold text-sm text-slate-800 dark:text-white mb-0.5 line-clamp-1">
                        {toast.title}
                    </h4>

                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed font-medium">
                        {toast.message}
                    </p>
                </div>

                <button
                    onClick={() => setVisible(false)}
                    className="p-1 text-slate-300 hover:text-slate-600 transition-colors"
                    title="Dismiss Notification"
                >
                    <FiX size={16} />
                </button>
            </div>
        </div>
    );
};
