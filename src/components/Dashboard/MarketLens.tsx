import { FiExternalLink, FiClock, FiRss, FiCheck } from 'react-icons/fi';
import React, { useState, useMemo } from 'react';
import { useMarketNews } from '@/hooks/useMarketNews';
import '../Common/DesignSystemCards.css';
import './MarketLens.css';

interface MarketLensProps {
    stationId: string;
}

export const MarketLens: React.FC<MarketLensProps> = () => {
    const { filteredArticles, status } = useMarketNews();
    const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({});
    const loading = status === 'loading';

    // Filter Logic: Only Price, Political, and Compliance news. Hide acknowledged items.
    const displayedArticles = useMemo(() => {
        if (!filteredArticles) return [];
        return filteredArticles.filter(a => 
            !acknowledged[a.id] && 
            (a.implicationCategory === 'Price' || 
             a.implicationCategory === 'Political' || 
             a.implicationCategory === 'Compliance')
        );
    }, [filteredArticles, acknowledged]);

    const handleAcknowledge = (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // The item will disappear due to the useMemo filter
        setAcknowledged(prev => ({ ...prev, [id]: true }));
    };

    return (
        <div className="market-lens-container ds-premium-card">
            <div className="market-lens-header">
                <div className="market-lens-title-group">
                    <div className="market-lens-icon">
                        <FiRss size={18} />
                    </div>
                    <div>
                        <h3 className="market-lens-title">Intelligence Feed</h3>
                        <p className="market-lens-subtitle">Real-time Commodity Signals</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="signals-count-badge">
                        {displayedArticles.length} SIGNALS
                    </div>
                    <div className="market-lens-badge">
                        Live
                    </div>
                </div>
            </div>

            <div className="market-feed-scroll custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-48 space-y-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-500 border-t-transparent"></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scanning Markets...</span>
                    </div>
                ) : displayedArticles.length > 0 ? (
                    displayedArticles.map((signal, idx) => (
                        <div key={signal.id || idx} className="market-item animate-in fade-in slide-in-from-right duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                            <div className="market-item-main">
                                <div className="market-item-header">
                                    <div className="flex items-center gap-2">
                                        <img 
                                            src={`https://www.google.com/s2/favicons?domain=${new URL(signal.url || 'https://google.com').hostname}&sz=32`} 
                                            alt="" 
                                            className="w-3.5 h-3.5 rounded-sm grayscale group-hover:grayscale-0 transition-all object-contain"
                                            onError={(e) => { 
                                                const target = e.target as HTMLImageElement;
                                                target.style.opacity = '0';
                                            }}
                                        />
                                        <span className="market-item-source">{signal.attribution || signal.source}</span>
                                    </div>
                                    <div className="market-item-time">
                                        <FiClock size={10} />
                                        {new Date(signal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                                <h4 className="market-item-title">{signal.title}</h4>
                                <p className="market-item-summary">{signal.summary?.substring(0, 120)}...</p>
                                <div className="market-item-footer">
                                    <a 
                                        href={signal.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="market-item-link"
                                    >
                                        Source Report <FiExternalLink size={10} />
                                    </a>
                                    <button 
                                        onClick={(e) => handleAcknowledge(signal.id, e)}
                                        className="market-item-ack-btn group"
                                        title="Dismiss Intelligence"
                                    >
                                        <FiCheck size={14} className="group-hover:text-green-500 transition-colors" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center px-8 py-10 animate-fade-in">
                        <div className="relative mb-8">
                            {/* Radar Rings */}
                            <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping duration-[3000ms]" />
                            <div className="absolute -inset-4 bg-indigo-500/5 rounded-full animate-pulse" />
                            
                            <div className="relative p-6 bg-white border border-indigo-50 shadow-xl rounded-3xl z-10">
                                <FiRss size={32} className="text-indigo-600 animate-pulse" />
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="flex flex-col items-center gap-1">
                                <span className="bg-indigo-50 text-indigo-700 text-[9px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest border border-indigo-100">
                                    Scanning Network
                                </span>
                                <h5 className="text-sm font-black text-slate-800 tracking-tight">Satellite Sync Active</h5>
                            </div>
                            
                            <div className="flex items-center justify-center gap-2 py-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '200ms' }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '400ms' }} />
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-50 w-full flex flex-col items-center opacity-40">
                            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 italic">Monitoring Commodity Parities</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
