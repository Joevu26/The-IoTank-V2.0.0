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
import { Alert, TankReading, RiskIndex } from '@/types';
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

const SCAN_INTERVAL_MS = 60_000; // 60 seconds

function computeRiskIndex(activeAlerts: Alert[]): RiskIndex {
    const fuelAlerts = activeAlerts.filter(a => a.type === 'low-level' || a.type === 'leak' || a.type === 'overfill');
    const systemAlerts = activeAlerts.filter(a => a.type === 'sensor-failure' || a.type === 'telemetry-gap' || a.type === 'connectivity-lost');
    const complianceAlerts = activeAlerts.filter(a => a.type === 'compliance-deadline' || a.type === 'delivery-variance');

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
    orgId: string,
    thresholds: AlertEngineThresholds = DEFAULT_THRESHOLDS
) {
    const { tanks } = useTanks(orgId);
    const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
    const [riskIndex, setRiskIndex] = useState<RiskIndex>({
        fuel: { score: 0, label: 'LOW' },
        system: { score: 0, label: 'LOW' },
        compliance: { score: 0, label: 'STABLE' },
    });
    const [isScanning, setIsScanning] = useState(false);
    const latestReadingsRef = useRef<Record<string, TankReading | null>>({});
    const previousReadingsRef = useRef<Record<string, TankReading | null>>({});
    const { status: shiftStatus } = useShiftStatus();

    // ── Subscribe to active alerts from Supabase ────────────────────────────
    useEffect(() => {
        if (!orgId) return;

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
                } as Alert));

                const sorted = mappedAlerts.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
                setActiveAlerts(sorted);
                setRiskIndex(computeRiskIndex(sorted));
            } catch (err) {
                console.error('[AlertEngine] Alert fetch error:', err);
            }
        };

        fetchAlerts();

        const channel = supabase
            .channel(`engine-alerts:${orgId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'alerts', filter: `is_resolved=eq.false` },
                () => fetchAlerts()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [orgId]);

    const { pushEvent } = useTelemetryQueue();

    // ── Detection scan ───────────────────────────────────────────────────────
    const runScan = useCallback(async () => {
        if (!tanks.length || isScanning) return;
        setIsScanning(true);

        try {
            const allDrafts = tanks.flatMap(tank =>
                detectTankAlerts({
                    tank,
                    latestReading: latestReadingsRef.current[tank.id] ?? null,
                    previousReading: previousReadingsRef.current[tank.id] ?? null,
                    isShiftOpen: shiftStatus === 'open',
                    telemetryGapMinutes: thresholds.telemetryGapMinutes,
                    deliveryVarianceThreshold: thresholds.deliveryVarianceThreshold,
                    refillDetectionThreshold: thresholds.refillDetectionThreshold,
                    nightDrawdownSensitivity: thresholds.nightDrawdownSensitivity,
                })
            );

            const uniqueDrafts = filterDuplicates(allDrafts, activeAlerts);

            if (uniqueDrafts.length > 0) {
                const dbAlerts = uniqueDrafts.map(draft => ({
                    station_id: orgId,
                    tank_id: draft.tankId,
                    alert_type: draft.type,
                    severity: draft.severity,
                    title: draft.title,
                    message: draft.message,
                    alert_data: { score: draft.score },
                    is_resolved: false,
                    auth_user_id: 'system', // Alert engine acts as system
                }));

                await supabase.from('alerts').insert(dbAlerts);

                // Browser-side & SMTP tactical security notification
                uniqueDrafts.forEach(draft => {
                    const meta = (draft.metadata as any);
                    const suspectedType = meta?.type; // 'THEFT_CLOSED', 'LEAK_SUSPICION', 'THEFT_OPEN_PARALLEL'
                    
                    // Push to dynamic TelemetryQueue for ActionQueue visibility
                    pushEvent({
                        type: draft.severity === 'critical' ? 'critical' : draft.severity === 'warning' ? 'watch' : 'due',
                        message: draft.message,
                        actionLabel: draft.type === 'refill-detected' ? 'Authorize Reconcile' : 'Investigate',
                        metadata: {
                            tankId: draft.tankId,
                            modalType: draft.type === 'refill-detected' ? 'delivery' : null
                        }
                    });

                    if (suspectedType && (suspectedType.includes('THEFT') || suspectedType.includes('LEAK'))) {
                        const siteName = draft.rootCauseLink?.label || 'IOTANK SITE';
                        
                        // 1. Browser Push
                        NotificationService.notifySecurity(
                            suspectedType.includes('THEFT') ? 'THEFT' : 'LEAK',
                            siteName,
                            draft.description
                        );

                        // 2. Off-Platform SMTP Tactical Email
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
    }, [tanks, activeAlerts, orgId, thresholds, isScanning, shiftStatus, pushEvent]);

    // ── On-load + 60s polling ────────────────────────────────────────────────
    useEffect(() => {
        if (!tanks.length) return;

        runScan();
        const interval = setInterval(runScan, SCAN_INTERVAL_MS);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tanks.length, orgId]);

    // ── Expose reading cache setter so parent can update it ──────────────────
    const updateReading = useCallback((tankId: string, reading: TankReading | null) => {
        if (reading && latestReadingsRef.current[tankId]?.id !== reading.id) {
            previousReadingsRef.current[tankId] = latestReadingsRef.current[tankId];
            latestReadingsRef.current[tankId] = reading;
        }
    }, []);

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
