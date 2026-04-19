import { 
    FiActivity, FiCpu, FiZap, 
    FiCloud, FiCheckCircle,
    FiBarChart2, FiWifi
} from 'react-icons/fi';
import { Tank, TankReading } from '@/types';
import { useAuth } from '@/hooks/useAuth';

import './ExecutiveOverview.css';

interface ExecutiveOverviewProps {
    tanks: Tank[];
    readings: Record<string, TankReading>;
    stationId: string;
}

export const ExecutiveOverview: React.FC<ExecutiveOverviewProps> = ({ tanks, readings, stationId }) => {
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
        
        // Signal Quality (Fallback to tank integrity or 100 if completely mock)
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
            { label: 'Delivery Recon', value: 'N/A', status: 'Unavailable', icon: <FiCheckCircle />, state: 'unknown' },
            { label: 'Compliance', value: 'N/A', status: 'Unavailable', icon: <FiActivity />, state: 'unknown' }
        ] : []),
        { label: 'Sensor Health', value: isLoading ? '...' : sensorHealthValue, status: isLoading ? 'Linking...' : sensorStatus, icon: <FiCpu />, state: getMetricsState((activeNodes / activeTanks.length) * 100, isLoading) },
        ...(canSee(6) ? [
            { label: 'Market Risk', value: 'N/A', status: 'Unavailable', icon: <FiBarChart2 />, state: 'unknown' }
        ] : []),
    ];

    return (
        <div className="executive-overview-card ds-card-premium">
            <div className="card-header-premium">
                <FiActivity className="header-icon-glow" />
                <div className="header-text">
                    <h3>Executive Overview & Fleet Risk</h3>
                    <p>Sub-critical telemetry & operational risk indicators</p>
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
                    <h4>Terminal Signal Integrity (RSSI)</h4>
                </div>
                <div className="rssi-nodes-grid">
                    {tanks.length === 0 ? (
                        <div className="no-nodes-message">
                            {stationId ? 'Synchronizing encrypted nodes...' : 'No active ESP32 nodes detected'}
                        </div>
                    ) : (
                        tanks.map(tank => {
                            if (!tank || !tank.id) return null;
                            const readingScale = readings[tank.id]?.signalQuality || 'Offline';
                            const rssiStatus = String(readingScale);
                            
                            const rssiState = (rssiStatus === 'Excellent' || rssiStatus === 'Good') ? 'optimal' : 
                                            (rssiStatus === 'Fair' || rssiStatus === 'Weak') ? 'fair' : 'critical';

                            return (
                                <div key={tank.id} className={`rssi-node-card state-${rssiState}`}>
                                    <div className="node-info">
                                        <span className="node-name">{tank.name || 'Unknown'}</span>
                                        <span className="node-id">ESP: {tank.sensorId || 'N/A'}</span>
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
