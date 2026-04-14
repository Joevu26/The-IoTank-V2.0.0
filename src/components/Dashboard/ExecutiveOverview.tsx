import { 
    FiActivity, FiCpu, FiZap, 
    FiCloud, FiCheckCircle,
    FiBarChart2, FiWifi
} from 'react-icons/fi';
import { Tank, TankReading } from '@/types';
import { useAuth } from '@/hooks/useAuth';

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
        totalSignal += reading?.signalQuality ?? (tank as any).telemetryIntegrity ?? 100;

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
                            const rssi = readings[tank.id]?.signalQuality || 0;
                            let rssiStatus = 'Weak';
                            
                            const rssiState = rssi >= -65 && rssi < 0 ? 'optimal' : (rssi >= -85 && rssi < 0 ? 'fair' : 'critical');

                            return (
                                <div key={tank.id} className={`rssi-node-card state-${rssiState}`}>
                                    <div className="node-info">
                                        <span className="node-name">{tank.name || 'Unknown'}</span>
                                        <span className="node-id">ESP: {tank.sensorId || 'N/A'}</span>
                                    </div>
                                    <div className="node-signal">
                                        <div className="signal-bars">
                                            {[1, 2, 3, 4].map(bar => (
                                                <div 
                                                    key={bar} 
                                                    className={`bar bar-${bar} ${rssi >= (bar * 25) ? 'filled' : ''}`}
                                                ></div>
                                            ))}
                                        </div>
                                        <span className="rssi-value">{rssiStatus}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <style>{`
                .executive-overview-card {
                    background: var(--color-bg-secondary-glass);
                    backdrop-filter: blur(20px);
                    border: 1px solid var(--color-divider);
                    border-radius: 28px;
                    padding: 24px;
                    margin-bottom: 24px;
                    box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.05);
                }
                .card-header-premium {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 24px;
                    padding-bottom: 16px;
                    border-bottom: 1px solid var(--color-divider);
                }
                .header-icon-glow {
                    font-size: 1.8rem;
                    color: var(--color-accent-primary);
                    filter: drop-shadow(0 0 8px rgba(0, 212, 255, 0.4));
                }
                .header-text h3 {
                    margin: 0;
                    font-size: 1.1rem;
                    font-weight: 900;
                    color: var(--color-text-primary);
                    letter-spacing: -0.01em;
                }
                .header-text p {
                    margin: 0;
                    font-size: 0.75rem;
                    color: var(--color-text-secondary);
                    font-weight: 500;
                }
                .metrics-grid-premium {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 16px;
                }
                .mini-stat-module {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px;
                    background: rgba(255, 255, 255, 0.3);
                    border-radius: 16px;
                    border: 1px solid rgba(255, 255, 255, 0.5);
                    transition: all 0.2s ease;
                }
                .mini-stat-module:hover {
                    background: rgba(255, 255, 255, 0.6);
                    transform: translateY(-2px);
                    box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.05);
                }
                .mini-icon {
                    font-size: 1.25rem;
                    flex-shrink: 0;
                    opacity: 0.9;
                }
                .mini-content {
                    display: flex;
                    flex-direction: column;
                    min-width: 0;
                }
                .mini-label {
                    font-size: 0.65rem;
                    font-weight: 800;
                    color: var(--color-text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                    margin-bottom: 2px;
                }
                .mini-value-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .mini-value {
                    font-size: 0.9rem;
                    font-weight: 900;
                    color: var(--color-text-primary);
                    white-space: nowrap;
                }
                .mini-stat-module.state-optimal .mini-icon,
                .mini-stat-module.state-optimal .mini-status,
                .rssi-node-card.state-optimal .rssi-value { color: #00d4ff; }
                .mini-stat-module.state-optimal .mini-status { background: rgba(0, 212, 255, 0.15); }
                .rssi-node-card.state-optimal .bar.filled { background: #00d4ff; }

                .mini-stat-module.state-fair .mini-icon,
                .mini-stat-module.state-fair .mini-status,
                .rssi-node-card.state-fair .rssi-value { color: #f59e0b; }
                .mini-stat-module.state-fair .mini-status { background: rgba(245, 158, 11, 0.15); }
                .rssi-node-card.state-fair .bar.filled { background: #f59e0b; }

                .mini-stat-module.state-critical .mini-icon,
                .mini-stat-module.state-critical .mini-status,
                .rssi-node-card.state-critical .rssi-value { color: #ef4444; }
                .mini-stat-module.state-critical .mini-status { background: rgba(239, 68, 68, 0.15); }
                .rssi-node-card.state-critical .bar.filled { background: #ef4444; }

                .mini-stat-module.state-secure .mini-icon,
                .mini-stat-module.state-secure .mini-status { color: #10b981; }
                .mini-stat-module.state-secure .mini-status { background: rgba(16, 185, 129, 0.15); }

                .mini-stat-module.state-unknown .mini-icon,
                .mini-stat-module.state-unknown .mini-status { color: #7a7a95; }
                .mini-stat-module.state-unknown .mini-status { background: rgba(122, 122, 149, 0.15); }

                .mini-stat-module.state-loading .mini-icon,
                .mini-stat-module.state-loading .mini-status { color: #94a3b8; }
                .mini-stat-module.state-loading .mini-status { background: rgba(148, 163, 184, 0.15); }

                .mini-status {
                    font-size: 0.6rem;
                    font-weight: 900;
                    padding: 2px 6px;
                    border-radius: 6px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .rssi-monitor-section {
                    margin-top: 32px;
                    padding-top: 24px;
                    border-top: 1px solid var(--color-divider);
                }
                .section-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 16px;
                }
                .section-icon {
                    color: var(--color-accent-primary);
                }
                .section-title h4 {
                    margin: 0;
                    font-size: 0.85rem;
                    font-weight: 800;
                    color: var(--color-text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .rssi-nodes-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                    gap: 12px;
                }
                .rssi-node-card {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid var(--color-divider);
                    border-radius: 12px;
                    padding: 12px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .node-info {
                    display: flex;
                    flex-direction: column;
                    min-width: 0;
                }
                .node-name {
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: var(--color-text-primary);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .node-id {
                    font-size: 0.6rem;
                    color: var(--color-text-secondary);
                }
                .node-signal {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 4px;
                }
                .signal-bars {
                    display: flex;
                    align-items: flex-end;
                    gap: 2px;
                }
                .bar {
                    width: 3px;
                    border-radius: 1px;
                }
                .bar-1 { height: 4px; }
                .bar-2 { height: 8px; }
                .bar-3 { height: 12px; }
                .bar-4 { height: 16px; }
                .rssi-value {
                    font-size: 0.6rem;
                    font-weight: 900;
                    text-transform: uppercase;
                }
                .no-nodes-message {
                    grid-column: 1 / -1;
                    padding: 20px;
                    text-align: center;
                    font-size: 0.8rem;
                    color: var(--color-text-secondary);
                    font-style: italic;
                }
            `}</style>
        </div>
    );
};
