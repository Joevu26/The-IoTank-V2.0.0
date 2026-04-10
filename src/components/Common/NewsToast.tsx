import React, { useState, useEffect } from 'react';
import { MarketSignal } from '@/types';
import { FiBell, FiX } from 'react-icons/fi';
import './DesignSystemCards.css';

export const NewsToast: React.FC = () => {
    const [toast, setToast] = useState<MarketSignal | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const handleNewsUpdate = (event: Event) => {
            const customEvent = event as CustomEvent<MarketSignal>;
            setToast(customEvent.detail);
            setVisible(true);

            // Auto-dismiss after 6 seconds
            const timer = setTimeout(() => {
                setVisible(false);
            }, 6000);

            return () => clearTimeout(timer);
        };

        window.addEventListener('market-news-update', handleNewsUpdate);
        return () => window.removeEventListener('market-news-update', handleNewsUpdate);
    }, []);

    if (!toast) return null;

    return (
        <div
            className={`fixed bottom-6 right-6 z-[2000] transition-all duration-500 ease-in-out transform ${visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}
            role="alert"
        >
            <div className="ds-card ds-card-panel flex items-start gap-4 p-4 max-w-sm bg-white dark:bg-gray-900 border-l-4 border-l-accent shadow-2xl">
                <div className="p-2 bg-accent/10 rounded-full text-accent shrink-0">
                    <FiBell size={20} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">
                            {toast.sourceType} • {toast.attribution}
                        </span>
                        <span className="text-[10px] text-accent font-medium">Just Now</span>
                    </div>

                    <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-1 line-clamp-2">
                        {toast.title}
                    </h4>

                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                        {toast.summary}
                    </p>
                </div>

                <button
                    onClick={() => setVisible(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <FiX size={16} />
                </button>
            </div>
        </div>
    );
};
