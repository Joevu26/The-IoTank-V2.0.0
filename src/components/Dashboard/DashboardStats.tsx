import React, { useMemo } from 'react';
import { Tank, Alert } from '@/types';
import { useAllLatestReadings } from '@/hooks/useSupabase';
import { ShiftCloseCard } from './ShiftCloseCard';
import { FiLayers, FiTrendingUp, FiCheckCircle } from 'react-icons/fi';
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


    // Trend calculation (mock for demo)
    const totalTrend = "+2.4%";

    return (
        <div className="dashboard-stats-container">

            <div className="stats-grid">
                {/* Card 1: Cumulative Total Volume */}
                <div className="ds-card ds-card-panel ds-card-full-gradient bg-cyan-industrial stat-card">
                    <div className="stat-content h-full flex flex-col justify-between">
                        <div className="stat-header">
                            <span className="stat-label-refined">Total Network Volume</span>
                            <FiLayers className="stat-icon" />
                        </div>
                        <div className="stat-value-large">
                            {tanks.length === 0 && stationId ? (
                                <span className="animate-pulse">...</span>
                            ) : (
                                Math.round(totalVolume).toLocaleString()
                            )}
                            <span className="stat-value-unit">L</span>
                        </div>
                        <div className="stat-meta">
                            <span className="text-[10px] font-black tracking-widest uppercase">
                                {tanks.length === 0 && stationId ? 'Synchronizing fleet...' : `Across ${tanks.length} Active Tanks`}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Card 2: Cumulative Asset Value (Level 6+) */}
                {canSee(6) && (
                    <div 
                        className={`ds-card ds-card-panel ds-card-full-gradient ${hasMissingPrices ? 'bg-amber-600 shadow-amber-200' : 'bg-emerald-industrial'} stat-card clickable group`} 
                        onClick={() => navigate('/settings')}
                        title={hasMissingPrices ? "Configure Fuel Prices to enable valuation" : "View Inventory Pricing"}
                    >
                        <div className="stat-content h-full flex flex-col justify-between">
                            <div className="stat-header">
                                <span className="stat-label-refined">Total Asset Value</span>
                                <FiCheckCircle className="stat-icon" />
                            </div>
                            <div className="stat-value-large">
                                {tanks.length === 0 && stationId ? (
                                    <span className="animate-pulse">...</span>
                                ) : hasMissingPrices ? (
                                    <span className="text-white underline text-sm animate-pulse flex items-center gap-2">
                                        N/A (SET PRICES)
                                    </span>
                                ) : (
                                    <>
                                        <span className="text-sm opacity-60 mr-1">Ksh</span> 
                                        {totalAssetValue.toLocaleString(undefined, {
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 0
                                        })}
                                    </>
                                )}
                            </div>
                            <div className="stat-meta">
                                <span className="text-[10px] font-black tracking-widest uppercase">Global Revaluation</span>
                                <div className="stat-trend-chip bg-white/20 text-white">
                                    <FiTrendingUp /> {totalTrend}
                                </div>
                            </div>
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
