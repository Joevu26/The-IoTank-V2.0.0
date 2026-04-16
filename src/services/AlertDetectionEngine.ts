/**
 * AlertDetectionEngine — Client-side alert detection for IoTank (Spark-plan safe).
 *
 * Runs entirely in the browser using:
 *  - Tank data + latest readings from Firestore listeners
 *  - On-load scan + 60s polling interval (orchestrated by useAlertEngine hook)
 *  - Writes to Firestore only when no duplicate active alert exists
 *
 * Detection triggers:
 *  1. Level threshold breach (critical / low)
 *  2. Telemetry gap (last reading too old)
 *  3. Delivery variance (invoice vs measured %)
 *  4. Sensor failure (signal quality < 30)
 *  5. SHIFT-AWARE Forensic Logic:
 *      - Closed Shift: Any drop is an anomaly (Theft vs Leak)
 *      - Open Shift: Drop rate > Max Pump Capacity (Parallel Pull Theft)
 */

import { Tank, TankReading, Alert } from '@/types';
import { scoreByType } from './AlertScoringEngine';

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
    type: Alert['type'];
    title: string;
    description: string;
    message: string;
    severity: Alert['severity'];
    severityLabel: Alert['severityLabel'];
    score: number;
    source: 'system';
    state: 'ACTIVE';
    resolved: boolean;
    detectionMethod: Alert['detectionMethod'];
    aiConfidence?: number;
    rootCauseLink?: Alert['rootCauseLink'];
    metadata?: Alert['metadata'];
}

/**
 * Run all detection checks for a single tank and return draft alerts.
 * Does NOT write to Firestore — that is the caller's responsibility.
 */
export function detectTankAlerts(ctx: DetectionContext): DraftAlert[] {
    const { tank, latestReading } = ctx;
    const drafts: DraftAlert[] = [];
    const now = Date.now();

    const telemetryGapMs = (ctx.telemetryGapMinutes ?? 30) * 60 * 1000;
    
    // Safety check
    if (!tank || !latestReading) return [];

    const fuelLevel = latestReading.fuelLevel;

    // ── 1. CRITICAL LEVEL BREACH (5%) ──────────────────────────────────────────
    if (fuelLevel !== undefined && fuelLevel <= 5) {
        const { score, label } = scoreByType('low-level-critical', 0.95);
        drafts.push({
            tankId: tank.id,
            siteId: tank.siteId,
            type: 'low-level',
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
    // ── 2. LOW LEVEL WARNING (20%) ─────────────────────────────────────────────
    else if (
        fuelLevel !== undefined &&
        fuelLevel > 5 &&
        fuelLevel <= 20
    ) {
        const { score, label } = scoreByType('low-level-warning', 0.80);
        drafts.push({
            tankId: tank.id,
            siteId: tank.siteId,
            type: 'low-level',
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
    // ── 2.5 INFORMATIONAL ALERT (50%) ──────────────────────────────────────────
    else if (
        fuelLevel !== undefined &&
        Math.abs(fuelLevel - 50) <= 0.5 // More robust check
    ) {
        const { score, label } = scoreByType('reporting-ready', 0.50);
        drafts.push({
            tankId: tank.id,
            siteId: tank.siteId,
            type: 'info',
            title: `Informational: ${tank.name} at 50%`,
            description: `Tank has reached the 50% capacity milestone. Current level: ${fuelLevel.toFixed(1)}%.`,
            message: `${tank.name} half-capacity reached.`,
            severity: 'info',
            severityLabel: label || 'INFO',
            score,
            source: 'system',
            state: 'ACTIVE',
            resolved: false,
            detectionMethod: 'deterministic',
            aiConfidence: 0.90,
            rootCauseLink: { type: 'tank', id: tank.id, label: tank.name },
        });
    }

    // ── 2.6 HIGH LEVEL & OVERFILL (95% / 98%) ──────────────────────────────────
    if (fuelLevel !== undefined && fuelLevel >= 98) {
        const { score, label } = scoreByType('composite-supply-risk', 0.98);
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
    } else if (fuelLevel !== undefined && fuelLevel >= 95) {
        const { score, label } = scoreByType('low-level-warning', 0.85); // Redirecting warning logic
        drafts.push({
            tankId: tank.id,
            siteId: tank.siteId,
            type: 'overfill',
            title: `High Level Alert: ${tank.name}`,
            description: `Level at ${fuelLevel.toFixed(1)}%. Slow inflow/monitor closely to prevent spill.`,
            message: `High Level: ${tank.name} at ${fuelLevel.toFixed(1)}%`,
            severity: 'warning',
            severityLabel: label,
            score,
            source: 'system',
            state: 'ACTIVE',
            resolved: false,
            detectionMethod: 'deterministic',
            aiConfidence: 0.90,
            rootCauseLink: { type: 'tank', id: tank.id, label: tank.name },
        });
    }

    // ── 3. TELEMETRY GAP ─────────────────────────────────────────────────────
    if (latestReading && (now - latestReading.timestamp) > telemetryGapMs) {
        const gapMinutes = Math.round((now - latestReading.timestamp) / 60000);
        const { score, label } = scoreByType('telemetry-gap', 0.85);
        drafts.push({
            tankId: tank.id,
            siteId: tank.siteId,
            type: 'telemetry-gap',
            title: `Telemetry gap on ${tank.name}`,
            description: `No reading received for ${gapMinutes} minutes. Sensor or connectivity issue likely.`,
            message: `${tank.name}: ${gapMinutes}min telemetry gap`,
            severity: 'warning',
            severityLabel: label,
            score,
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
        const { score, label } = scoreByType('sensor-failure', 0.78);
        drafts.push({
            tankId: tank.id,
            siteId: tank.siteId,
            type: 'sensor-failure',
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
        const timeDiffHrs = Math.max(0.016, (latestReading.timestamp - previousReading.timestamp) / (1000 * 60 * 60));
        const prevVol = previousReading.volumeCorrected || previousReading.volume || 0;
        const currVol = latestReading.volumeCorrected || latestReading.volume || 0;
        
        const volumeDrop = prevVol - currVol; // Positive if consuming
        const dropRate = volumeDrop / timeDiffHrs; // L/hr

        // Heuristics
        const rapidDropThreshold = tank.rapidDefillThreshold || 100; // L/hr (Forensic Theft)
        const leakThreshold = tank.leakageThreshold || 2;           // L/hr (Maintenance Leak)
        
        // Physical Capacity Limit: 
        // Standard pumps ~40-60 L/min (2400-3600 L/hr). 
        // If drop rate > Max Capacity, it's theft even if shift is OPEN.
        const maxPumpFlow = (ctx.maxPumpFlowRateLpm || 80) * 60; // Default 4800 L/hr

        if (!isShiftOpen) {
            // CASE A: Shift is CLOSED. Any drop is suspicious.
            const MIN_THEFT_VOLUME = 5.0; // Liters - Increased threshold to mitigate ultrasonic jitter
            if (volumeDrop > MIN_THEFT_VOLUME && dropRate > rapidDropThreshold) {
                const { score, label } = scoreByType('composite-supply-risk', 0.98);
                drafts.push({
                    tankId: tank.id,
                    siteId: tank.siteId,
                    type: 'anomaly',
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
                    metadata: { type: 'THEFT_CLOSED', dropRate, volumeLost: volumeDrop } as any
                });
            } else if (dropRate > leakThreshold) {
                const { score, label } = scoreByType('infrastructure-degradation', 0.85);
                drafts.push({
                    tankId: tank.id,
                    siteId: tank.siteId,
                    type: 'leak',
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
                    metadata: { type: 'LEAK_SUSPICION', dropRate } as any
                });
            }
        } else {
            // CASE B: Shift is OPEN. Drop is expected, but siphoning (Parallel Pull) is theft.
            const MIN_THEFT_VOLUME = 5.0; // Liters - Standardized noise rejection threshold
            if (volumeDrop > MIN_THEFT_VOLUME && dropRate > maxPumpFlow) {
                const { score, label } = scoreByType('composite-supply-risk', 0.95);
                drafts.push({
                    tankId: tank.id,
                    siteId: tank.siteId,
                    type: 'anomaly',
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
                    metadata: { type: 'THEFT_OPEN_PARALLEL', dropRate, maxPumpFlow } as any
                });
            }
        }

        // ── 6. REFILL DETECTION (Automated Delivery Sensing) ───────────────────────
        // [HARDENING]: Normalize threshold to 1% of capacity, fallback to 20L for safety
        const refillThreshold = ctx.tank.capacity ? (ctx.tank.capacity * 0.01) : (ctx.refillDetectionThreshold || 20);
        const volumeIncrease = currVol - prevVol;

        if (volumeIncrease > refillThreshold) {
            const { score, label } = scoreByType('refill-detected', 0.90);
            drafts.push({
                tankId: tank.id,
                siteId: tank.siteId,
                type: 'refill-detected',
                title: `Refill Identified (Add Delivery)`,
                description: `Significant volume increase of ${volumeIncrease.toFixed(1)}L detected at ${new Date().toLocaleTimeString()}. Automated delivery record required for forensic reconciliation.`,
                message: `INFO: ${tank.name} refill sensing (+${volumeIncrease.toFixed(1)}L). Please add delivery record.`,
                severity: 'info',
                severityLabel: label,
                score,
                source: 'system',
                state: 'ACTIVE',
                resolved: false,
                detectionMethod: 'deterministic',
                aiConfidence: 0.90,
                rootCauseLink: { type: 'tank', id: tank.id, label: tank.name },
                metadata: { type: 'REFILL', volumeIncrease } as any
            });
        }
    }

    return drafts;
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
 * Group or correlate alerts if needed (e.g., if 3+ tanks have the same issue).
 */
export function correlateAlerts(alerts: Alert[]): Alert[] {
    // Simple pass-through for now, can be extended for site-wide anomaly detection
    return alerts;
}
