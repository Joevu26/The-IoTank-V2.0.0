import { 
    FiActivity, FiCpu, FiZap, 
    FiCloud, FiCheckCircle,
    FiBarChart2, FiWifi
} from 'react-icons/fi';
import { Tank, TankReading, Alert } from '@/types';
import { useAuth } from '@/hooks/useAuth';

import './ExecutiveOverview.css';

interface ExecutiveOverviewProps {
    tanks: Tank[];
    readings: Record<string, TankReading>;
    stationId: string;
    alerts?: Alert[];
}

export const ExecutiveOverview: React.FC<ExecutiveOverviewProps> = ({ tanks, readings, stationId, alerts = [] }) => {
    // Dynamically Calculate Metrics from Props
    const activeTanks = tanks.filter(t => t.isActive);

    // 1. Telemetry Integrity (Average Signal Quality)
    let totalSignal = 0;
    let anyStale = false;
    let anySafetyTriggered = false;
    let activeNodes = 0;

    activeTanks.forEach(tank => {
        if (!tank?.id) return;
        const reading = readings[tank.id];
        
        // Signal Quality (Fallback to tank integrity metrics if live reading is missing)
        // Convert text labels to numeric scores for calculation (Excellent=100, Good=75, Fair=50, Weak=25, Unusable=10)
        const getSignalScore = (quality: string | number | undefined): number => {
            if (typeof quality === 'number') return quality;
            switch(quality) {
                case 'Excellent': return 100;
                case 'Good': return 75;
                case 'Fair': return 50;
                case 'Weak': return 25;
                case 'Unusable': return 10;
                case 'Offline': return 0;
                case 'Connected': return 50;
                default: return 100; // Fallback for legacy number fields
            }
        };

        totalSignal += getSignalScore(reading?.signalQuality ?? (tank as any).telemetryIntegrity);

        if (reading) {
            // Check staleness (older than 4 hours is considered stale/attention needed)
            const isStale = (Date.now() - (reading.timestamp || 0)) > 4 * 60 * 60 * 1000;
            if (isStale) anyStale = true;
            else activeNodes++;

            // Safety Relay Check
            if (reading.metadata?.relayStatus === 'TRIGGERED' || (tank as any).currentState === 'leak_suspicion') {
                anySafetyTriggered = true;
            }
        } else {
            // If there's no reading for an active tank, that's definitely an attention item
            anyStale = true;
        }
    });

    const avgSignal = Math.round(activeTanks.length > 0 ? (totalSignal / activeTanks.length) : 0);
    const telemetryValue = activeTanks.length > 0 ? `${avgSignal}%` : 'N/A';
    const telemetryStatus = activeTanks.length === 0 ? 'No Data' : (avgSignal >= 80 ? 'Optimal' : avgSignal >= 50 ? 'Fair' : 'Critical');

    // 2. Safety Relay Status
    const relayValue = activeTanks.length === 0 ? 'N/A' : (anySafetyTriggered ? 'TRIGGERED' : 'ACTIVE');
    const relayStatus = activeTanks.length === 0 ? 'Unknown' : (anySafetyTriggered ? 'Critical Alert' : 'Secure');

    // 3. Sensor Health (% of nodes online)
    const sensorHealthValue = activeTanks.length > 0 ? `${Math.round((activeNodes / activeTanks.length) * 100)}%` : 'N/A';
    const sensorStatus = activeTanks.length === 0 ? 'No Data' : (anyStale ? 'Attention Needed' : 'Excellent');

    // 4. Delivery Recon
    let deliveryNeeds = 'Optimal';
    let pendingRestocks = 0;
    activeTanks.forEach(tank => {
        const reading = readings[tank.id];
        const vol = reading?.volumeCorrected || reading?.volume || tank.currentVolume || 0;
        const fillPercentage = (vol / tank.capacity) * 100;
        if (fillPercentage <= (tank.lowLevelThreshold || 15)) {
            pendingRestocks++;
        }
    });
    if (activeTanks.length === 0) deliveryNeeds = 'No Data';
    else if (pendingRestocks > 0) deliveryNeeds = 'Pending Restock';
    const deliveryValue = activeTanks.length === 0 ? 'N/A' : (pendingRestocks > 0 ? `${pendingRestocks} Pending` : 'All Clear');

    // 5. Compliance
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    const complianceValue = activeTanks.length === 0 ? 'N/A' : (criticalAlerts.length > 0 ? 'At Risk' : '100%');
    const complianceStatus = activeTanks.length === 0 ? 'No Data' : (criticalAlerts.length > 0 ? 'Violations' : 'Compliant');

    // 6. Market Risk
    let missingPrices = 0;
    activeTanks.forEach(tank => {
        const price = Number((tank as any).metadata?.retailPrice) || 0;
        if (price <= 0) missingPrices++;
    });
    const riskValue = activeTanks.length === 0 ? 'N/A' : (missingPrices > 0 ? 'High' : 'Low');
    const riskStatus = activeTanks.length === 0 ? 'No Data' : (missingPrices > 0 ? 'Missing Prices' : 'Verified');

    const isLoading = activeTanks.length === 0 && stationId !== '';

    const getMetricsState = (val: number | string, isLoader: boolean) => {
        if (isLoader || val === '...') return 'loading';
        if (typeof val === 'string' && (val.includes('N/A') || val === 'No Data')) return 'unknown';
        const num = typeof val === 'string' ? parseInt(val) : val;
        if (num >= 80) return 'optimal';
        if (num >= 50) return 'fair';
        return 'critical';
    };

    const { canSee } = useAuth();
    
    const metrics = [
        { label: 'Telemetry Integrity', value: isLoading ? '...' : telemetryValue, status: isLoading ? 'Linking...' : telemetryStatus, icon: <FiCloud />, state: getMetricsState(avgSignal, isLoading) },
        { label: 'Safety Relay Status', value: isLoading ? '...' : relayValue, status: isLoading ? 'Linking...' : relayStatus, icon: <FiZap />, state: anySafetyTriggered ? 'critical' : (isLoading ? 'loading' : 'secure') },
        ...(canSee(6) ? [
            { label: 'Delivery Recon', value: isLoading ? '...' : deliveryValue, status: isLoading ? 'Linking...' : deliveryNeeds, icon: <FiCheckCircle />, state: pendingRestocks > 0 ? 'fair' : (isLoading ? 'loading' : 'optimal') },
            { label: 'Compliance', value: isLoading ? '...' : complianceValue, status: isLoading ? 'Linking...' : complianceStatus, icon: <FiActivity />, state: criticalAlerts.length > 0 ? 'critical' : (isLoading ? 'loading' : 'optimal') }
        ] : []),
        { label: 'Sensor Health', value: isLoading ? '...' : sensorHealthValue, status: isLoading ? 'Linking...' : sensorStatus, icon: <FiCpu />, state: getMetricsState((activeNodes / activeTanks.length) * 100, isLoading) },
        ...(canSee(6) ? [
            { label: 'Market Risk', value: isLoading ? '...' : riskValue, status: isLoading ? 'Linking...' : riskStatus, icon: <FiBarChart2 />, state: missingPrices > 0 ? 'critical' : (isLoading ? 'loading' : 'optimal') }
        ] : []),
    ];

    return (
        <div className="executive-overview-card ds-card-premium">
            <div className="card-header-premium">
                <FiActivity className="header-icon-glow" />
                <div className="header-text">
                    <h3>System Health</h3>
                    <p>Telemetry integrity and operational status across all nodes</p>
                </div>
            </div>

            <div className="metrics-grid-premium">
                {metrics.map((m, i) => (
                    <div key={i} className={`mini-stat-module state-${m.state}`}>
                        <div className="mini-icon">{m.icon}</div>
                        <div className="mini-content">
                            <span className="mini-label">{m.label}</span>
                            <div className="mini-value-row">
                                <span className="mini-value">{m.value}</span>
                                <span className="mini-status">
                                    {m.status}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="rssi-monitor-section mt-8">
                <div className="section-title">
                    <FiWifi className="section-icon" />
                    <h4>Signal Strength</h4>
                </div>
                <div className="rssi-nodes-grid">
                    {tanks.length === 0 ? (
                        <div className="no-nodes-message">
                            {stationId ? 'Synchronizing encrypted nodes...' : 'No active ESP32 nodes detected'}
                        </div>
                    ) : (
                        tanks.map(tank => {
                            if (!tank || !tank.id) return null;
                            const reading = readings[tank.id];
                            const isOffline = !reading || !reading.timestamp || (Date.now() - reading.timestamp) > 60 * 60 * 1000; // 1 hour threshold
                            const readingScale = isOffline ? 'Offline' : (reading.signalQuality || 'Offline');
                            const rssiStatus = String(readingScale);
                            
                            const rssiState = (rssiStatus === 'Excellent' || rssiStatus === 'Good') ? 'optimal' : 
                                            (rssiStatus === 'Fair' || rssiStatus === 'Weak') ? 'fair' : 'critical';

                            return (
                                <div key={tank.id} className={`rssi-node-card state-${rssiState}`}>
                                    <div className="node-info">
                                        <span className="node-name">{tank.name || 'Unknown'}</span>

                                    </div>
                                    <div className="node-signal">
                                            {[1, 2, 3, 4].map(bar => {
                                                const scoreMap: Record<string, number> = { 'Excellent': 4, 'Good': 3, 'Fair': 2, 'Weak': 1, 'Unusable': 0 };
                                                const currentBars = typeof readingScale === 'number' ? Math.round(readingScale / 25) : (scoreMap[String(readingScale)] || 0);
                                                return (
                                                    <div 
                                                        key={bar} 
                                                        className={`bar bar-${bar} ${currentBars >= bar ? 'filled' : ''}`}
                                                    ></div>
                                                );
                                            })}
                                        <span className="rssi-value">{rssiStatus}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};
