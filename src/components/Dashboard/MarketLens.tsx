/* eslint-disable @typescript-eslint/no-explicit-any */
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
        <div style={{
            background: '#fff',
            borderRadius: '20px',
            border: '1px solid #f1f5f9',
            boxShadow: '0 4px 24px -8px rgba(30,27,75,0.08)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            marginBottom: '16px',
            height: '360px'
        }}>
            {/* ── Premium Header ── */}
            <div style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FiTarget size={16} style={{ color: '#c4b5fd', strokeWidth: 2.5 }} className="animate-pulse" />
                    <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
                        News Feed
                    </span>
                </div>
                <div style={{
                    background: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: '20px',
                    padding: '3px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Live
                    </span>
                </div>
            </div>

            {/* ── News Headlines (Scrollable) ── */}
            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '8px 0' }} className="custom-scrollbar">
                {signals && signals.length > 0 ? (
                    signals.map((signal, idx) => (
                        <div 
                            key={idx}
                            style={{
                                padding: '12px 20px',
                                borderBottom: idx < signals.length - 1 ? '1px solid #f8fafc' : 'none',
                                transition: 'background 0.15s ease',
                                cursor: 'pointer'
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            onClick={() => { if(signal.externalUrl) window.open(signal.externalUrl, '_blank') }}
                        >
                            <p style={{ fontSize: '12px', fontWeight: 700, color: '#334155', lineHeight: '1.45', margin: '0 0 4px 0' }}>
                                {signal.title}
                            </p>
                            {signal.summary && (
                                <p style={{ fontSize: '11px', fontWeight: 500, color: '#64748b', lineHeight: '1.4', margin: '0 0 6px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {signal.summary}
                                </p>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {signal.source || 'Market Data'}
                                </span>
                            </div>
                        </div>
                    ))
                ) : !loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px', color: '#94a3b8' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, fontStyle: 'italic' }}>No recent market news.</span>
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px', color: '#94a3b8' }}>
                        <FiRefreshCw size={14} className="animate-spin" />
                        <span style={{ fontSize: '12px', fontWeight: 600, fontStyle: 'italic' }}>Scanning Global Vectors...</span>
                    </div>
                )}
            </div>
        </div>

    );
};
