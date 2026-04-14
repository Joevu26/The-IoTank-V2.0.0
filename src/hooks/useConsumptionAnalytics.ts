import { useMemo, useEffect, useState } from 'react';
import { Tank, TankReading } from '@/types';
import { differenceInHours } from 'date-fns';
import { useTelemetryQueue } from '@/contexts/TelemetryQueueContext';
import { useShiftStatus } from './useShiftStatus';
import { supabase } from '@/config/supabase';

export function useConsumptionAnalytics(tank: Tank, readings: TankReading[]) {
    const { pushEvent } = useTelemetryQueue();
    const { openedAt, status: shiftStatus } = useShiftStatus();
    const [avgDailyRate, setAvgDailyRate] = useState<number>(0);

    // Fetch Last 7 Days Average Dispense Rate
    useEffect(() => {
        const fetchHistoricalAverage = async () => {
            if (!tank.id) return;
            
            try {
                // Get last 7 shift closures for this tank
                const { data, error } = await supabase
                    .from('shift_closures')
                    .select('volume_sold_liters, opened_at, closed_at')
                    .eq('tank_id', tank.id)
                    .order('closed_at', { ascending: false })
                    .limit(7);

                if (error) throw error;

                if (data && data.length > 0) {
                    // Calculate individual daily rates (L/hr) and average them
                    const rates = data.map(shift => {
                        const duration = Math.max(0.5, differenceInHours(new Date(shift.closed_at), new Date(shift.opened_at)));
                        return (Number(shift.volume_sold_liters) || 0) / duration;
                    });
                    const avg = rates.reduce((acc, r) => acc + r, 0) / rates.length;
                    setAvgDailyRate(avg);
                } else {
                    // Fallback to a default if no history exists (e.g. 10 L/hr)
                    setAvgDailyRate(5); 
                }
            } catch (err) {
                console.warn('Failed to fetch historical average:', err);
            }
        };

        fetchHistoricalAverage();
    }, [tank.id]);

    const analytics = useMemo(() => {
        try {
            if (readings.length < 2 || !tank || !tank.capacity) {
                return {
                    defillRate: 0,
                    ete: 'Calculating...',
                    predictedRefillDate: null,
                    isTheftSuspected: false,
                    isLeakageSuspected: false,
                    trend: 'stable' as 'stable' | 'decreasing' | 'increasing',
                    error: null
                };
            }

            const sorted = [...readings].sort((a, b) => b.timestamp - a.timestamp);
            const latest = sorted[0];
            const latestVolume = latest.volumeCorrected ?? latest.volume ?? 0;

            // 1. Current Shift Dispense Rate (Rate of Change)
            let currentShiftRate = 0;
            if (shiftStatus === 'open' && openedAt) {
                const shiftStartVolumes = JSON.parse(localStorage.getItem('iotank_shift_start_volumes') || '{}');
                const startVol = shiftStartVolumes[tank.id] || latestVolume;
                const hrsPassed = Math.max(0.1, (Date.now() - openedAt) / (1000 * 60 * 60));
                currentShiftRate = Math.max(0, (startVol - latestVolume) / hrsPassed);
            } else {
                // If shift is closed, use a short-term 2-hour window for the "Display Rate"
                const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
                const relevant = sorted.filter(r => r.timestamp >= twoHoursAgo);
                if (relevant.length >= 2) {
                    const oldestInWindow = relevant[relevant.length - 1];
                    const volDiff = (oldestInWindow.volumeCorrected || oldestInWindow.volume || 0) - latestVolume;
                    const timeDiff = Math.max(0.1, (latest.timestamp - oldestInWindow.timestamp) / (1000 * 60 * 60));
                    currentShiftRate = Math.max(0, volDiff / timeDiff);
                }
            }

            // 2. ETE Calculation using Average Dispense Rate
            // ETE = (Current Inventory - Dead Stock) / Avg Dispense Rate
            // Dead Stock = 5% of capacity
            const deadStock = tank.capacity * 0.05;
            const usableVolume = Math.max(0, latestVolume - deadStock);
            
            // Use the higher of current rate or historical average to be conservative, 
            // or just the historical average as requested.
            // "so ETE doesnt use Dispense rate but Average Dispense Rate"
            const effectiveRate = avgDailyRate || currentShiftRate || 0.1; 

            let ete = 'Stable';
            let predictedRefillDate: number | null = null;

            if (effectiveRate > 0) {
                const hoursLeft = usableVolume / effectiveRate;
                if (hoursLeft > 0) {
                    predictedRefillDate = latest.timestamp + (hoursLeft * 60 * 60 * 1000);
                    if (hoursLeft > 24) {
                        ete = `${(hoursLeft / 24).toFixed(1)} Days`;
                    } else {
                        ete = `${hoursLeft.toFixed(1)} Hours`;
                    }
                }
            }

            const trend = currentShiftRate > 0.5 ? 'decreasing' : currentShiftRate < -0.5 ? 'increasing' : 'stable';

            return {
                defillRate: currentShiftRate, // This is the "Dispense Rate" shown in UI
                ete,
                predictedRefillDate,
                isTheftSuspected: currentShiftRate > (tank.rapidDefillThreshold || 50),
                isLeakageSuspected: currentShiftRate > (tank.leakageThreshold || 2) && currentShiftRate < 10,
                trend,
                error: null
            };
        } catch (e: any) {
            console.error('Telemetry Analytics Crash:', e);
            return {
                defillRate: 0,
                ete: 'Error',
                predictedRefillDate: null,
                isTheftSuspected: false,
                isLeakageSuspected: false,
                trend: 'stable' as const,
                error: e.message
            };
        }
    }, [tank, readings, shiftStatus, openedAt, avgDailyRate]);

    useEffect(() => {
        if (analytics.error && tank?.name) {
            pushEvent({
                type: 'system_error',
                message: `Analytics failed for ${tank.name}: ${analytics.error}`,
                actionLabel: 'Details',
                onAction: () => alert(`Error processing ${readings.length} readings for ${tank.name}.`)
            });
        }
    }, [analytics.error, tank?.name, readings.length, pushEvent]);

    return analytics;
}

