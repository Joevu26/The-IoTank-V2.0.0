"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyRollup = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const supabase_1 = require("./supabase");
/**
 * Daily Rollup: Summarizes the day's readings into a single document for long-term storage.
 * Runs once a day at midnight (UTC).
 */
exports.dailyRollup = (0, scheduler_1.onSchedule)({ schedule: '0 0 * * *' }, async (event) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const startTime = yesterday.toISOString();
    const endTime = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const dateStr = yesterday.toISOString().split('T')[0];
    try {
        // Fetch all tanks
        const { data: tanks, error: tanksError } = await supabase_1.supabase
            .from('tanks')
            .select('id');
        if (tanksError || !tanks) {
            console.error('[Rollup] Failed to fetch tanks:', tanksError);
            return;
        }
        for (const tank of tanks) {
            const tankId = tank.id;
            // Get all readings for yesterday from Supabase
            const { data: readings, error: readingsError } = await supabase_1.supabase
                .from('tank_readings')
                .select('ambient_volume, temperature')
                .eq('tank_id', tankId)
                .gte('timestamp', startTime)
                .lt('timestamp', endTime);
            if (readingsError || !readings || readings.length === 0)
                continue;
            // Calculate averages
            let sumVol = 0;
            let sumTemp = 0;
            let count = 0;
            readings.forEach(data => {
                if (typeof data.ambient_volume === 'number') {
                    sumVol += data.ambient_volume;
                    if (typeof data.temperature === 'number') {
                        sumTemp += data.temperature;
                    }
                    count++;
                }
            });
            if (count > 0) {
                const avgVol = sumVol / count;
                const avgTemp = sumTemp / count;
                // Store daily summary in Supabase
                const { error: insertError } = await supabase_1.supabase
                    .from('daily_summaries')
                    .upsert({
                    tank_id: tankId,
                    date: dateStr,
                    avg_ambient_volume: avgVol,
                    avg_temperature: avgTemp,
                    reading_count: count,
                    timestamp: startTime
                }, { onConflict: 'tank_id, date' });
                if (insertError) {
                    console.error(`[Rollup] Failed to save summary for Tank ${tankId}:`, insertError);
                }
                else {
                    console.log(`[Rollup] Completed for Tank: ${tankId} (${count} readings aggregated)`);
                }
            }
        }
    }
    catch (error) {
        console.error('[Rollup] Error in daily aggregation:', error);
    }
});
//# sourceMappingURL=rollup.js.map