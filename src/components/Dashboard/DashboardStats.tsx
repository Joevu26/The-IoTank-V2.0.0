import React, { useMemo } from 'react';
import { Tank, Alert } from '@/types';
import { useAllLatestReadings } from '@/hooks/useSupabase';
import { ShiftCloseCard } from './ShiftCloseCard';
import { FiTrendingUp, FiCheckCircle } from 'react-icons/fi';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import '../Common/DesignSystemCards.css';
import './DashboardStats.css';

interface DashboardStatsProps {
    tanks: Tank[];
    stationId: string;
    alerts: Alert[];
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({
    tanks,
    stationId
}) => {
    const navigate = useNavigate();
    const { canSee } = useAuth();
    
    // --- CUMULATIVE METRICS LOGIC ---
    // Fetch readings for all tanks to calculate totals safely
    const tankIds = useMemo(() => tanks.map(t => t.id), [tanks]);
    const { readings: allReadings } = useAllLatestReadings(stationId, tankIds);
    // CUMULATIVE METRICS LOGIC
    const { totalVolume, totalAssetValue, hasMissingPrices } = useMemo(() => {
        let volTotal = 0;
        let assetTotal = 0;
        let missing = false;

        for (const tank of tanks) {
            const reading = allReadings[tank.id];
            const vol = reading?.volumeCorrected || reading?.volume || tank.currentVolume || 0;
            
            // [FORENSIC HARDENING]: Strictly use Authorized Retail Price from Settings (Tank Metadata)
            const price = Number((tank as any).metadata?.retailPrice) || 0;

            volTotal += vol;
            assetTotal += (vol * price);
            if (price <= 0 && vol > 0) missing = true;
        }

        return { 
            totalVolume: volTotal, 
            totalAssetValue: assetTotal, 
            hasMissingPrices: missing 
        };
    }, [allReadings, tanks]);


    // Trend calculation removed: using real pricing status below.

    return (
        <div className="dashboard-stats-container">

            <div className="stats-grid">
                {/* Card 1: Cumulative Total Volume */}
                <div className="stat-card-clean">
                    <div className="stat-header">
                        <div className="stat-title-group">
                            <div className="status-dot active" />
                            <div>
                                <p className="stat-card-label">Volume Matrix</p>
                                <h4 className="stat-card-title">Total Network Volume</h4>
                            </div>
                        </div>
                        <span className="status-badge info">
                            {tanks.length} Tank{tanks.length === 1 ? '' : 's'}
                        </span>
                    </div>
                    
                    <div className="stat-value-display">
                        <h2 className="stat-main-value">
                            {tanks.length === 0 && stationId ? (
                                <span className="animate-pulse">...</span>
                            ) : (
                                Math.round(totalVolume).toLocaleString()
                            )}
                            <span className="stat-main-unit">L</span>
                        </h2>
                    </div>

                    <div className="stat-sub-row">
                        <span className="stat-sub-label">Aggregate Live Capacity</span>
                        <div className="stat-trend-indicator neutral">
                             Synchronized
                        </div>
                    </div>
                </div>

                {/* Card 2: Cumulative Asset Value (Level 6+) */}
                {canSee(6) && (
                    <div 
                        className="stat-card-clean clickable"
                        onClick={() => navigate('/settings')}
                    >
                        <div className="stat-header">
                            <div className="stat-title-group">
                                <div className={`status-dot ${hasMissingPrices ? 'warning' : 'success'}`} />
                                <div>
                                    <p className="stat-card-label">Asset Valuation</p>
                                    <h4 className="stat-card-title">Total Portfolio Value</h4>
                                </div>
                            </div>
                            <span className={`status-badge ${hasMissingPrices ? 'warning' : 'success'}`}>
                                {hasMissingPrices ? 'Pricing Warning' : 'Active Valuation'}
                            </span>
                        </div>

                        <div className="stat-value-display">
                            <h2 className="stat-main-value">
                                {tanks.length === 0 && stationId ? (
                                    <span className="animate-pulse">...</span>
                                ) : hasMissingPrices ? (
                                    <span className="text-amber-600 text-sm font-semibold">SET PRICES</span>
                                ) : (
                                    <>
                                        <span className="stat-main-unit mr-1">Ksh</span>
                                        {totalAssetValue.toLocaleString(undefined, {
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 0
                                        })}
                                    </>
                                )}
                            </h2>
                        </div>

                        <div className="stat-sub-row">
                            <span className="stat-sub-label">Current Market Position</span>
                            {!hasMissingPrices ? (
                                <div className="stat-trend-indicator up">
                                    <FiCheckCircle size={10} /> Live Sync
                                </div>
                            ) : (
                                <div className="stat-trend-indicator warning" style={{ color: '#b45309' }}>
                                    <FiTrendingUp size={10} /> Manual Update Needed
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Card 3: Shift Management (Action) */}
                <div className="shift-mgmt-wrapper h-full">
                    <ShiftCloseCard tank={tanks[0] || null} />
                </div>
            </div>

        </div>
    );
};
