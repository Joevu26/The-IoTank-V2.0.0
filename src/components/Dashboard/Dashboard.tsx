import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tank } from '@/types';
import { useTanks, useAlerts, useAllLatestReadings } from '@/hooks/useSupabase';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardData } from '@/hooks/useDashboardData';

import { TankGrid } from './TankGrid';
import { MarketLens } from './MarketLens';
import { DashboardStats } from './DashboardStats';
import { FiAlertCircle } from 'react-icons/fi';
import { ActionQueue } from './ActionQueue';
import { TelemetryErrorBoundary } from '../Common/TelemetryErrorBoundary';
import { useTelemetryQueue } from '@/contexts/TelemetryQueueContext';
import { RecentEvents } from './RecentEvents';
import { LossRadar } from './LossRadar';
import { DeliveryVerification } from './DeliveryVerification';
import { SystemIntegrityCard } from './SystemIntegrityCard';
import { CashView } from './CashView';
import { ExecutiveOverview } from './ExecutiveOverview';
import { PageHeader } from '../Common/PageHeader';
import { AddTankModal } from '../Inventory/AddTankModal';
import { SkeletonDashboard } from '../Common/SkeletonLoader';
import '../Common/DesignSystemCards.css';
import './Dashboard.css';

export const Dashboard: React.FC = () => {
    const { currentUser } = useAuth();
    const { pushEvent } = useTelemetryQueue();
    const navigate = useNavigate();
    const stationId = currentUser?.stationId || '';

    const { tanks, loading: tanksLoading, error: tanksError } = useTanks(stationId);
    
    // Fetch latest readings for all tanks to get RSSI
    const { readings } = useAllLatestReadings(stationId, (tanks || []).map(t => t.id));
    
    // Use the new dashboard data hook that hits our Supabase helper function
    const { error: summaryError, refetch: refetchSummary } = useDashboardData();

    const { alerts } = useAlerts(stationId, false);
    const [currency, setCurrency] = useState<'USD' | 'Ksh'>('Ksh');
    const [showAddModal, setShowAddModal] = useState(false);
    const hasPushedError = React.useRef(false);

    // Report initialization errors to telemetry queue
    React.useEffect(() => {
        if ((tanksError || summaryError) && !hasPushedError.current) {
            pushEvent({
                type: 'system_error',
                message: `Failed to initialize telemetry: ${tanksError?.message || summaryError?.message || 'Database connection error'}`,
                actionLabel: 'Retry',
                onAction: () => {
                    hasPushedError.current = false;
                    refetchSummary();
                    window.location.reload();
                }
            });
            hasPushedError.current = true;
        } else if (!tanksError && !summaryError) {
        }
    }, [tanksError, summaryError, pushEvent, refetchSummary]);

    // Onboarding Gate: Trigger modal if 0 tanks exist
    React.useEffect(() => {
        if (!tanksLoading && tanks.length === 0) {
            setShowAddModal(true);
        }
    }, [tanks.length, tanksLoading]);

    // --- THEFT DETECTION LOGIC (SIMULATED) ---
    const prevVolumes = React.useRef<{ [key: string]: number }>({});
    
    React.useEffect(() => {
        if (tanksLoading || tanks.length === 0) return;

        const shiftStatus = localStorage.getItem('iotank_shift_status') || 'closed';
        
        tanks.forEach(tank => {
            if (!tank || !tank.id) return;

            const currentVol = tank.currentVolume || 0;
            const lastVol = prevVolumes.current[tank.id];

            // If shift is closed and volume decreases by more than 5L (to avoid noise)
            if (shiftStatus === 'closed' && lastVol !== undefined && currentVol < lastVol - 0.5) {
                pushEvent({
                    type: 'system_error',
                    message: `CRITICAL: Unofficial Fuel Reduction in ${tank.name || 'Unknown Tank'}. Shift is CLOSED. Possible Theft!`,
                    actionLabel: 'Check Security',
                    onAction: () => navigate('/history')
                });
            }
            
            // Update ref for next comparison
            prevVolumes.current[tank.id] = currentVol;
        });
    }, [tanks, tanksLoading, pushEvent, navigate]);

    const ghostTank: Tank = {
        id: 'ghost-tank',
        stationId: stationId,
        siteId: 'pending',
        name: 'Pending Configuration',
        location: 'Hardware Not Linked',
        capacity: 10000,
        fuelType: 'diesel',
        shape: 'cylinder',
        height: 200,
        lowLevelThreshold: 15,
        highLevelThreshold: 90,
        criticalLevelThreshold: 10,
        rapidDefillThreshold: 50,
        leakageThreshold: 2,
        temperatureAlertThreshold: 40,
        leakDetectionSensitivity: 0.1,
        thermalCoefficient: 0.00084,
        density: 0.832,
        sensorOffset: 0,
        sensorHeight: 5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: false
    };

    if (tanksLoading && tanks.length === 0) {
        return <SkeletonDashboard />;
    }

    const displayTanks = tanks.length > 0 ? tanks : [ghostTank];

    return (
        <div className="dashboard-container">


            <PageHeader
                title="Operational Intelligence HUD"
                description="Real-time telemetry, risk monitoring, and strategic insights"
            />

            <div className="dashboard-grid">
                {/* Main HUD Area */}
                <section className="tanks-section">
                    
                    <ExecutiveOverview tanks={displayTanks} readings={readings} />
                    
                    <div className={displayTanks.length === 1 ? 'single-tank-view mt-8' : 'mt-8'}>
                        <TelemetryErrorBoundary
                            fallback={
                                <div className="p-8 bg-red-50 border border-red-100 rounded-xl text-center">
                                    <FiAlertCircle className="mx-auto text-red-500 mb-2" size={24} />
                                    <p className="text-red-800 font-bold">Inventory Hub Glitch</p>
                                    <p className="text-red-600 text-xs">High data volume detected. Attempting to recover...</p>
                                    <button onClick={() => window.location.reload()} className="mt-4 text-xs font-bold text-red-700 underline">Reload Component</button>
                                </div>
                            }
                        >
                            <TankGrid tanks={displayTanks} stationId={stationId} readings={readings} />
                        </TelemetryErrorBoundary>
                    </div>

                    {/* Integrated Operational Statistics */}
                    <div className="mt-8">
                        <TelemetryErrorBoundary
                            fallback={<div className="h-32 bg-slate-50 rounded animate-pulse" />}
                        >
                            <DashboardStats
                                tanks={displayTanks}
                                stationId={stationId}
                                alerts={alerts}
                                currency={currency}
                                onCurrencyToggle={() => setCurrency(prev => prev === 'USD' ? 'Ksh' : 'USD')}
                            />
                        </TelemetryErrorBoundary>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                        <div className="space-y-6">
                            <LossRadar />
                        </div>
                        <div className="space-y-6">
                            <DeliveryVerification />
                            <CashView currency={currency} stationId={stationId} />
                        </div>
                    </div>

                    {showAddModal && (
                        <AddTankModal 
                            stationId={stationId}
                            onClose={() => setShowAddModal(false)}
                            onSuccess={() => {
                                localStorage.setItem('iotank_initial_tanks_provisioned', 'true');
                                pushEvent({
                                    type: 'suggested',
                                    message: 'Terminal Node Provisioned Successfully. Initializing telemetry sync.',
                                });
                            }}
                        />
                    )}
                </section>

                {/* Sidebar Intelligence & Health - PERSISTENT */}
                <aside className="dashboard-sidebar">
                    <TelemetryErrorBoundary>
                        <ActionQueue />
                    </TelemetryErrorBoundary>

                    <TelemetryErrorBoundary>
                        <MarketLens stationId={stationId} />
                    </TelemetryErrorBoundary>

                    <TelemetryErrorBoundary>
                        <RecentEvents />
                    </TelemetryErrorBoundary>

                    <TelemetryErrorBoundary>
                        <SystemIntegrityCard stationId={stationId} />
                    </TelemetryErrorBoundary>
                </aside>
            </div>

        </div>
    );
};
