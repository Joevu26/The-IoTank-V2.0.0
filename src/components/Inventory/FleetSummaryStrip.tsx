import React from 'react';
import { Tank } from '@/types';
import { formatVolume } from '@/utils/formatUtils';
import { FiActivity, FiDatabase, FiAlertCircle } from 'react-icons/fi';
import './FleetSummaryStrip.css';

interface FleetSummaryStripProps {
    tanks: Tank[];
}

export const FleetSummaryStrip: React.FC<FleetSummaryStripProps> = ({ tanks }) => {
    if (tanks.length === 0) return null;

    const totalVolume = tanks.reduce((acc, tank) => acc + (tank.currentVolume || 0), 0);
    const totalCapacity = tanks.reduce((acc, tank) => acc + (tank.capacity || 0), 0);
    const avgFillPercent = totalCapacity > 0 ? (totalVolume / totalCapacity) * 100 : 0;

    // Find highest and lowest fill %
    const tankPercents = tanks.map(t => ({
        name: t.name,
        percent: t.capacity ? ((t.currentVolume || 0) / t.capacity) * 100 : 0
    }));

    const lowestTank = tankPercents.reduce((prev, curr) => (prev.percent < curr.percent) ? prev : curr);
    const highestTank = tankPercents.reduce((prev, curr) => (prev.percent > curr.percent) ? prev : curr);

    return (
        <div className="fleet-summary-strip">
            <div className="summary-section">
                <span className="summary-label">
                    <FiDatabase className="summary-icon" /> Fleet Overview
                </span>
                <span className="summary-value">{formatVolume(totalVolume)} <small>Total Corrected</small></span>
            </div>

            <div className="summary-divider"></div>

            <div className="summary-section">
                <span className="summary-label">Average Fill</span>
                <div className="summary-progress-wrapper">
                    <div className="summary-progress-bar" style={{ width: `${avgFillPercent}%` }}></div>
                    <span className="summary-value-compact">{avgFillPercent.toFixed(1)}%</span>
                </div>
            </div>

            <div className="summary-divider"></div>

            <div className="summary-section">
                <span className="summary-label">Range Metrics</span>
                <div className="flex gap-4">
                    <div className="range-item">
                        <FiAlertCircle className="text-danger" />
                        <span>Min: <strong>{lowestTank.percent.toFixed(0)}%</strong> <small>({lowestTank.name})</small></span>
                    </div>
                    <div className="range-item">
                        <FiActivity className="text-success" />
                        <span>Max: <strong>{highestTank.percent.toFixed(0)}%</strong> <small>({highestTank.name})</small></span>
                    </div>
                </div>
            </div>

            <div className="summary-divider"></div>

            <div className="summary-section">
                <span className="summary-label">Cluster Status</span>
                <span className="summary-value-compact">
                    <span className="status-dot"></span> {tanks.length} / 4 Tanks Active
                </span>
            </div>
        </div>
    );
};
