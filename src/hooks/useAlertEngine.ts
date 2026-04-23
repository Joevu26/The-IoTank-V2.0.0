/**
 * useAlertEngine — Spark-safe client-side alert monitoring hook.
 *
 * Responsibilities:
 * - Runs detection scan on component mount
 * - Re-runs every 60 seconds
 * - Writes new alerts to Firestore only if no duplicate active alert exists
 * - Computes and exposes the Risk Index for the executive summary card
 * - Supports dynamic threshold configuration from user preferences
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, TankReading, RiskIndex, Tank } from '@/types';
import { supabase } from '@/config/supabase';
import { useTanks } from './useSupabase';
import { useShiftStatus } from './useShiftStatus';
import { NotificationService } from '../services/NotificationService';
import { EmailDispatchService } from '../services/EmailDispatchService';
import { detectTankAlerts, filterDuplicates, correlateAlerts } from '../services/AlertDetectionEngine';
import { useTelemetryQueue } from '@/contexts/TelemetryQueueContext';

export interface AlertEngineThresholds {
    telemetryGapMinutes: number;
    deliveryVarianceThreshold: number;
    nightDrawdownSensitivity: 'high' | 'standard' | 'conservative';
    refillDetectionThreshold: number;
}

const DEFAULT_THRESHOLDS: AlertEngineThresholds = {
    telemetryGapMinutes: 30,
    deliveryVarianceThreshold: 5,
    nightDrawdownSensitivity: 'standard',
    refillDetectionThreshold: 10,
};

const SCAN_INTERVAL_MS = 60000; // 60 Seconds (Rapid detection for first alert)
const NOTIFICATION_DEBOUNCE_MS = 1800000; // 30 Minutes (Avoid consecutive alert noise)

function computeRiskIndex(activeAlerts: Alert[]): RiskIndex {
    const fuelAlerts = activeAlerts.filter(a => ['low_level', 'leak_detected', 'overfill', 'theft_detected', 'unauthorized_refill'].includes(a.type));
    const systemAlerts = activeAlerts.filter(a => ['sensor_failure', 'telemetry_gap', 'connectivity_lost', 'high_temperature'].includes(a.type));
    const complianceAlerts = activeAlerts.filter(a => ['compliance_deadline', 'delivery_variance', 'market_news', 'regulatory_update'].includes(a.type));

    const topFuelScore = fuelAlerts.length > 0
        ? Math.max(...fuelAlerts.map(a => a.score ?? 0))
        : 0;
    const topSystemScore = systemAlerts.length > 0
        ? Math.max(...systemAlerts.map(a => a.score ?? 0))
        : 0;
    const topComplianceScore = complianceAlerts.length > 0
        ? Math.max(...complianceAlerts.map(a => a.score ?? 0))
        : 0;

    const toLabel = (s: number): 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' => {
        if (s >= 90) return 'CRITICAL';
        if (s >= 70) return 'HIGH';
        if (s >= 40) return 'MODERATE';
        return 'LOW';
    };

    const toComplianceLabel = (s: number): 'STABLE' | 'WATCH' | 'AT_RISK' => {
        if (s >= 70) return 'AT_RISK';
        if (s >= 40) return 'WATCH';
        return 'STABLE';
    };

    return {
        fuel: { score: topFuelScore, label: toLabel(topFuelScore) },
        system: { score: topSystemScore, label: toLabel(topSystemScore) },
        compliance: { score: topComplianceScore, label: toComplianceLabel(topComplianceScore) },
    };
}

export function useAlertEngine(
    stationId: string,
    thresholds: AlertEngineThresholds = DEFAULT_THRESHOLDS
) {
    const { tanks } = useTanks(stationId);
    const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
    const [riskIndex, setRiskIndex] = useState<RiskIndex>({
        fuel: { score: 0, label: 'LOW' },
        system: { score: 0, label: 'LOW' },
        compliance: { score: 0, label: 'STABLE' },
    });
    const [isScanning, setIsScanning] = useState(false);
    const [hasLoadedAlerts, setHasLoadedAlerts] = useState(false);
    const [lastScanTime, setLastScanTime] = useState<number>(() => {
        const saved = localStorage.getItem(`iotank_last_scan_${stationId}`);
        return saved ? parseInt(saved) : 0;
    });
    const latestReadingsRef = useRef<Record<string, TankReading | null>>({});
    const previousReadingsRef = useRef<Record<string, TankReading | null>>({});
    const refillSessionsRef = useRef<Record<string, { 
        isActive: boolean; 
        startVolume: number; 
        startTime: number; 
        stableCount: number;
        lastInflowVolume: number;
    }>>({});
    const { status: shiftStatus } = useShiftStatus();
    // Memory for toasted alerts with TTL: { 'tankId:type': timestamp }
    // [PERSISTENCE UPGRADE]: Load from localStorage to survive refreshes
    const [toastedAlerts, setToastedAlertsState] = useState<Map<string, number>>(() => {
        const saved = localStorage.getItem(`iotank_toast_memory_${stationId}`);
        if (saved) {
            try {
                return new Map(JSON.parse(saved));
            } catch (e) {
                return new Map();
            }
        }
        return new Map();
    });

    const toastedAlertsRef = useRef<Map<string, number>>(toastedAlerts);
    const initialScanPerformedRef = useRef(false);

    // Sync ref and localStorage when state changes
    useEffect(() => {
        toastedAlertsRef.current = toastedAlerts;
        localStorage.setItem(`iotank_toast_memory_${stationId}`, JSON.stringify(Array.from(toastedAlerts.entries())));
    }, [toastedAlerts, stationId]);

    // ── Subscribe to active alerts from Supabase ────────────────────────────
    useEffect(() => {
        if (!stationId) return;

        const fetchAlerts = async () => {
            try {
                const { data, error } = await supabase
                    .from('alerts')
                    .select('*')
                    .eq('is_resolved', false)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                
                // Map DB alerts to Alert interface
                const mappedAlerts: Alert[] = (data || []).map(row => ({
                    id: row.id,
                    tankId: row.tank_id,
                    type: row.alert_type,
                    severity: row.severity,
                    title: row.title,
                    message: row.message,
                    timestamp: new Date(row.created_at).getTime(),
                    resolved: row.is_resolved,
                    score: row.alert_data?.score || 0,
                    metadata: row.metadata || {}
                } as Alert));

                const sorted = mappedAlerts.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
                setActiveAlerts(sorted);
                setRiskIndex(computeRiskIndex(sorted));
                setHasLoadedAlerts(true);
            } catch (err) {
                console.error('[AlertEngine] Alert fetch error:', err);
            }
        };

        fetchAlerts();

        const channel = supabase
            .channel(`engine-alerts:${stationId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'alerts', filter: `is_resolved=eq.false` },
                () => fetchAlerts()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [stationId]);

    const { pushEvent } = useTelemetryQueue();

    // ── Detection scan ───────────────────────────────────────────────────────
    const runScan = useCallback(async () => {
        if (!tanks.length || isScanning || !hasLoadedAlerts) return;
        
        // Prevent redundant scans if performed very recently (within 10s)
        const now = Date.now();
        if (now - lastScanTime < 10000) return;

        setIsScanning(true);
        setLastScanTime(now);
        localStorage.setItem(`iotank_last_scan_${stationId}`, now.toString());

        try {
            const allDrafts = tanks.flatMap((tank: Tank) => {
                const latestReading = latestReadingsRef.current[tank.id];
                const previousReading = previousReadingsRef.current[tank.id];
                
                // 1. Core Alerts
                const drafts = detectTankAlerts({
                    tank,
                    latestReading: latestReading ?? null,
                    previousReading: previousReading ?? null,
                    isShiftOpen: shiftStatus === 'open',
                    telemetryGapMinutes: thresholds.telemetryGapMinutes,
                    deliveryVarianceThreshold: thresholds.deliveryVarianceThreshold,
                    refillDetectionThreshold: thresholds.refillDetectionThreshold,
                    nightDrawdownSensitivity: thresholds.nightDrawdownSensitivity,
                });

                // 2. STATEFUL REFILL TRACKING
                if (latestReading && previousReading) {
                    const currVol = latestReading.volumeCorrected || latestReading.volume || 0;
                    const prevVol = previousReading.volumeCorrected || previousReading.volume || 0;
                    const volChange = currVol - prevVol;
                    
                    // Threshold normalization (1% of capacity or 20L)
                    const refillThreshold = tank.capacity ? (tank.capacity * 0.01) : (thresholds.refillDetectionThreshold || 20);
                    
                    if (!refillSessionsRef.current[tank.id]) {
                        refillSessionsRef.current[tank.id] = { isActive: false, startVolume: 0, startTime: 0, stableCount: 0, lastInflowVolume: 0 };
                    }
                    
                    const session = refillSessionsRef.current[tank.id];

                    if (!session.isActive && volChange > refillThreshold) {
                        // 🟢 START REFILL: Capture current and previous volumes for high-fidelity start point
                        session.isActive = true;
                        // V_start is the volume BEFORE the climb started
                        session.startVolume = prevVol; 
                        session.startTime = Date.now();
                        session.stableCount = 0;
                        session.lastInflowVolume = currVol;

                        const isUnauthorized = shiftStatus !== 'open';
                        
                        console.log(`[AlertEngine] REFILL_START on ${tank.name}. Start: ${prevVol}L, Detected Climb: ${volChange}L. Authorized: ${!isUnauthorized}`);

                        window.dispatchEvent(new CustomEvent('system-toast', {
                            detail: {
                                title: isUnauthorized ? '🔴 SECURITY: UNAUTHORIZED INFLOW' : 'Refill Protocol: INITIATED',
                                message: isUnauthorized 
                                    ? `ALERT: Fuel inflow detected on ${tank.name} while shift is CLOSED. Monitoring unauthorized activity.`
                                    : `Sensors detected inflow for ${tank.name}. Monitoring volume climb. Pre-refill Volume: ${prevVol.toFixed(0)}L`,
                                type: isUnauthorized ? 'error' : 'refill',
                                attribution: 'ATG_SENSE_AUTO'
                            }
                        }));

                        // Trigger Modal immediately so user can enter invoice while flowing
                        pushEvent({
                            type: isUnauthorized ? 'critical' : 'due',
                            message: isUnauthorized
                                ? `SECURITY BREACH: ${tank.name} is receiving product while site is CLOSED!`
                                : `REFUEL STARTED: ${tank.name} is receiving product.`,
                            actionLabel: isUnauthorized ? 'INTERCEPT & LOG' : 'Enter Invoice',
                            metadata: {
                                tankId: tank.id,
                                modalType: 'refill_verification',
                                alertData: {
                                    tank_id: tank.id,
                                    metadata: {
                                        startVolume: prevVol,
                                        type: isUnauthorized ? 'UNAUTHORIZED_REFILL_IN_PROGRESS' : 'REFILL_IN_PROGRESS'
                                    }
                                }
                            }
                        });
                    } else if (session.isActive) {
                        // Growth detection (1.0L buffer to account for noise)
                        if (volChange > 1.0) { 
                            session.stableCount = 0;
                            session.lastInflowVolume = currVol;
                            console.log(`[AlertEngine] REFILL_IN_PROGRESS on ${tank.name}. Current: ${currVol}L`);
                        } else {
                            // No significant growth detected in this scan
                            session.stableCount += 1;
                            console.log(`[AlertEngine] REFILL_STABILIZING on ${tank.name}. Stable for ${session.stableCount} cycle(s).`);
                        }

                        // 🛑 END REFILL (Stability reached for 1 full reading cycle ~60s)
                        if (session.stableCount >= 1) {
                            const endVolume = currVol;
                            const deliveredVolume = endVolume - session.startVolume;
                            session.isActive = false;

                            console.log(`[AlertEngine] REFILL_COMPLETE on ${tank.name}. Captured Delta: ${deliveredVolume}L`);

                            const isUnauthorized = shiftStatus !== 'open';
                            
                            // Create the permanent alert for reconciliation
                            const refillAlert = {
                                station_id: stationId,
                                tank_id: tank.id,
                                alert_type: isUnauthorized ? 'unauthorized_refill' : 'refill',
                                severity: isUnauthorized ? 'critical' : 'info',
                                title: isUnauthorized 
                                    ? `🔴 Unauthorized Out-of-Hours Refill: ${tank.name}`
                                    : `Refill Verification Required: ${tank.name}`,
                                message: isUnauthorized
                                    ? `SECURITY VIOLATION: Tank gained ${deliveredVolume.toFixed(1)}L while station was closed. Immeditately reconcile Waybill/Invoice.`
                                    : `Automatic detection completed. Net Sensory Delivery: ${deliveredVolume.toFixed(1)}L. (Start: ${session.startVolume.toFixed(1)}L -> End: ${endVolume.toFixed(1)}L)`,
                                alert_data: { score: isUnauthorized ? 98 : 95 },
                                is_resolved: false,
                                metadata: {
                                    type: isUnauthorized ? 'UNAUTHORIZED_REFILL_COMPLETE' : 'REFILL_COMPLETE',
                                    startVolume: session.startVolume,
                                    endVolume: endVolume,
                                    deliveredVolume: deliveredVolume,
                                    detectedAt: new Date().toISOString()
                                }
                            };

                            supabase.from('alerts').insert(refillAlert).then(() => {
                                // Finalize notification
                                window.dispatchEvent(new CustomEvent('system-toast', {
                                    detail: {
                                        title: isUnauthorized ? '🔴 UNAUTHORIZED REFILL COMPLETED' : 'Refuel Completed',
                                        message: isUnauthorized
                                            ? `SECURITY: Volume stabilized on ${tank.name} (+${deliveredVolume.toFixed(0)}L). Shift was CLOSED during inflow.`
                                            : `Volume stabilized on ${tank.name}. Total sensory delivery: ${deliveredVolume.toFixed(0)}L.`,
                                        type: isUnauthorized ? 'error' : 'success',
                                        attribution: 'ATG_SENSE_AUTO'
                                    }
                                }));

                                // Trigger Modal again (or refresh it) with end data
                                pushEvent({
                                    type: 'critical',
                                    message: isUnauthorized
                                        ? `SECURITY ALERT: ${tank.name} gained ${deliveredVolume.toFixed(0)}L while CLOSED.`
                                        : `REFUEL COMPLETED: ${tank.name} gained ${deliveredVolume.toFixed(0)}L. Immediate reconciliation required.`,
                                    actionLabel: 'Finalize Forensic Record',
                                    metadata: {
                                        tankId: tank.id,
                                        modalType: 'refill_verification',
                                        alertData: refillAlert 
                                    }
                                });
                            });
                        }
                    }
                }

                // Filter out 'refill_detected' from drafts as we handle it statefully above
                return drafts.filter(d => d.type !== 'refill_detected');
            });

            const uniqueDrafts = filterDuplicates(allDrafts, activeAlerts);

            // Filter against "Toast Memory" to prevent re-toasting known active issues
            const draftsToToast = uniqueDrafts.filter(draft => {
                const key = `${draft.tankId}:${draft.type}`;
                const lastToastTime = toastedAlertsRef.current.get(key);
                const now = Date.now();
                
                if (lastToastTime && (now - lastToastTime) < NOTIFICATION_DEBOUNCE_MS) {
                    return false;
                }
                
                // Add/Update memory
                setToastedAlertsState(prev => {
                    const next = new Map(prev);
                    next.set(key, now);
                    return next;
                });
                return true;
            });

            if (uniqueDrafts.length > 0) {
                const dbAlerts = uniqueDrafts.map(draft => ({
                    station_id: stationId,
                    tank_id: draft.tankId,
                    alert_type: draft.type,
                    severity: draft.severity,
                    title: draft.title,
                    message: draft.message,
                    alert_data: { score: draft.score },
                    is_resolved: false,
                    metadata: draft.metadata || {}
                }));

                await supabase.from('alerts').insert(dbAlerts);
                
                // [NEW]: Universal Toast Notification for every new system alert
                // Uses the filtered "draftsToToast" to satisfy the "Optimal Frequency" requirement
                draftsToToast.forEach(draft => {
                    const isCritical = draft.severity === 'critical';
                    window.dispatchEvent(new CustomEvent('system-toast', {
                        detail: {
                            title: isCritical ? `🔴 ${draft.title}` : draft.title,
                            message: draft.message,
                            type: isCritical ? 'error' : (draft.severity === 'warning' ? 'warning' : 'info'),
                            attribution: 'SYSTEM_SENSE'
                        }
                    }));
                });

                // Browser-side & SMTP tactical security notification
                uniqueDrafts.forEach(draft => {
                    const meta = (draft.metadata as any);
                    const suspectedType = meta?.type; // 'THEFT_CLOSED', 'LEAK_SUSPICION', 'THEFT_OPEN_PARALLEL'
                    
                    // Push to dynamic TelemetryQueue for ActionQueue visibility
                    if (!suspectedType || (!suspectedType.includes('THEFT') && !suspectedType.includes('LEAK'))) {
                        pushEvent({
                            type: draft.severity === 'critical' ? 'critical' : draft.severity === 'warning' ? 'watch' : 'due',
                            message: draft.message,
                            actionLabel: 'Investigate',
                            metadata: {
                                tankId: draft.tankId
                            }
                        });
                    }

                    if (suspectedType && (suspectedType.includes('THEFT') || suspectedType.includes('LEAK'))) {
                        const siteName = draft.rootCauseLink?.label || 'IOTANK SITE';
                        
                        // 1. Browser Push
                        NotificationService.notifySecurity(
                            suspectedType.includes('THEFT') ? 'THEFT' : 'LEAK',
                            siteName,
                            draft.description
                        );

                        // 2. [FORENSIC UPGRADE]: Push specific Intrusion Modal to Telemetry Queue
                        pushEvent({
                            type: draft.severity === 'critical' ? 'critical' : 'watch',
                            message: draft.message,
                            actionLabel: suspectedType.includes('THEFT') ? 'INTERCEPT NOW' : 'Review Leak',
                            metadata: {
                                tankId: draft.tankId,
                                modalType: 'security_intrusion',
                                forensicData: {
                                    type: suspectedType.includes('THEFT') ? 'THEFT' : 'LEAK',
                                    dropRate: meta.dropRate,
                                    volumeLost: meta.volumeLost,
                                    tankName: siteName,
                                    timestamp: new Date().toISOString()
                                }
                            }
                        });

                        // 3. Off-Platform SMTP Tactical Email
                        EmailDispatchService.sendSecurityAlert({
                            to: 'admin@iotank.com', // In production, this would be the client's admin email
                            type: suspectedType.includes('THEFT') ? 'THEFT' : 'LEAK',
                            siteName: siteName,
                            details: {
                                timestamp: new Date().toISOString(),
                                dropRate: meta.dropRate,
                                lossVolume: meta.volumeLost,
                                description: draft.description
                            }
                        });
                    }
                });
            }
        } catch (err) {
            console.warn('[AlertEngine] Scan error:', err);
        } finally {
            setIsScanning(false);
        }
    }, [tanks, activeAlerts, stationId, thresholds, isScanning, shiftStatus, pushEvent]);

    // ── On-load + 60s polling ────────────────────────────────────────────────
    useEffect(() => {
        if (!tanks.length || !hasLoadedAlerts) return;

        // On first mount after data load, check if we need an immediate scan
        const now = Date.now();
        if (now - lastScanTime >= SCAN_INTERVAL_MS) {
            runScan();
        }

        const interval = setInterval(runScan, SCAN_INTERVAL_MS);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tanks.length, stationId, hasLoadedAlerts]);

    // ── Expose reading cache setter so parent can update it ──────────────────
    const updateReading = useCallback((tankId: string, reading: TankReading | null) => {
        if (reading && latestReadingsRef.current[tankId]?.id !== reading.id) {
            previousReadingsRef.current[tankId] = latestReadingsRef.current[tankId];
            latestReadingsRef.current[tankId] = reading;

            // [FIX]: Dynamic Boot Scan - If this is the first set of data, fire an immediate scan
            // This ensures notifications aren't 'silent' until the first 30min interval.
            const allTanksHaveData = tanks.every((t: Tank) => latestReadingsRef.current[t.id]);
            if (allTanksHaveData && !initialScanPerformedRef.current) {
                initialScanPerformedRef.current = true;
                console.log('[AlertEngine] BOOT: Hardware data acquired. Firing initial bootstrap scan.');
                runScan();
            }
        }
    }, [tanks, runScan]);

    /**
     * Get correlated (composite) view of alerts — grouped by tank if 3+ present.
     */
    const correlatedAlerts = correlateAlerts(activeAlerts);

    return {
        activeAlerts,
        correlatedAlerts,
        riskIndex,
        isScanning,
        updateReading,
    };
}
