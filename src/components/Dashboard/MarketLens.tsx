import React from 'react';
import { useMarketIntelligence } from '@/hooks/useMarketIntelligence';
import { FiTarget, FiRefreshCw } from 'react-icons/fi';
import '../Common/DesignSystemCards.css';
import './MarketLens.css';

interface MarketLensProps {
    stationId: string;
}

export const MarketLens: React.FC<MarketLensProps> = ({ stationId }) => {
    const { signals, loading } = useMarketIntelligence(stationId);

    return (
        <div className="ds-premium-card">
            {/* ── Premium Header ── */}
            <div className="ds-premium-header">
                <div className="flex items-center gap-2">
                    <FiTarget size={16} className="text-[#c4b5fd] animate-pulse stroke-[2.5px]" />
                    <span className="ds-premium-title">
                        News Feed
                    </span>
                </div>
                <div className="ds-premium-badge">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="ds-premium-badge-label">
                        Live
                    </span>
                </div>
            </div>

            {/* ── News Headlines (Scrollable) ── */}
            <div className="market-lens-body custom-scrollbar">
                {signals && signals.length > 0 ? (
                    signals.map((signal, idx) => (
                        <div 
                            key={idx}
                            className="market-lens-item"
                            onClick={() => { if(signal.externalUrl) window.open(signal.externalUrl, '_blank') }}
                        >
                            <p className="market-item-title">
                                {signal.title}
                            </p>
                            {signal.summary && (
                                <p className="market-item-summary">
                                    {signal.summary}
                                </p>
                            )}
                            <div className="flex items-center gap-1.5">
                                <span className="market-item-source">
                                    {signal.source || 'Market Data'}
                                </span>
                            </div>
                        </div>
                    ))
                ) : !loading ? (
                    <div className="market-empty-state">
                        <span className="text-xs font-semibold italic">No recent market news.</span>
                    </div>
                ) : (
                    <div className="market-loading-state">
                        <FiRefreshCw size={14} className="animate-spin text-indigo-400" />
                        <span className="text-xs font-semibold italic">Scanning Global Vectors...</span>
                    </div>
                )}
            </div>
        </div>
    );
};
