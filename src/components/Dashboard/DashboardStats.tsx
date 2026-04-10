import React, { useMemo } from 'react';
import { Tank, Alert, TankReading } from '@/types';
import { useAllLatestReadings } from '@/hooks/useSupabase';
import { ShiftCloseCard } from './ShiftCloseCard';
import { FiLayers, FiTrendingUp, FiCheckCircle } from 'react-icons/fi';
import '../Common/DesignSystemCards.css';
import './DashboardStats.css';

interface DashboardStatsProps {
    tanks: Tank[];
    stationId: string;
    alerts: Alert[];
    currency: 'USD' | 'Ksh';
    onCurrencyToggle: () => void;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({
    tanks,
    stationId,
    currency,
    onCurrencyToggle
}) => {
    
    // --- CUMULATIVE METRICS LOGIC ---
    // Fetch readings for all tanks to calculate totals safely
    const tankIds = useMemo(() => tanks.map(t => t.id), [tanks]);
    const { readings: allReadings } = useAllLatestReadings(stationId, tankIds);
    const readingsArray = useMemo(() => Object.values(allReadings) as TankReading[], [allReadings]);

    // Total Volume across all tanks
    const totalVolume = useMemo(() => {
        return readingsArray.reduce((sum: number, r: TankReading) => sum + (r.volumeCorrected || r.volume || 0), 0);
    }, [readingsArray]);

    // Total Asset Value across all tanks (Dynamic Pricing)
    const totalAssetValue = useMemo(() => {
        const savedPrices = localStorage.getItem('iotank_fuel_pricing');
        const fuelPrices = savedPrices ? JSON.parse(savedPrices) : {};

        return readingsArray.reduce((sum: number, r: TankReading) => {
            const tank = tanks.find(t => t.id === r.tankId);
            const fuelType = tank?.fuelType || 'diesel';
            const price = fuelPrices[fuelType] || (currency === 'USD' ? 1.45 : 190.50);

            const val = (r.volumeCorrected || r.volume || 0) * price;
            return sum + val;
        }, 0);
    }, [readingsArray, currency, tanks]);


    // Trend calculation (mock for demo)
    const totalTrend = "+2.4%";

    return (
        <div className="dashboard-stats-container">

            <div className="stats-grid">
                {/* Card 1: Cumulative Total Volume */}
                <div className="ds-card ds-card-panel stat-card">
                    <div className="stat-header">
                        <span className="stat-label">Total Network Volume</span>
                        <FiLayers className="stat-icon text-primary" />
                    </div>
                    <div className="stat-value-large text-success">
                        {Math.round(totalVolume).toLocaleString()}
                        <span className="text-sm text-secondary font-normal ml-1">L</span>
                    </div>
                    <div className="stat-meta">
                        <span className="text-xs text-secondary">
                            Across {tanks.length} Active Tanks
                        </span>
                    </div>
                </div>

                {/* Card 2: Cumulative Asset Value */}
                <div className="ds-card ds-card-panel stat-card clickable" onClick={onCurrencyToggle}>
                    <div className="stat-header">
                        <span className="stat-label">Total Asset Value</span>
                        <FiCheckCircle className="stat-icon text-success" />
                    </div>
                    <div className="stat-value-large text-success">
                        KES {totalAssetValue.toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                        })}
                    </div>
                    <div className="stat-meta">
                        <span className="text-xs text-secondary">Global Revaluation</span>
                        <span className="text-xs font-bold text-success flex items-center gap-1">
                            <FiTrendingUp /> {totalTrend}
                        </span>
                    </div>
                </div>
                {/* Card 3: Shift Management (Action) */}
                <div className="shift-mgmt-wrapper h-full">
                    <ShiftCloseCard tank={tanks[0] || null} />
                </div>
            </div>

        </div>
    );
};
