"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectivityWatchdog = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const supabase_1 = require("./supabase");
/**
 * Connectivity Watchdog: Runs every 30 minutes to check for silent sensors.
 * If a tank hasn't reported data in > 1 hour, it triggers a critical alert.
 */
exports.connectivityWatchdog = (0, scheduler_1.onSchedule)({ schedule: 'every 30 minutes' }, async (event) => {
    const INACTIVITY_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour in ms
    try {
        // Fetch all tanks from Supabase
        const { data: tanks, error: tanksError } = await supabase_1.supabase
            .from('tanks')
            .select('*');
        if (tanksError || !tanks) {
            console.error('[Watchdog] Failed to fetch tanks:', tanksError);
            return;
        }
        for (const tank of tanks) {
            // Skip tanks that don't have a linked device address
            if (!tank.esp32_address)
                continue;
            const now = Date.now();
            const lastUpdate = tank.last_reading_at ? new Date(tank.last_reading_at).getTime() : 0;
            if (now - lastUpdate > INACTIVITY_THRESHOLD_MS) {
                // Check if an active alert already exists in Supabase to avoid spamming
                const { data: existingAlerts, error: alertCheckError } = await supabase_1.supabase
                    .from('alerts')
                    .select('id')
                    .eq('tank_id', tank.id)
                    .eq('type', 'connectivity-lost')
                    .eq('status', 'active');
                if (alertCheckError) {
                    console.error('[Watchdog] Error checking existing alerts:', alertCheckError);
                    continue;
                }
                if (!existingAlerts || existingAlerts.length === 0) {
                    const { error: insertError } = await supabase_1.supabase.from('alerts').insert({
                        type: 'connectivity-lost',
                        severity: 'critical',
                        title: 'Sensor Offline',
                        message: `Tank "${tank.name}" has not reported data for over 1 hour. Check power and WiFi.`,
                        tank_id: tank.id,
                        status: 'active'
                    });
                    if (insertError) {
                        console.error('[Watchdog] Failed to create offline alert:', insertError);
                    }
                    else {
                        console.log(`[Watchdog] Triggered offline alert for Tank: ${tank.name}`);
                    }
                }
            }
        }
    }
    catch (error) {
        console.error('[Watchdog] Error in connectivity check:', error);
    }
});
//# sourceMappingURL=watchdog.js.map