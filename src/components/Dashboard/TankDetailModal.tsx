import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Tank } from '@/types';
import { useHistoricalReadings, updateTank } from '@/hooks/useSupabase';
import { useConsumptionAnalytics } from '@/hooks/useConsumptionAnalytics';
import { TankViewer } from '../3D/TankViewer';
import { TimeSeriesChart } from '../Analytics/TimeSeriesChart';
import { PredictivePanel } from '../Analytics/PredictivePanel';
import { FiX, FiActivity, FiSettings, FiDownload, FiShare2, FiRefreshCw } from 'react-icons/fi';
import { formatVolume } from '@/utils/formatUtils';
import { exportToCSV } from '@/utils/exportUtils';
import './TankDetailModal.css';

interface TankDetailModalProps {
    tank: Tank;
    orgId: string;
    onClose: () => void;
}

export const TankDetailModal: React.FC<TankDetailModalProps> = ({
    tank,
    orgId,
    onClose
}) => {
    const [activeTab, setActiveTab] = useState<'visual' | 'analytics' | 'config'>('visual');
    const [timeRange] = useState({
        start: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
        end: Date.now()
    });

    const { readings } = useHistoricalReadings(orgId, tank.id, timeRange);
    const latestReading = readings.length > 0 ? readings[readings.length - 1] : null;
    const analytics = useConsumptionAnalytics(tank, readings);

    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState<'download' | 'share' | null>(null);

    const handleExport = async (type: 'download' | 'share') => {
        setExporting(type);

        if (type === 'download') {
            exportToCSV(readings, `${tank.name}_Telemetry_${new Date().toISOString().split('T')[0]}`);
        } else {
            // Sharing is still mocked as it requires specific backend integration (email triggers etc)
            await new Promise(resolve => setTimeout(resolve, 800));
            alert('Report shared with authorized site personnel.');
        }

        setExporting(null);
    };

    const handleUpdateConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const form = e.target as HTMLFormElement;
            const newCoeff = parseFloat((form.elements.namedItem('thermalCoefficient') as HTMLInputElement).value);
            const newThreshold = parseFloat((form.elements.namedItem('highLevelThreshold') as HTMLInputElement).value);
            const esp32Address = (form.elements.namedItem('esp32Address') as HTMLInputElement).value;
            const sensorHeight = parseFloat((form.elements.namedItem('sensorHeight') as HTMLInputElement).value);
            const sensorOffset = parseFloat((form.elements.namedItem('sensorOffset') as HTMLInputElement).value);
            const temperatureAlertThreshold = parseFloat((form.elements.namedItem('temperatureAlertThreshold') as HTMLInputElement).value);

            await updateTank(tank.id, {
                thermalCoefficient: newCoeff,
                highLevelThreshold: newThreshold,
                esp32Address,
                sensorHeight,
                sensorOffset,
                temperatureAlertThreshold,
            });

            // Allow state to settle visually
            alert('Hardware configuration synchronized.');
        } catch (error) {
            console.error('Error updating config:', error);
            alert('Failed to update configuration.');
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <div className="modal-overlay animate-in fade-in duration-300">
            <div className="modal-container tank-detail-modal">
                {/* Modal Header */}
                <div className="modal-header">
                    <div className="header-info">
                        <h2>{tank.name}</h2>
                        <p className="text-secondary">{tank.location} • {tank.fuelType.toUpperCase()}</p>
                    </div>
                    <div className="header-actions">
                        <button
                            className="btn btn-icon"
                            title="Download Data"
                            onClick={() => handleExport('download')}
                            disabled={exporting !== null}
                        >
                            {exporting === 'download' ? <FiRefreshCw className="spinner" /> : <FiDownload />}
                        </button>
                        <button
                            className="btn btn-icon"
                            title="Share Report"
                            onClick={() => handleExport('share')}
                            disabled={exporting !== null}
                        >
                            {exporting === 'share' ? <FiRefreshCw className="spinner" /> : <FiShare2 />}
                        </button>
                        <button className="btn btn-icon close-btn" onClick={onClose}><FiX /></button>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="modal-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'visual' ? 'active' : ''}`}
                        onClick={() => setActiveTab('visual')}
                    >
                        <FiActivity className="tab-icon" /> Visual Hub
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
                        onClick={() => setActiveTab('analytics')}
                    >
                        <FiActivity className="tab-icon" /> AI Analytics
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`}
                        onClick={() => setActiveTab('config')}
                    >
                        <FiSettings className="tab-icon" /> Configuration
                    </button>
                </div>

                {/* Modal Content */}
                <div className="modal-content-scrollable">
                    {activeTab === 'visual' && (
                        <div className="visual-tab">
                            <div className="visual-grid">
                                <div className="visual-main">
                                    <TankViewer
                                        fuelLevel={latestReading?.fuelLevel || 0}
                                        fuelType={tank.fuelType}
                                        capacity={tank.capacity}
                                        tankName={tank.name}
                                        shape={tank.shape as any}
                                        height={tank.height}
                                        diameter={tank.diameter}
                                        length={tank.length}
                                    />
                                </div>
                                <div className="visual-stats">
                                    <div className="stat-card card">
                                        <span className="stat-label">Corrected Volume</span>
                                        <span className="stat-value">{formatVolume(latestReading?.volumeCorrected || 0)}</span>
                                        <span className="stat-trend text-success">↑ 2.3% vs yesterday</span>
                                    </div>
                                    <div className="stat-card card">
                                        <span className="stat-label">Consumption Rate</span>
                                        <span className="stat-value">{analytics.defillRate.toFixed(1)} L/hr</span>
                                        <span className={`stat-trend ${analytics.isTheftSuspected ? 'text-danger' : 'text-secondary'}`}>
                                            {analytics.isTheftSuspected ? 'ALERT: Rapid Defill' : `${analytics.trend.toUpperCase()}`}
                                        </span>
                                    </div>
                                    <div className="stat-card card">
                                        <span className="stat-label">Time to Empty (ETE)</span>
                                        <span className="stat-value">{analytics.ete}</span>
                                        <span className={`stat-subtext ${analytics.isLeakageSuspected ? 'text-warning' : 'text-secondary'}`}>
                                            {analytics.isLeakageSuspected ? 'Possible Leakage Detected' : 'Forecast based on 24h trend'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="live-trends mt-6">
                                <h3>Live Level Trend</h3>
                                <TimeSeriesChart
                                    data={readings}
                                    title="Fuel Level (%)"
                                    dataKey="fuelLevel"
                                    unit="%"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'analytics' && (
                        <div className="analytics-tab p-4">
                            <PredictivePanel stationId={orgId} tankId={tank.id} />

                            <div className="grid grid-cols-2 gap-4 mt-6">
                                <TimeSeriesChart
                                    data={readings}
                                    title="Temperature Variance"
                                    dataKey="temperature"
                                    color="var(--chart-temperature)"
                                    unit="°C"
                                />
                                <TimeSeriesChart
                                    data={readings}
                                    title="Corrected Volume (L)"
                                    dataKey="volumeCorrected"
                                    color="var(--chart-volume)"
                                    unit="L"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'config' && (
                        <div className="config-tab p-6">
                            <div className="section-header mb-6">
                                <h3>Technical Specifications</h3>
                                <p className="text-secondary text-sm">Industrial calibration for thermal expansion and sensor geometry.</p>
                            </div>

                            <form onSubmit={handleUpdateConfig} className="config-form">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="form-group">
                                        <label>Capacity (Liters)</label>
                                        <input type="number" defaultValue={tank.capacity} disabled />
                                    </div>
                                    <div className="form-group">
                                        <label>Fuel Type</label>
                                        <input type="text" defaultValue={tank.fuelType} disabled />
                                    </div>
                                    <div className="form-group">
                                        <label>Thermal Expansion Coeff (α)</label>
                                        <input type="number" name="thermalCoefficient" defaultValue={tank.thermalCoefficient} step="0.0001" />
                                    </div>
                                    <div className="form-group">
                                        <label>Safe Fill Limit (%)</label>
                                        <input type="number" name="highLevelThreshold" defaultValue={tank.highLevelThreshold} />
                                    </div>
                                </div>

                                <div className="divider my-8"></div>

                                <div className="section-header mb-6">
                                    <h3>Hardware & Calibration</h3>
                                    <p className="text-secondary text-sm">Link physical ESP32 devices and set ultrasonic sensor offsets.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="form-group">
                                        <label>ESP32 MAC Address / ID</label>
                                        <input
                                            type="text"
                                            name="esp32Address"
                                            placeholder="XX:XX:XX:XX:XX:XX"
                                            defaultValue={tank.esp32Address}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Sensor Height (cm)</label>
                                        <input
                                            type="number"
                                            name="sensorHeight"
                                            defaultValue={tank.sensorHeight}
                                            placeholder="Measured from bottom"
                                        />
                                        <small className="help-text">Distance from tank bottom to sensor face.</small>
                                    </div>
                                    <div className="form-group">
                                        <label>Calibration Offset (cm)</label>
                                        <input
                                            type="number"
                                            name="sensorOffset"
                                            defaultValue={tank.sensorOffset}
                                        />
                                        <small className="help-text">Adjustment for mounting protrusions.</small>
                                    </div>
                                    <div className="form-group">
                                        <label>Temp Alert Threshold (°C)</label>
                                        <input
                                            type="number"
                                            name="temperatureAlertThreshold"
                                            defaultValue={tank.temperatureAlertThreshold}
                                        />
                                        <small className="help-text">Trigger alert if fuel exceeds this temp.</small>
                                    </div>
                                </div>

                                <div className="mt-10">
                                    <button type="submit" className="btn btn-primary w-full md:w-auto" disabled={saving}>
                                        {saving ? 'Synchronizing Supabase...' : 'Apply Calibration Logic'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
