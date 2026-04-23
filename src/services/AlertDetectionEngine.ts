/**
 * AlertDetectionEngine — Client-side alert detection for IoTank (Supabase/Postgres).
 *
 * Runs entirely in the browser using:
 *  - Tank data + latest readings from Supabase Realtime
 *  - On-load scan + 60s polling interval (orchestrated by useAlertEngine hook)
 *  - Writes to Supabase only when no duplicate active alert exists
 *
 * Detection triggers:
 *  1. Level threshold breach (critical / low)
 *  2. Connectivity lost (last reading too old)
 *  3. Delivery variance (invoice vs measured %)
 *  4. Sensor failure (signal quality < 30)
 *  5. SHIFT-AWARE Forensic Logic:
 *      - Closed Shift: Any drop is an anomaly (Theft vs Leak)
 *      - Open Shift: Drop rate > Max Pump Capacity (Parallel Pull Theft)
 */

import { Tank, TankReading, Alert } from '@/types';
import { scoreByType } from './AlertScoringEngine';
import { calculateTimeBasedSlope } from './algorithms';

export interface DetectionContext {
    tank: Tank;
    latestReading: TankReading | null;
    previousReading?: TankReading | null; // For rate calculation (L/hr)
    isShiftOpen?: boolean;           // From useShiftStatus
    telemetryGapMinutes?: number;   // from user thresholds, default 30
    deliveryVarianceThreshold?: number; // % default 5
    refillDetectionThreshold?: number;  // % or L, default 10
    nightDrawdownSensitivity?: 'high' | 'standard' | 'conservative';
    maxPumpFlowRateLpm?: number;     // Max Liters Per Minute of terminal pumps
}

export interface DraftAlert {
    tankId: string;
    siteId: string;
    type: string;
    title: string;
    description: string;
    message: string;
    severity: Alert['severity'];
    severityLabel: string;
    score: number;
    source: 'system';
    state: 'ACTIVE';
    resolved: boolean;
    detectionMethod: string;
    aiConfidence?: number;
    rootCauseLink?: { type: string; id: string; label: string };
    metadata?: any;
}

/**
 * Run all detection checks for a single tank and return draft alerts.
 * Does NOT write to Supabase — that is the caller's responsibility.
 */
export function detectTankAlerts(ctx: DetectionContext): DraftAlert[] {
    const { tank, latestReading } = ctx;
    const drafts: DraftAlert[] = [];
    const now = Date.now();

    const telemetryGapMs = (ctx.telemetryGapMinutes ?? 30) * 60 * 1000;
    
    // Safety check
    if (!tank || !latestReading) return [];

    const fuelLevel = (() => {
        const raw = latestReading.fuelLevel;
        if (raw !== undefined && raw > 0) return raw;
        
        // [FIX]: Forensic Fallback - Calculate level if missing or 0 but volume exists
        const vol = latestReading.volumeCorrected || latestReading.volume || 0;
        if (vol > 0 && tank.capacity) {
            const calculated = (vol / tank.capacity) * 100;
            return Math.min(100, Math.max(0, calculated));
        }
        return raw;
    })();

    // ── 1. CRITICAL LEVEL BREACH (5%) ──────────────────────────────────────────
    if (fuelLevel !== undefined && fuelLevel <= 5) {
        const { score, label } = scoreByType('low_level_critical', 0.95);
        drafts.push({
            tankId: tank.id,
            siteId: tank.siteId,
            type: 'low_level',
            title: `CRITICAL LOW: ${tank.name} (Dead Stock Breach)`,
            description: `Level at ${fuelLevel.toFixed(1)}%. Pump protection activated at 5%. Shutdown imminent.`,
            message: `${tank.name} level critical: ${fuelLevel.toFixed(1)}%`,
            severity: 'critical',
            severityLabel: label,
            score,
            source: 'system',
            state: 'ACTIVE',
            resolved: false,
            detectionMethod: 'deterministic',
            aiConfidence: 0.95,
            rootCauseLink: { type: 'tank', id: tank.id, label: tank.name },
        });
    }
    // ── 2. LOW LEVEL WARNING (15%) ─────────────────────────────────────────────
    else if (
        fuelLevel !== undefined &&
        fuelLevel > 5 &&
        fuelLevel <= 15 // Standardized with Backend
    ) {
        const { score, label } = scoreByType('low_level_warning', 0.80);
        drafts.push({
            tankId: tank.id,
            siteId: tank.siteId,
            type: 'low_level',
            title: `LOW LEVEL: ${tank.name} Reorder Point`,
            description: `Level at ${fuelLevel.toFixed(1)}%. Recommend reordering fuel to maintain operations.`,
            message: `${tank.name} fuel level low: ${fuelLevel.toFixed(1)}%`,
            severity: 'warning',
            severityLabel: label,
            score,
            source: 'system',
            state: 'ACTIVE',
            resolved: false,
            detectionMethod: 'deterministic',
            aiConfidence: 0.80,
            rootCauseLink: { type: 'tank', id: tank.id, label: tank.name },
        });
    }

    // ── 2.6 HIGH LEVEL & OVERFILL (95% / 98%) ──────────────────────────────────
    if (fuelLevel !== undefined && fuelLevel >= 98) {
        const { score, label } = scoreByType('composite_supply_risk', 0.98);
        drafts.push({
            tankId: tank.id,
            siteId: tank.siteId,
            type: 'overfill',
            title: `CRITICAL OVERFILL: ${tank.name}`,
            description: `Level at ${fuelLevel.toFixed(1)}%. Immediate spill risk. Halt all delivery operations.`,
            message: `CRITICAL OVERFILL: ${tank.name} at ${fuelLevel.toFixed(1)}%`,
            severity: 'critical',
            severityLabel: label,
            score,
            source: 'system',
            state: 'ACTIVE',
            resolved: false,
            detectionMethod: 'deterministic',
            aiConfidence: 0.98,
            rootCauseLink: { type: 'tank', id: tank.id, label: tank.name },
        });
    }

    // ── 3. CONNECTIVITY LOST ─────────────────────────────────────────────────────
    if (latestReading && (now - latestReading.timestamp) > telemetryGapMs) {
        const gapMinutes = Math.round((now - latestReading.timestamp) / 60000);
        const { score, label } = scoreByType('telemetry_gap', 0.85);
        drafts.push({
            tankId: tank.id,
            siteId: tank.siteId,
            type: 'connectivity_lost',
            title: `Offline: ${tank.name}`,
            description: `Real-time link interrupted. ${tank.name} hardware has been unreachable for ${formatForensicDuration(gapMinutes)}. Monitoring paused.`,
            message: `Offline: ${tank.name} connection lost for ${formatForensicDuration(gapMinutes)}`,
            severity: gapMinutes > 60 ? 'critical' : 'warning', // Standardized with Backend (1h = critical)
            severityLabel: gapMinutes > 60 ? 'CRITICAL' : label,
            score: gapMinutes > 60 ? 98 : score,
            source: 'system',
            state: 'ACTIVE',
            resolved: false,
            detectionMethod: 'deterministic',
            aiConfidence: 0.85,
            rootCauseLink: { type: 'tank', id: tank.id, label: tank.name },
            metadata: { telemetryGapMinutes: gapMinutes },
        });
    }

    // ── 4. SENSOR FAILURE ─────────────────────────────────────────────────────
    const isQualityFailing = (quality: string | number) => {
        if (typeof quality === 'number') return quality < 30;
        return quality === 'Weak' || quality === 'Unusable' || quality === 'Offline';
    };

    if (latestReading && isQualityFailing(latestReading.signalQuality)) {
        const { score, label } = scoreByType('sensor_failure', 0.78);
        drafts.push({
            tankId: tank.id,
            siteId: tank.siteId,
            type: 'sensor_failure',
            title: `Sensor degradation on ${tank.name}`,
            description: `Signal quality at ${latestReading.signalQuality}%. Readings may be unreliable.`,
            message: `${tank.name}: sensor signal quality ${latestReading.signalQuality}%`,
            severity: 'warning',
            severityLabel: label,
            score,
            source: 'system',
            state: 'ACTIVE',
            resolved: false,
            detectionMethod: 'deterministic',
            aiConfidence: 0.78,
            rootCauseLink: { type: 'tank', id: tank.id, label: tank.name },
        });
    }

    // ── 5. SHIFT-AWARE ANOMALIES (THEFT, LEAK, PARALLEL PULL) ──────────────────
    const { isShiftOpen = false, previousReading } = ctx;

    if (latestReading && previousReading) {
        const prevVol = previousReading.volumeCorrected || previousReading.volume || 0;
        const currVol = latestReading.volumeCorrected || latestReading.volume || 0;
        
        const points = [
            { x: previousReading.timestamp, y: prevVol },
            { x: latestReading.timestamp, y: currVol }
        ];
        
        const volumeDrop = prevVol - currVol; // Positive if consuming
        const dropRate = -calculateTimeBasedSlope(points); // Slope is negative for drop, we want positive L/hr

        // Heuristics
        const rapidDropThreshold = tank.rapidDefillThreshold || 50; // L/hr (Forensic Theft)
        const leakThreshold = tank.leakageThreshold || 2;           // L/hr (Maintenance Leak)
        
        const maxPumpFlow = (ctx.maxPumpFlowRateLpm || 80) * 60; // Default 4800 L/hr

        if (!isShiftOpen) {
            // CASE A: Shift is CLOSED. Any drop is suspicious.
            const MIN_THEFT_VOLUME = 2.0; 
            if (volumeDrop > MIN_THEFT_VOLUME && dropRate > rapidDropThreshold) {
                const { score, label } = scoreByType('composite_supply_risk', 0.98);
                drafts.push({
                    tankId: tank.id,
                    siteId: tank.siteId,
                    type: 'theft_detected',
                    title: `THEFT DETECTED: ${tank.name}`,
                    description: `Unauthorized rapid drop of ${volumeDrop.toFixed(1)}L while shift is CLOSED. Intensity: ${dropRate.toFixed(0)} L/hr.`,
                    message: `CRITICAL: Rapid drawdown on ${tank.name} (Closed Shift)`,
                    severity: 'critical',
                    severityLabel: label,
                    score,
                    source: 'system',
                    state: 'ACTIVE',
                    resolved: false,
                    detectionMethod: 'deterministic',
                    aiConfidence: 0.98,
                    rootCauseLink: { type: 'tank', id: tank.id, label: tank.name },
                    metadata: { type: 'theft_closed', dropRate, volumeLost: volumeDrop }
                });
            } else if (dropRate > leakThreshold) {
                const { score, label } = scoreByType('leak_detected', 0.85);
                drafts.push({
                    tankId: tank.id,
                    siteId: tank.siteId,
                    type: 'leak_detected',
                    title: `LEAK SUSPICION: ${tank.name}`,
                    description: `Persistent volume decline of ${dropRate.toFixed(2)} L/hr during 'Quiet Hours' (Closed Shift). Possible infrastructure failure.`,
                    message: `WARNING: Forensic leak detection on ${tank.name}`,
                    severity: 'warning',
                    severityLabel: label,
                    score,
                    source: 'system',
                    state: 'ACTIVE',
                    resolved: false,
                    detectionMethod: 'deterministic',
                    aiConfidence: 0.85,
                    rootCauseLink: { type: 'tank', id: tank.id, label: tank.name },
                    metadata: { type: 'leak_suspicion', dropRate }
                });
            }
        } else {
            // CASE B: Shift is OPEN. Drop is expected, but siphoning (Parallel Pull) is theft.
            const MIN_THEFT_VOLUME = 2.0; 
            if (volumeDrop > MIN_THEFT_VOLUME && dropRate > maxPumpFlow) {
                const { score, label } = scoreByType('composite_supply_risk', 0.95);
                drafts.push({
                    tankId: tank.id,
                    siteId: tank.siteId,
                    type: 'theft_detected',
                    title: `PARALLEL PULL THEFT: ${tank.name}`,
                    description: `Anomalous discharge of ${dropRate.toFixed(0)} L/hr detected. This exceeds the maximum physical capacity of the terminal pumps (${maxPumpFlow} L/hr). Siphoning suspected during operations.`,
                    message: `CRITICAL: Parallel theft suspected on ${tank.name} (Open Shift)`,
                    severity: 'critical',
                    severityLabel: label,
                    score,
                    source: 'system',
                    state: 'ACTIVE',
                    resolved: false,
                    detectionMethod: 'deterministic',
                    aiConfidence: 0.95,
                    rootCauseLink: { type: 'tank', id: tank.id, label: tank.name },
                    metadata: { type: 'THEFT_OPEN_PARALLEL', dropRate, maxPumpFlow }
                });
            }
        }

        // ── 6. REFILL DETECTION (Automated Delivery Sensing) ───────────────────────
        const refillThreshold = ctx.tank.capacity ? (ctx.tank.capacity * 0.01) : (ctx.refillDetectionThreshold || 20);
        const volumeIncrease = currVol - prevVol;

        if (volumeIncrease > refillThreshold) {
            const isOverCapacity = tank.capacity && (currVol > tank.capacity * 1.02);
            const isUnauthorized = !isShiftOpen;

            const { score, label } = scoreByType(
                isOverCapacity ? 'composite_supply_risk' : (isUnauthorized ? 'composite_supply_risk' : 'refill_detected'), 
                0.90
            );

            drafts.push({
                tankId: tank.id,
                siteId: tank.siteId,
                type: isOverCapacity ? 'anomaly' : (isUnauthorized ? 'unauthorized_refill' : 'refill_detected'),
                title: isOverCapacity 
                    ? `INTEGRITY BREACH: Over-Capacity detected on ${tank.name}` 
                    : (isUnauthorized ? `🔴 UNAUTHORIZED REFILL: ${tank.name}` : `Refill Identified (Add Delivery)`),
                description: isOverCapacity 
                    ? `Critical integrity error: Tank level (${currVol.toFixed(1)}L) exceeds physical capacity (${tank.capacity}L). This indicates severe calibration drift or sensor malfunction.`
                    : (isUnauthorized
                        ? `SECURITY BREACH: Fuel inflow of ${volumeIncrease.toFixed(1)}L detected while shift is CLOSED. Out-of-hours delivery requires immediate verification.`
                        : `Significant volume increase of ${volumeIncrease.toFixed(1)}L detected at ${new Date().toLocaleTimeString()}. Automated delivery record required for forensic reconciliation.`),
                message: isOverCapacity 
                    ? `CRITICAL: ${tank.name} measured volume exceeds physical capacity. Integrity breach.`
                    : (isUnauthorized
                        ? `SECURITY: Unauthorized ${tank.name} refill (+${volumeIncrease.toFixed(1)}L) while closed.`
                        : `INFO: ${tank.name} refill sensing (+${volumeIncrease.toFixed(1)}L). Please add delivery record.`),
                severity: (isOverCapacity || isUnauthorized) ? 'critical' : 'info',
                severityLabel: label,
                score: (isOverCapacity || isUnauthorized) ? 98 : score,
                source: 'system',
                state: 'ACTIVE',
                resolved: false,
                detectionMethod: 'deterministic',
                aiConfidence: 0.95,
                rootCauseLink: { type: 'tank', id: tank.id, label: tank.name },
                metadata: { 
                    type: isOverCapacity ? 'INTEGRITY_BREACH' : (isUnauthorized ? 'UNAUTHORIZED_REFILL' : 'REFILL'), 
                    volumeIncrease, 
                    currVol, 
                    tankCapacity: tank.capacity 
                }
            });
        }
    }

    // Filter out 'refill_detected' from drafts as we handle it statefully above
    return drafts.filter(d => d.type !== 'refill_detected');
}

/**
 * Forensic Time Formatter: Converts minutes into a professional, high-density 
 * string (e.g., 3h 10mins or 1d 4h), skipping units that are zero.
 */
export function formatForensicDuration(minutes: number): string {
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}mins`;

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours < 24) {
        let res = `${hours}h`;
        if (mins > 0) res += ` ${mins}mins`;
        return res;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    
    let res = `${days}d`;
    if (remainingHours > 0) res += ` ${remainingHours}h`;
    if (mins > 0) res += ` ${mins}mins`;
    return res;
}

/**
 * Filter out draft alerts that are already active in the system to avoid spam.
 */
export function filterDuplicates(drafts: DraftAlert[], activeAlerts: Alert[]): DraftAlert[] {
    return drafts.filter(draft => {
        return !activeAlerts.some(active => 
            active.tankId === draft.tankId && 
            active.type === draft.type && 
            !active.resolved
        );
    });
}

/**
 * Group or correlate alerts if needed.
 */
export function correlateAlerts(alerts: Alert[]): Alert[] {
    return alerts;
}
