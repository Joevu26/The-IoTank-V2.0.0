import { Tank, TankReading } from '@/types';

/**
 * Calculate aggregated metrics across all tanks in the fleet
 */
export function calculateFleetMetrics(tanks: Tank[], readings: Map<string, TankReading | null>) {
    let totalVolume = 0;
    let totalCapacity = 0;
    const totalConsumptionRate = 0;
    let activeTanks = 0;
    let criticalTanks = 0;
    let lowTanks = 0;

    tanks.forEach(tank => {
        const reading = readings.get(tank.id);
        if (reading) {
            totalVolume += reading.volumeCorrected;
            totalCapacity += tank.capacity;
            activeTanks++;

            // Count tanks by status
            if (reading.fuelLevel <= tank.criticalLevelThreshold) {
                criticalTanks++;
            } else if (reading.fuelLevel <= tank.lowLevelThreshold) {
                lowTanks++;
            }
        }
    });

    const averageFillPercentage = totalCapacity > 0 ? (totalVolume / totalCapacity) * 100 : 0;

    return {
        totalVolume,
        totalCapacity,
        averageFillPercentage,
        totalConsumptionRate,
        activeTanks,
        criticalTanks,
        lowTanks,
        okTanks: activeTanks - criticalTanks - lowTanks
    };
}

/**
 * Calculate total inventory value across all tanks
 */
export function calculateInventoryValue(
    tanks: Tank[],
    readings: Map<string, TankReading | null>,
    pricePerLiter: number
): number {
    let totalValue = 0;

    tanks.forEach(tank => {
        const reading = readings.get(tank.id);
        if (reading) {
            totalValue += reading.volumeCorrected * pricePerLiter;
        }
    });

    return totalValue;
}

/**
 * Analyze consumption trend based on historical data
 */
export function getConsumptionTrend(readings: TankReading[]): {
    trend: 'increasing' | 'decreasing' | 'stable';
    rate: number;
    confidence: number;
} {
    if (readings.length < 2) {
        return { trend: 'stable', rate: 0, confidence: 0 };
    }

    const sorted = [...readings].sort((a, b) => a.timestamp - b.timestamp);
    const latest = sorted[sorted.length - 1];
    const oldest = sorted[0];

    const hourDiff = (latest.timestamp - oldest.timestamp) / (1000 * 60 * 60);
    const volumeDiff = oldest.volumeCorrected - latest.volumeCorrected;
    const rate = hourDiff > 0 ? volumeDiff / hourDiff : 0;

    // Calculate variance for confidence
    const rates: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
        const timeDiff = (sorted[i].timestamp - sorted[i - 1].timestamp) / (1000 * 60 * 60);
        const volDiff = sorted[i - 1].volumeCorrected - sorted[i].volumeCorrected;
        if (timeDiff > 0) {
            rates.push(volDiff / timeDiff);
        }
    }

    const variance = rates.length > 1 ? calculateVariance(rates) : 0;
    const confidence = Math.max(0, Math.min(100, 100 - (variance * 10)));

    const trend = rate > 0.5 ? 'decreasing' : rate < -0.5 ? 'increasing' : 'stable';

    return { trend, rate: Math.abs(rate), confidence };
}

/**
 * Calculate confidence band for time-to-empty prediction
 */
export function getConfidenceBand(
    currentRate: number,
    historicalRates: number[]
): { lower: number; upper: number; confidence: number } {
    if (historicalRates.length < 2) {
        return { lower: currentRate * 0.8, upper: currentRate * 1.2, confidence: 50 };
    }

    const stdDev = calculateStandardDeviation(historicalRates);
    const confidence = Math.max(0, Math.min(100, 100 - (stdDev / currentRate) * 50));

    return {
        lower: Math.max(0, currentRate - stdDev),
        upper: currentRate + stdDev,
        confidence
    };
}

/**
 * Format time-to-empty in human-readable format
 */
export function formatTimeToEmpty(hours: number): string {
    if (hours <= 0) return 'Refill Required';
    if (hours < 1) return `${Math.round(hours * 60)} minutes`;
    if (hours < 24) return `${hours.toFixed(1)} hours`;
    if (hours < 168) return `${(hours / 24).toFixed(1)} days`;
    return `${(hours / 168).toFixed(1)} weeks`;
}

/**
 * Calculate rolling average consumption rate
 */
export function calculateRollingAverage(
    readings: TankReading[],
    windowHours: number
): number {
    const now = Date.now();
    const windowStart = now - (windowHours * 60 * 60 * 1000);

    const windowReadings = readings.filter(r => r.timestamp >= windowStart);

    if (windowReadings.length < 2) return 0;

    const sorted = [...windowReadings].sort((a, b) => a.timestamp - b.timestamp);
    const oldest = sorted[0];
    const latest = sorted[sorted.length - 1];

    const hourDiff = (latest.timestamp - oldest.timestamp) / (1000 * 60 * 60);
    const volumeDiff = oldest.volumeCorrected - latest.volumeCorrected;

    return hourDiff > 0 ? Math.max(0, volumeDiff / hourDiff) : 0;
}

/**
 * Get status label and class based on fuel level
 */
export function getFuelStatus(
    fuelLevel: number,
    tank: Tank
): { label: string; className: string; severity: 'ok' | 'warning' | 'critical' } {
    if (fuelLevel <= tank.criticalLevelThreshold) {
        return { label: 'CRITICAL', className: 'status-critical', severity: 'critical' };
    } else if (fuelLevel <= tank.lowLevelThreshold) {
        return { label: 'LOW', className: 'status-warning', severity: 'warning' };
    }
    return { label: 'OK', className: 'status-ok', severity: 'ok' };
}

// Helper functions
function calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
}

function calculateStandardDeviation(values: number[]): number {
    return Math.sqrt(calculateVariance(values));
}
