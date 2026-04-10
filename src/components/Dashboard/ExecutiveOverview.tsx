import { 
    FiActivity, FiCpu, FiZap, 
    FiCloud, FiCheckCircle,
    FiBarChart2, FiWifi
} from 'react-icons/fi';
import { Tank, TankReading } from '@/types';

interface ExecutiveOverviewProps {
    tanks: Tank[];
    readings: Record<string, TankReading>;
}

export const ExecutiveOverview: React.FC<ExecutiveOverviewProps> = ({ tanks, readings }) => {
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
    const telemetryColor = activeTanks.length === 0 ? '#7a7a95' : (avgSignal >= 80 ? '#00d4ff' : avgSignal >= 50 ? '#f59e0b' : '#ef4444');

    // 2. Safety Relay Status
    const relayValue = activeTanks.length === 0 ? 'N/A' : (anySafetyTriggered ? 'TRIGGERED' : 'ACTIVE');
    const relayStatus = activeTanks.length === 0 ? 'Unknown' : (anySafetyTriggered ? 'Critical Alert' : 'Secure');
    const relayColor = activeTanks.length === 0 ? '#7a7a95' : (anySafetyTriggered ? '#ef4444' : '#10b981');

    // 3. Sensor Health (% of nodes online)
    const sensorHealthValue = activeTanks.length > 0 ? `${Math.round((activeNodes / activeTanks.length) * 100)}%` : 'N/A';
    const sensorStatus = activeTanks.length === 0 ? 'No Data' : (anyStale ? 'Attention Needed' : 'Excellent');
    const sensorColor = activeTanks.length === 0 ? '#7a7a95' : (anyStale ? '#f59e0b' : '#00d4ff');

    const metrics = [
        { label: 'Telemetry Integrity', value: telemetryValue, status: telemetryStatus, icon: <FiCloud />, color: telemetryColor },
        { label: 'Safety Relay Status', value: relayValue, status: relayStatus, icon: <FiZap />, color: relayColor },
        { label: 'Delivery Recon', value: 'N/A', status: 'Unavailable', icon: <FiCheckCircle />, color: '#7a7a95' },
        { label: 'Compliance', value: 'N/A', status: 'Unavailable', icon: <FiActivity />, color: '#7a7a95' },
        { label: 'Sensor Health', value: sensorHealthValue, status: sensorStatus, icon: <FiCpu />, color: sensorColor },
        { label: 'Market Risk', value: 'N/A', status: 'Unavailable', icon: <FiBarChart2 />, color: '#7a7a95' },
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
                    <div key={i} className="mini-stat-module">
                        <div className="mini-icon" style={{ color: m.color }}>{m.icon}</div>
                        <div className="mini-content">
                            <span className="mini-label">{m.label}</span>
                            <div className="mini-value-row">
                                <span className="mini-value">{m.value}</span>
                                <span className="mini-status" style={{ background: `${m.color}15`, color: m.color }}>
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
                        <div className="no-nodes-message">No active ESP32 nodes detected</div>
                    ) : (
                        tanks.map(tank => {
                            if (!tank || !tank.id) return null;
                            const rssi = readings[tank.id]?.signalQuality || 0;
                            let rssiColor = '#ef4444'; // Critical
                            let rssiStatus = 'Weak';
                            
                            if (rssi >= -65 && rssi < 0) {
                                rssiColor = '#10b981'; // Optimal
                                rssiStatus = 'Strong';
                            } else if (rssi >= -85 && rssi < 0) {
                                rssiColor = '#f59e0b'; // Fair
                                rssiStatus = 'Stable';
                            }

                            return (
                                <div key={tank.id} className="rssi-node-card">
                                    <div className="node-info">
                                        <span className="node-name">{tank.name || 'Unknown'}</span>
                                        <span className="node-id">ESP: {tank.sensorId || 'N/A'}</span>
                                    </div>
                                    <div className="node-signal">
                                        <div className="signal-bars">
                                            {[1, 2, 3, 4].map(bar => (
                                                <div 
                                                    key={bar} 
                                                    className="bar" 
                                                    style={{ 
                                                        height: `${bar * 4}px`,
                                                        background: rssi >= (bar * 25) ? rssiColor : 'rgba(255,255,255,0.1)'
                                                    }}
                                                ></div>
                                            ))}
                                        </div>
                                        <span className="rssi-value" style={{ color: rssiColor }}>{rssiStatus}</span>
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
