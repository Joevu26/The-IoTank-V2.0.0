import React, { useEffect, useState } from 'react';
import { supabase } from '@/config/supabase';
import { FiX, FiPlus, FiAlertCircle, FiLock, FiChevronRight, FiInfo } from 'react-icons/fi';
import { useSites, createTank } from '@/hooks/useSupabase';
import { useAuth } from '@/hooks/useAuth';
import { AuditService } from '@/services/AuditService';
import { Tank, Site } from '@/types';
import './AddTankModal.css';

interface AddTankModalProps {
    stationId: string;
    onClose: () => void;
    onSuccess?: (newTank: Tank) => void;
}

export const AddTankModal: React.FC<AddTankModalProps> = ({ stationId, onClose, onSuccess }) => {
    const { verifySettingsPassword } = useAuth();
    const { sites, loading: sitesLoading } = useSites(stationId);
    
    // Auth & Form State
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [authPassword, setAuthPassword] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        siteId: '',
        espId: '',
        fuelType: 'Diesel' as Tank['fuelType'],
        shape: 'capsule' as Tank['shape'],
        capacity: 10000,
        height: 200,
        diameter: 250,
        length: 0,
        sensorHeight: 300,
        sensorEmptyDistance: 290,
        sensorFullDistance: 20,
        sensorChannel: 1
    });

    useEffect(() => {
        if (!formData.siteId && sites.length === 1) {
            setFormData(prev => ({ ...prev, siteId: sites[0].id }));
        }
    }, [sites, formData.siteId]);

    const handleAuthorize = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!authPassword) return;
        
        setVerifying(true);
        setError(null);
        try {
            await verifySettingsPassword(authPassword);
            setIsAuthorized(true);
        } catch (err: any) {
            setError('Access Denied: Invalid administrative password');
        } finally {
            setVerifying(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? (parseFloat(value) || 0) : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.siteId) {
            setError('Please fill in required fields');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const newTank = await createTank({
                stationId,
                siteId: formData.siteId,
                name: formData.name,
                sensorId: formData.espId, // Mapping to sensor_id
                fuelType: formData.fuelType,
                shape: formData.shape,
                capacity: formData.capacity,
                height: formData.height,
                diameter: formData.diameter,
                length: formData.length,
                sensorHeight: formData.sensorHeight,
                sensorEmptyDistance: formData.sensorEmptyDistance,
                sensorFullDistance: formData.sensorFullDistance,
                sensorChannel: formData.sensorChannel,
                lowLevelThreshold: 20, // Reorder: 20%
                criticalLevelThreshold: 10, // Emergency Stop: 10%
                highLevelThreshold: 90, // Operator Warning: 90% (Handled as fallback)
                temperatureAlertThreshold: 60 // High Temp Alert: 60°C
            });

            if (onSuccess) onSuccess(newTank);

            // 🟢 Forensic Log
            await AuditService.log(
                'DELIVERY',
                'CREATE_TANK',
                stationId,
                `Terminal node provisioned: ${formData.name} (${formData.fuelType}) initialized with hardware serial ${formData.espId}`,
                'INFO',
                { tankId: newTank.id, siteId: formData.siteId }
            );

            // 🟠 REAL-TIME SHIFT SYNC: Forensic Snapshot Injection
            // If a shift is currently open, we must capture this new tank's starting volume immediately
            const { data: currentShift } = await supabase
                .from('current_station_shifts')
                .select('*')
                .eq('station_id', stationId)
                .single();

            if (currentShift && currentShift.status === 'OPEN') {
                const snapshots = currentShift.metadata?.tank_snapshots || {};
                const nowString = new Date().toISOString();
                
                snapshots[newTank.id] = {
                    opening_volume: newTank.currentVolume || 0,
                    captured_at: nowString,
                    is_manual_override: false,
                    injection_type: 'hot_provision'
                };

                await supabase
                    .from('current_station_shifts')
                    .update({ metadata: { ...currentShift.metadata, tank_snapshots: snapshots } })
                    .eq('station_id', stationId);

                // Update legacy fallback
                const legacySnapshots = JSON.parse(localStorage.getItem('iotank_shift_start_volumes') || '{}');
                legacySnapshots[newTank.id] = newTank.currentVolume || 0;
                localStorage.setItem('iotank_shift_start_volumes', JSON.stringify(legacySnapshots));
            }

            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to create tank');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="add-tank-modal-overlay">
            <div className={`add-tank-modal-content ${!isAuthorized ? 'auth-mode' : ''}`}>
                <div className="modal-header">
                    <div className="header-text-container">
                        <h2>Register New Tank Node</h2>
                        <p>Initialize a new ESP32 telemetry point on your network</p>
                        <div className="modal-header-badges">
                            <span className="modal-badge cyan">Telemetry Point</span>
                            <span className="modal-badge blue">SECURE</span>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose} title="Dismiss Provisioning Modal">
                        <FiX size={18} />
                    </button>
                </div>

                {error && (
                    <div className="error-banner">
                        <div className="error-icon-container">
                            <FiAlertCircle className="error-icon" />
                        </div>
                        <div className="error-content">
                            <strong>{isAuthorized ? 'Registration Failed' : 'Authorization Required'}</strong>
                            <p>{error}</p>
                            {error.toLowerCase().includes('auth_user_id') && (
                                <div className="error-hint">
                                    💡 This is likely a stale browser cache. Please refresh the page (Ctrl+R) and try again.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {!isAuthorized ? (
                    <div className="password-gate">
                        <div className="gate-icon-container">
                            <FiLock className="gate-icon" />
                        </div>
                        <h3>Security Verification</h3>
                        <p>Accessing technical provisioning requires a master station password.</p>
                        
                        <form onSubmit={handleAuthorize} className="gate-form">
                            <input
                                type="password"
                                value={authPassword}
                                onChange={(e) => setAuthPassword(e.target.value)}
                                placeholder="Enter Access Password"
                                autoFocus
                                required
                            />
                            <button type="submit" disabled={verifying}>
                                {verifying ? 'Verifying...' : 'Unlock Provisioning' }
                                <FiChevronRight className="ml-2" />
                            </button>
                        </form>
                        
                        <div className="gate-footer">
                            <button onClick={onClose} className="btn-secondary">Dismiss</button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="add-tank-form">
                        
                                                {/* SECTION 1: TANK IDENTIFICATION */}
                        <div className="atm-section cyan">
                            <div className="atm-section-header">
                                <div className="atm-section-icon"><FiInfo size={14} /></div>
                                <span className="atm-section-title">Tank Identification</span>
                            </div>
                            <div className="atm-section-body atm-grid atm-grid-2">
                                <div className="form-group">
                                    <label>Tank Name / Terminal identifier</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="e.g., Underground Diesel 01"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="site-selector">Physical Station (Site) {sitesLoading && <span className="loading-spinner-inline">(Loading...)</span>}</label>
                                    <select 
                                        id="site-selector"
                                        name="siteId" 
                                        value={formData.siteId} 
                                        onChange={handleChange} 
                                        required
                                        title="Physical Station Location"
                                        aria-required="true"
                                    >
                                        <option value="">{sitesLoading ? 'Loading locations…' : (sites.length ? 'Select a location...' : 'No sites available')}</option>
                                        {sites.map((site: Site) => (
                                            <option key={site.id} value={site.id}>{site.siteName || site.address || site.id}</option>
                                        ))}
                                    </select>
                                    {!sitesLoading && sites.length === 0 && (
                                        <div className="field-hint error-hint">
                                            No physical station site found for this station. Create a site in the location settings before adding a tank.
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label htmlFor="esp-id-input">ESP ID (Hardware Serial)</label>
                                    <input
                                        id="esp-id-input"
                                        type="text"
                                        name="espId"
                                        value={formData.espId}
                                        onChange={handleChange}
                                        placeholder="ESP-XXXX-XXXX"
                                        aria-label="ESP32 Hardware Identity"
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="esp-channel-selector">ESP Channel (1-4)</label>
                                    <select 
                                        id="esp-channel-selector"
                                        name="sensorChannel" 
                                        value={formData.sensorChannel} 
                                        onChange={handleChange}
                                        title="ESP32 Hardware Channel"
                                    >
                                        <option value={1}>Channel 1 (Primary)</option>
                                        <option value={2}>Channel 2</option>
                                        <option value={3}>Channel 3</option>
                                        <option value={4}>Channel 4</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="fuel-type-selector">Fuel Product Type</label>
                                    <select 
                                        id="fuel-type-selector"
                                        name="fuelType" 
                                        value={formData.fuelType} 
                                        onChange={handleChange}
                                        title="Product Grade Selection"
                                    >
                                        <option value="Diesel">Automotive Diesel (AGO)</option>
                                        <option value="Petrol">Premium Petrol (PMS)</option>
                                        <option value="Kerosene">Kerosene (IK)</option>
                                        <option value="Jet Fuel">Jet A-1 Aviation Fuel</option>
                                        <option value="LPG">LPG (Liquid Gas)</option>
                                    </select>
                                </div>
                                <div className="field-info-box">
                                    <FiInfo className="info-icon" />
                                    <p>Every port on your ESP hardware manages a separate tank. Select the physical channel currently wired to this tank.</p>
                                </div>
                            </div>
                        </div>

                                                {/* SECTION 2: TANK GEOMETRY */}
                        <div className="atm-section blue">
                            <div className="atm-section-header">
                                <div className="atm-section-icon"><FiInfo size={14} /></div>
                                <span className="atm-section-title">Tank Geometry</span>
                            </div>
                            
                            <div className="atm-section-body atm-grid atm-grid-2">
                                <div className="form-group">
                                    <label>Geometry</label>
                                    <select 
                                        name="shape" 
                                        value={formData.shape} 
                                        onChange={handleChange}
                                        title="Tank Geometric Profile"
                                    >
                                        <option value="capsule">Horizontal Cylindrical</option>
                                        <option value="spherical">Spherical (Ball-Shaped)</option>
                                        <option value="rectangular">Rectangular / Flat-Sided (Custom)</option>
                                        <option value="compartmentalized">Compartmentalized (Internal)</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="capacity-input">Total Capacity (Liters)</label>
                                    <input
                                        id="capacity-input"
                                        type="number"
                                        name="capacity"
                                        value={formData.capacity}
                                        onChange={handleChange}
                                        min="0"
                                        title="Total Volumetric Capacity"
                                        aria-required="true"
                                    />
                                </div>

                                {/* Dimensions Block */}
                                {formData.shape === 'capsule' && (
                                    <>
                                        <div className="form-group">
                                            <label htmlFor="capsule-height">Diameter / Height (cm)</label>
                                            <input id="capsule-height" type="number" name="height" value={formData.height} onChange={(e) => { handleChange(e); setFormData(prev => ({...prev, diameter: parseFloat(e.target.value)})); }} min="0" required title="Tank Height / Vertical Diameter" aria-required="true" />
                                        </div>
                                        <div className="form-group">
                                            <label htmlFor="capsule-length">Length (cm)</label>
                                            <input id="capsule-length" type="number" name="length" value={formData.length} onChange={handleChange} min="0" required title="Horizontal Dimension (cm)" aria-required="true" />
                                        </div>
                                    </>
                                )}

                                {formData.shape === 'spherical' && (
                                    <div className="form-group atm-col-2">
                                        <label htmlFor="sphere-diameter">Sphere Diameter (cm)</label>
                                        <input id="sphere-diameter" type="number" name="height" value={formData.height} onChange={(e) => { handleChange(e); setFormData(prev => ({...prev, diameter: parseFloat(e.target.value)})); }} min="0" required title="Spherical Diameter" aria-required="true" />
                                    </div>
                                )}

                                {formData.shape === 'rectangular' && (
                                    <>
                                        <div className="form-group">
                                            <label htmlFor="rect-height">Height / Depth (cm)</label>
                                            <input id="rect-height" type="number" name="height" value={formData.height} onChange={handleChange} min="0" required title="Rectangular Height" aria-required="true" />
                                        </div>
                                        <div className="form-group">
                                            <label htmlFor="rect-length">Length (cm)</label>
                                            <input id="rect-length" type="number" name="length" value={formData.length} onChange={handleChange} min="0" required title="Horizontal Dimension (cm)" aria-required="true" />
                                        </div>
                                    </>
                                )}

                                {formData.shape === 'compartmentalized' && (
                                    <div className="form-group atm-col-2">
                                        <label htmlFor="comp-height">Max Height (cm)</label>
                                        <input id="comp-height" type="number" name="height" value={formData.height} onChange={handleChange} min="0" required title="Maximum Compartment Height" aria-required="true" />
                                    </div>
                                )}
                            </div>
                        </div>

                                                {/* SECTION 3: SENSOR CONFIGURATION */}
                        <div className="atm-section slate">
                            <div className="atm-section-header">
                                <div className="atm-section-icon"><FiInfo size={14} /></div>
                                <span className="atm-section-title">Sensor Calibration</span>
                            </div>
                            
                            <div className="atm-section-body">
                                <div className="atm-sensor-row">
                                    <div className="atm-sensor-label">
                                        <span className="tag-mount">MOUNT</span>
                                        Sensor to tank bottom
                                    </div>
                                    <div className="atm-sensor-input-wrap">
                                        <input id="sensor-h-input" type="number" name="sensorHeight" value={formData.sensorHeight} onChange={handleChange} min="0" required title="Total Mounting Height" aria-required="true" />
                                        <span className="atm-unit">cm</span>
                                    </div>
                                </div>

                                <div className="atm-sensor-row empty">
                                    <div className="atm-sensor-label" id="empty-read-label">
                                        <span className="tag-empty">EMPTY</span>
                                        Sensor read when empty
                                    </div>
                                    <div className="atm-sensor-input-wrap">
                                        <input id="sensor-empty-input" type="number" name="sensorEmptyDistance" value={formData.sensorEmptyDistance} onChange={handleChange} min="0" required title="Digital Empty Reading (cm)" aria-labelledby="empty-read-label" aria-required="true" />
                                        <span className="atm-unit">cm</span>
                                    </div>
                                </div>

                                <div className="atm-sensor-row full">
                                    <div className="atm-sensor-label" id="full-read-label">
                                        <span className="tag-full">FULL</span>
                                        Sensor read when full
                                    </div>
                                    <div className="atm-sensor-input-wrap">
                                        <input id="sensor-full-input" type="number" name="sensorFullDistance" value={formData.sensorFullDistance} onChange={handleChange} min="0" required title="Digital Full Reading (cm)" aria-labelledby="full-read-label" aria-required="true" />
                                        <span className="atm-unit">cm</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    <div className="form-actions">
                        <button type="button" className="btn-cancel" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-submit" disabled={submitting}>
                            {submitting ? 'Registering...' : 'Provision Tank'}
                            <FiPlus />
                        </button>
                    </div>
                </form>
            )}
        </div>
    </div>
);
};
