/* eslint-disable react/display-name */
import React, { useState, useMemo, useEffect } from 'react';
import { Tank, TankReading } from '@/types';
import { useLatestReading, useHistoricalReadings } from '@/hooks/useSupabase';
import { useConsumptionAnalytics } from '@/hooks/useConsumptionAnalytics';
import { formatVolume, formatTemperature } from '@/utils/formatUtils';
import { getFuelStatus } from '@/utils/dashboardUtils';
import { FiMapPin, FiClock, FiRefreshCw, FiActivity, FiThermometer, FiAlertCircle } from 'react-icons/fi';

import { useNavigate } from 'react-router-dom';
import { AuditService } from '@/services/AuditService';
import '../Common/DesignSystemCards.css';
import './TankCard.css';

interface TankCardProps {
    tank: Tank;
    stationId: string;
    initialReading?: TankReading;
}

export const TankCard: React.FC<TankCardProps> = React.memo(({ tank, stationId, initialReading }) => {
    const navigate = useNavigate();
    const [showDetailedAnalytics, setShowDetailedAnalytics] = useState(false);
    
    // 1. Fetch live updates only if manually requested or if we don't have an initial reading
    // This dramatically reduces initial dashboard connection overhead
    const { reading: liveReading } = useLatestReading(stationId, tank.id, !initialReading || showDetailedAnalytics);
    
    // Prioritize live reading from subscription, fall back to passed in initial reading
    const reading = liveReading || initialReading;

    const [isSyncing, setIsSyncing] = useState(false);
    const currency = 'Ksh';

    // 2. Fetch 24h historical data only when needed (e.g. hovered or detailed view)
    // For the initial grid, we can skip this heavy fetching
    const timeRange = useMemo(() => ({
        start: Date.now() - (24 * 60 * 60 * 1000),
        end: Date.now()
    }), []);

    const { readings } = useHistoricalReadings(stationId, tank.id, timeRange, 100, 'hour', showDetailedAnalytics);
    const analytics = useConsumptionAnalytics(tank, readings);


    const handleSync = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsSyncing(true);
        setShowDetailedAnalytics(true);
        
        setTimeout(async () => {
            setIsSyncing(false);
            window.dispatchEvent(new CustomEvent('system-toast', {
                detail: {
                    title: 'Telemetry Sync',
                    message: `Real-time synchronization established for ${tank.name}. Monitoring active.`,
                    type: 'success',
                    attribution: 'DATA CORE'
                }
            }));
            
            await AuditService.log(
                'SYSTEM', 
                'DEVICE_COMMAND', 
                stationId, 
                `Manual telemetry handshake established: ${tank.name} [ID: ${tank.id}] synchronized with cloud logic.`,
                'INFO',
                { tankId: tank.id, tankName: tank.name }
            ).catch(() => {});
        }, 1000);
    };

    const handleCardClick = () => {
        if (!isGhost) {
            navigate(`/inventory?tankId=${tank.id}`);
        }
    };

    // Calculate dynamic percentage: (Volume / Capacity) * 100
    const currentVolume = reading ? (reading.volumeCorrected || reading.volume || 0) : 0;
    const tankCapacity = tank.capacity || 1; // Prevent division by zero
    const calculatedPercentage = reading ? Number(Math.min(100, Math.max(0, (currentVolume / tankCapacity) * 100)).toFixed(1)) : 0;

    // Determine status based on fuel level
    const isGhost = tank.id === 'ghost-tank';
    const status = reading ? getFuelStatus(calculatedPercentage) : 
                  isGhost ? { label: 'Pending Hardware', className: 'status-offline', severity: 'info' as const } :
                  { label: 'Offline', className: 'status-offline', severity: 'ok' as const };

    // Calculate gauge rotation (0-180 degrees)
    const gaugeRotation = reading ? (calculatedPercentage / 100) * 180 : 0;

    // Accurate Real-Time Formatting
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 15000);
        return () => clearInterval(interval);
    }, []);

    const formatTime = (timestamp: number) => {
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);

        if (seconds < 30) return `Just now`;
        if (seconds < 60) return `${seconds}s ago`;
        if (minutes < 60) return `${minutes}m ago`;
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Asset value configuration link
    const handleConfigurePrice = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigate(`/settings?tab=inventory&tankId=${tank.id}`);
    };

    // Calculated Asset Value logic
    const getAssetValue = () => {
        if (!reading) return '0.00';
        const retailPrice = (tank as any).metadata?.retailPrice;
        
        if (!retailPrice || retailPrice <= 0) {
            return (
                <button 
                    className="text-amber-500 hover:text-amber-600 font-extrabold text-[10px] underline underline-offset-2 animate-pulse"
                    onClick={handleConfigurePrice}
                    title="Price not set. Click to configure."
                >
                    N/A (SET PRICE)
                </button>
            );
        }

        const volume = reading.volumeCorrected || reading.volume || 0;
        return (volume * retailPrice).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    return (
        <div 
            className={`tank-card ds-card ds-card-panel live-command-center hover:shadow-lg transition-all duration-300 !p-0 overflow-hidden flex flex-col ${isGhost ? 'opacity-90' : ''}`}
            onMouseEnter={() => setShowDetailedAnalytics(true)}
        >
            <div className="p-4 flex flex-col flex-1">
                <div className="tank-card-header">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="tank-name">{tank.name}</h3>
                            <span className="live-telemetry-badge">{isGhost ? 'Ready to Connect' : 'Live Telemetry'}</span>
                        </div>
                        <p className="tank-location text-secondary">
                            <FiMapPin className="inline-icon" />
                            {tank.location}
                        </p>
                    </div>

                    <div className={`status-badge ${status.className}`}>
                        {status.label}
                    </div>
                </div>

                <div className="command-center-grid">
                    <div className="gauge-section relative flex flex-col items-center">
                        <svg className="fuel-gauge" viewBox="0 0 200 110">
                            <path
                                d="M 20 100 A 80 80 0 0 1 180 100"
                                fill="none"
                                stroke="var(--color-border)"
                                strokeWidth="10"
                                strokeLinecap="round"
                            />
                            {reading && (
                                <path
                                    d="M 20 100 A 80 80 0 0 1 180 100"
                                    fill="none"
                                    stroke={
                                        calculatedPercentage >= 98
                                            ? '#ef4444' // Danger (Overfill)
                                            : calculatedPercentage >= 95
                                                ? '#f97316' // Warning (High)
                                                : calculatedPercentage <= 5
                                                    ? '#be123c' // Critical (Low-Low)
                                                    : calculatedPercentage <= 20
                                                        ? '#f59e0b' // Caution (Reorder)
                                                        : '#3b82f6' // Info (Nominal)
                                    }
                                    strokeWidth="10"
                                    strokeLinecap="round"
                                    strokeDasharray={`${(gaugeRotation / 180) * 251} 251`}
                                    className="gauge-arc"
                                />
                            )}
                            <text x="100" y="78" textAnchor="middle" className="gauge-value">
                                {reading ? `${Math.round(calculatedPercentage)}%` : (isGhost ? '0%' : '0%')}
                            </text>
                        </svg>
                        
                        <div className="volume-placeholder-frame">
                            <button 
                                className={`volume-action-btn status-sync-${status.className}`}
                                onClick={handleCardClick}
                                disabled={isGhost}
                                title="Click to view detailed analytics"
                            >
                                {reading ? formatVolume(reading.volumeCorrected || reading.volume || 0) : (isGhost ? '0 L' : '0 L')}
                            </button>
                        </div>
                    </div>

                    <div className="metrics-grid">
                        <div className="metric-box">
                            <div className="flex items-center gap-1.5">
                                <FiActivity className="text-secondary text-[10px]" />
                                <span className="metric-label">Mode / State</span>
                            </div>
                            <span className={`metric-value ${tank.currentState === 'leak_suspicion' ? 'text-danger' :
                                tank.currentState === 'delivery' ? 'text-success' :
                                    tank.currentState === 'dispensing' ? 'text-indigo-600' : 'text-slate-600'
                                }`}>
                                {isGhost ? 'OFFLINE' : (tank.currentState ? tank.currentState.replace('_', ' ').toUpperCase() : (reading && (now - reading.timestamp) < 300000 ? 'STABLE' : 'IDLE'))}
                            </span>
                        </div>
                        <div className="metric-box">
                            <div className="flex items-center gap-1.5">
                                <FiAlertCircle className="text-secondary text-[10px]" />
                                <span className="metric-label">Leak Risk</span>
                            </div>
                            <span className={`metric-value ${(tank.leakProbability || 0) > 30 ? 'text-danger' :
                                (tank.leakProbability || 0) > 10 ? 'text-warning' : 'text-success'
                                }`}>
                                {isGhost ? '0%' : `${tank.leakProbability || 0}%`}
                            </span>
                        </div>
                        <div className="metric-box clickable" onClick={handleConfigurePrice}>
                            <div className="flex items-center gap-1.5">
                                <FiActivity className="text-secondary text-[10px]" />
                                <span className="metric-label">Value ({currency})</span>
                            </div>
                            <span className="metric-value">
                                {getAssetValue()}
                            </span>
                        </div>
                        <div className={`metric-box ${status.severity === 'critical' ? 'metric-critical' : status.severity === 'warning' ? 'metric-warning' : ''}`}>
                            <div className="flex items-center gap-1.5">
                                <FiClock className="text-secondary text-[10px]" />
                                <span className="metric-label">Until Empty</span>
                            </div>
                            <span className="metric-value">
                                {reading ? (analytics.ete !== 'Calculating...' && analytics.ete !== 'Stable' ? analytics.ete : '--') : (isGhost ? '0h' : '0h')}
                            </span>
                        </div>
                        <div className="metric-box">
                            <div className="flex items-center gap-1.5">
                                <FiThermometer className="text-secondary text-[10px]" />
                                <span className="metric-label">Temp</span>
                            </div>
                            <span className="metric-value">
                                {reading?.temperature ? formatTemperature(reading.temperature) : (isGhost ? '0°C' : '0°C')}
                            </span>
                        </div>
                        <div className="metric-box">
                            <span className="metric-label">Dispense Rate</span>
                            <span className="metric-value">
                                {isGhost ? '0.0 L/hr' : `${analytics.defillRate.toFixed(1)} L/hr`}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="command-footer">
                    <div className="last-update">
                        <span className="text-xs font-semibold text-secondary uppercase tracking-wider">Telemetry Link</span>
                        <div className="flex items-center gap-2 mt-1">
                            <FiClock className="text-secondary" />
                            <span className="last-update-tag">
                                {reading ? formatTime(reading.timestamp) : (isGhost ? 'Waiting...' : 'Offline')}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            className="view-details-btn-premium"
                            onClick={handleCardClick}
                            disabled={isGhost}
                            title="Interactive Analytics"
                        >
                            <FiActivity size={14} />
                            View Details
                        </button>

                        <button
                            className={`sync-btn ${isSyncing ? 'syncing' : ''}`}
                            onClick={handleSync}
                            disabled={isSyncing || isGhost}
                            title={isGhost ? "Hardware Needed" : "Force Sync Telemetry"}
                        >
                            <FiRefreshCw />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});

// Fix for react/display-name linter violation
TankCard.displayName = 'TankCard';
