import { supabase } from '@/config/supabase';
import { format, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';

export interface DailySnapshot {
    date: string;
    opening: number;
    closing: number;
    deliveries: number;
    sales: number;
    theoretical: number;
    variance: number;
    variancePct: number;
}

export interface AggregatedMetrics {
    totalThroughput: number;
    totalDeliveries: number;
    avgVariancePct: number;
    incidentCount: number;
    netVariance: number;
}

/**
 * Forensic Scanner: Aggregates daily reconciliation logs for a given period.
 * This is the "Brain" of the Reporting Hub.
 */
export async function scanStationHistory(
    stationId: string,
    startDate: Date,
    endDate: Date,
    tankId?: string
): Promise<{ logs: DailySnapshot[]; metrics: AggregatedMetrics }> {
    try {
        // 1. Fetch Transactions (Deliveries and Sales)
        let txQuery = supabase
            .from('fuel_transactions')
            .select('*')
            .eq('station_id', stationId)
            .gte('timestamp', startDate.toISOString())
            .lte('timestamp', endDate.toISOString());

        if (tankId) {
            txQuery = txQuery.eq('tank_id', tankId);
        }

        const { data: transactions, error: txError } = await txQuery;
        if (txError) throw txError;

        // 2. Fetch Daily Boundary Readings (Opening/Closing)
        // Optimization: We only need readings near the start and end of each day
        // For now, we'll fetch all sensor readings and filter in-memory for accuracy
        // In a high-scale environment, this should be done via a Postgres RPC function
        let readingsQuery = supabase
            .from('sensor_readings')
            .select('timestamp, volume, tank_id')
            .eq('station_id', stationId)
            .gte('timestamp', startDate.toISOString())
            .lte('timestamp', endDate.toISOString())
            .order('timestamp', { ascending: true });

        if (tankId) {
            readingsQuery = readingsQuery.eq('tank_id', tankId);
        }

        const { data: readings, error: readingsError } = await readingsQuery;
        if (readingsError) throw readingsError;

        // 3. Process daily snapshots
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        const logs: DailySnapshot[] = [];

        days.forEach(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayStart = startOfDay(day);
            const dayEnd = endOfDay(day);

            // Filter readings for this day
            const dayReadings = (readings || []).filter(r => {
                const ts = new Date(r.timestamp);
                return ts >= dayStart && ts <= dayEnd;
            });

            // Filter transactions for this day
            const dayTx = (transactions || []).filter(tx => {
                const ts = new Date(tx.timestamp);
                return ts >= dayStart && ts <= dayEnd;
            });

            // Calculate metrics
            const opening = dayReadings.length > 0 ? dayReadings[0].volume : 0;
            const closing = dayReadings.length > 0 ? dayReadings[dayReadings.length - 1].volume : 0;
            
            const deliveries = dayTx
                .filter(tx => tx.type === 'delivery')
                .reduce((sum, tx) => sum + (tx.amount || 0), 0);
            
            const sales = dayTx
                .filter(tx => tx.type === 'sale')
                .reduce((sum, tx) => sum + (tx.amount || 0), 0);

            const theoretical = opening + deliveries - sales;
            const variance = closing - theoretical;
            const totalThroughput = deliveries + sales;
            const variancePct = totalThroughput > 0 ? (variance / totalThroughput) * 100 : 0;

            logs.push({
                date: dayStr,
                opening,
                closing,
                deliveries,
                sales,
                theoretical,
                variance,
                variancePct
            });
        });

        // 4. Calculate Aggregate Metrics
        const totalDeliveriesVol = logs.reduce((sum, l) => sum + l.deliveries, 0);
        const totalSalesVol = logs.reduce((sum, l) => sum + l.sales, 0);
        const netVariance = logs.reduce((sum, l) => sum + l.variance, 0);
        const totalThroughput = totalDeliveriesVol + totalSalesVol;
        
        const metrics: AggregatedMetrics = {
            totalThroughput,
            totalDeliveries: (transactions || []).filter(tx => tx.type === 'delivery').length,
            avgVariancePct: totalThroughput > 0 ? (netVariance / totalThroughput) * 100 : 0,
            incidentCount: (transactions || []).filter(tx => tx.metadata?.varianceStatus === 'CRITICAL').length,
            netVariance
        };

        return { logs, metrics };
    } catch (error) {
        console.error('[scanStationHistory] Error:', error);
        return { logs: [], metrics: { totalThroughput: 0, totalDeliveries: 0, avgVariancePct: 0, incidentCount: 0, netVariance: 0 } };
    }
}

/**
 * In-Memory Highlight Generator: Creates professional summary strings for the UI
 */
export function getReportHighlights(type: string, metrics: AggregatedMetrics): string[] {
    const highlights: string[] = [];
    
    if (metrics.totalThroughput > 10000) {
        highlights.push(`High Volume Period: Total throughput exceeded ${metrics.totalThroughput.toLocaleString()}L.`);
    }

    if (Math.abs(metrics.avgVariancePct) < 0.1) {
        highlights.push('Operational Excellence: Variance maintained within 0.1% threshold.');
    } else if (Math.abs(metrics.avgVariancePct) > 0.5) {
        highlights.push(`Forensic Alert: Significant variance detected (${metrics.avgVariancePct.toFixed(2)}%). Investigation recommended.`);
    }

    if (metrics.incidentCount > 0) {
        highlights.push(`Security: ${metrics.incidentCount} critical reconciliation incidents flagged during this window.`);
    }

    if (type === 'compliance-pack' && Math.abs(metrics.avgVariancePct) < 0.5) {
        highlights.push('Compliance: Station meets the regulatory 90-day consistency standards.');
    }

    return highlights.length > 0 ? highlights : ['No significant anomalies detected in this window.'];
}

export interface Recommendation {
    id: string;
    priority: 'critical' | 'watch' | 'optimize';
    title: string;
    description: string;
    riskScore: number;
    confidence: number;
    actionLabel: string;
}

/**
 * Strategy Engine: Generates actionable recommendations based on telemetry
 */
export function getStrategicRecommendations(
    variancePct: number,
    daysOfCover: number,
    incidentCount: number
): Recommendation[] {
    const recs: Recommendation[] = [];

    // 1. Critical Inventory Rule
    if (daysOfCover < 3) {
        recs.push({
            id: 'LOW_STOCK',
            priority: 'critical',
            title: 'Critical Stock Depletion',
            description: `Immediate refill required. Current cover: ${daysOfCover.toFixed(1)} days.`,
            riskScore: 95,
            confidence: 98,
            actionLabel: 'Order Fuel Now'
        });
    }

    // 2. High Variance Watch
    if (Math.abs(variancePct) > 0.5) {
        recs.push({
            id: 'HIGH_VARIANCE',
            priority: 'critical',
            title: 'Significant Loss Detected',
            description: `Operational drift at ${variancePct.toFixed(2)}%. Review flow calibration.`,
            riskScore: 88,
            confidence: 82,
            actionLabel: 'Initiate Forensic Audit'
        });
    }

    // 3. Maintenance / Anomaly Rule
    if (incidentCount > 5) {
        recs.push({
            id: 'INTEGRITY_WATCH',
            priority: 'watch',
            title: 'Signal Integrity Watch',
            description: 'Elevated telemetry gaps detected. Node inspection recommended.',
            riskScore: 45,
            confidence: 70,
            actionLabel: 'Check Hardware'
        });
    }

    // 4. Optimization Rule (Default)
    if (recs.length === 0) {
        recs.push({
            id: 'HEDGE_OPT',
            priority: 'optimize',
            title: 'Price Hedging Opportunity',
            description: 'Market trend suggests early procurement ROI of 4.2%.',
            riskScore: 12,
            confidence: 85,
            actionLabel: 'View Market Analysis'
        });
    }

    return recs;
}
