/**
 * AlertScoringEngine — Industry-grade severity scoring for IoTank alerts.
 *
 * Formula:
 *   score = (impactWeight × impact) + (urgencyWeight × urgency) + (confidenceWeight × confidence)
 *   weights: impact=0.45, urgency=0.35, confidence=0.20
 *
 * Classification:
 *   0–39  → INFO
 *   40–69 → WATCH
 *   70–89 → HIGH
 *   90+   → CRITICAL
 */

import { AlertSeverityLabel } from '@/types';

const WEIGHTS = {
    impact: 0.45,
    urgency: 0.35,
    confidence: 0.20,
};

/**
 * Calculate a normalised severity score (0–100).
 * @param impact      Raw impact magnitude, 0–10 scale
 * @param urgency     Time-sensitivity, 0–10 scale
 * @param confidence  AI / sensor confidence, 0–10 scale
 */
export function calculateScore(impact: number, urgency: number, confidence: number): number {
    const rawScore =
        (WEIGHTS.impact * impact * 10) +
        (WEIGHTS.urgency * urgency * 10) +
        (WEIGHTS.confidence * confidence * 10);

    return Math.min(100, Math.max(0, Math.round(rawScore)));
}

/**
 * Classify a score (0–100) into a severity label.
 */
export function classifyScore(score: number): AlertSeverityLabel {
    if (score >= 90) return 'CRITICAL';
    if (score >= 70) return 'HIGH';
    if (score >= 40) return 'WATCH';
    return 'INFO';
}

/**
 * Map a severity label to its CSS-compatible colour token.
 */
export function getSeverityColor(label: AlertSeverityLabel): string {
    switch (label) {
        case 'CRITICAL': return '#ef4444';
        case 'HIGH': return '#f97316';
        case 'WATCH': return '#f59e0b';
        case 'INFO': return '#3b82f6';
        default: return '#94a3b8';
    }
}

/**
 * Map a severity label to its CSS class suffix used in AlertsCenter.css
 */
export function getSeverityClass(label: AlertSeverityLabel): string {
    return label.toLowerCase(); // 'critical' | 'high' | 'watch' | 'info'
}

/**
 * Pre-built score profiles for each detection trigger type.
 * Each profile defines { impact, urgency, confidence } on a 0–10 scale.
 */
export const TRIGGER_PROFILES: Record<string, { impact: number; urgency: number; confidence: number }> = {
    'low_level_critical': { impact: 9, urgency: 9, confidence: 9 },  // 94 → CRITICAL
    'low_level_warning': { impact: 6, urgency: 7, confidence: 8 },  // 68 → WATCH
    'leak_detected': { impact: 8, urgency: 7, confidence: 8 },     // 77 → HIGH
    'overfill': { impact: 8, urgency: 9, confidence: 9 },   // 87 → HIGH
    'sensor_failure': { impact: 7, urgency: 8, confidence: 6 },   // 73 → HIGH
    'telemetry_gap': { impact: 5, urgency: 6, confidence: 7 },   // 55 → WATCH
    'delivery_variance': { impact: 7, urgency: 5, confidence: 8 },   // 63 → WATCH
    'high_temperature': { impact: 6, urgency: 7, confidence: 8 },   // 68 → WATCH
    'connectivity_lost': { impact: 5, urgency: 7, confidence: 9 },   // 62 → WATCH
    'night_drawdown': { impact: 8, urgency: 7, confidence: 6 },   // 76 → HIGH
    'compliance_deadline': { impact: 6, urgency: 8, confidence: 9 },   // 72 → HIGH
    'composite_supply_risk': { impact: 9, urgency: 8, confidence: 7 },   // 84 → HIGH
    'refill_detected': { impact: 2, urgency: 3, confidence: 9 },   // 25 → INFO
    'unauthorized_refill': { impact: 9, urgency: 10, confidence: 9 }, // 94 → CRITICAL
    'theft_detected': { impact: 10, urgency: 10, confidence: 9 },  // 97 → CRITICAL
    'anomaly': { impact: 7, urgency: 8, confidence: 7 },           // 72 → HIGH
    'info': { impact: 2, urgency: 2, confidence: 9 },              // 22 → INFO
};

/**
 * Score an alert based on its trigger type using the pre-built profiles.
 * Falls back to conservative defaults if the type is unknown.
 */
export function scoreByType(alertType: string, overrideConfidence?: number): {
    score: number;
    label: AlertSeverityLabel;
    impact: number;
    urgency: number;
    confidence: number;
} {
    const profile = TRIGGER_PROFILES[alertType] ?? { impact: 4, urgency: 4, confidence: 5 };
    const confidence = overrideConfidence !== undefined
        ? Math.round(overrideConfidence * 10)
        : profile.confidence;

    const score = calculateScore(profile.impact, profile.urgency, confidence);
    const label = classifyScore(score);
    return { score, label, impact: profile.impact, urgency: profile.urgency, confidence };
}
