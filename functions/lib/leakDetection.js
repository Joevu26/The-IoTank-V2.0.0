"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectLeaks = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const supabase_1 = require("./supabase");
/**
 * Scheduled Leak Detection Analysis
 * Runs periodically to analyze stable periods (e.g., night time) for unexplained volume loss.
 */
exports.detectLeaks = functions.pubsub
    .schedule('every 4 hours')
    .onRun(async (context) => {
    console.log('Starting Leak Detection Cycle...');
    // Fetch all tanks from Supabase
    const { data: tanks, error: tanksError } = await supabase_1.supabase
        .from('tanks')
        .select('*');
    if (tanksError || !tanks) {
        console.error('Failed to fetch tanks for leak detection:', tanksError);
        return;
    }
    for (const tank of tanks) {
        await analyzeTankForLeaks(tank);
    }
    console.log('Leak Detection Cycle Completed.');
});
async function analyzeTankForLeaks(tank) {
    const tankId = tank.id;
    // Skip if tank is flagged as 'filling' or 'dispensing' active
    if (tank.status !== 'idle')
        return;
    // Get last 2 hours of readings from Supabase
    const twoHoursAgo = new Date(Date.now() - (2 * 60 * 60 * 1000)).toISOString();
    const { data: readingsData, error: readingsError } = await supabase_1.supabase
        .from('tank_readings')
        .select('ambient_volume, timestamp')
        .eq('tank_id', tankId)
        .gt('timestamp', twoHoursAgo)
        .order('timestamp', { ascending: true });
    if (readingsError || !readingsData || readingsData.length < 10)
        return; // Not enough data
    const readings = readingsData.map(d => d.ambient_volume);
    // 1. Calculate Linear Regression Slope (Rate of Change)
    const slope = calculateSlope(readings);
    // 2. Threshold Check
    const LEAK_THRESHOLD_L_PER_STEP = -0.5; // Unexplained drop of >0.5L per interval
    if (slope < LEAK_THRESHOLD_L_PER_STEP) {
        console.warn(`Potential Leak Detected in Tank ${tankId}: Slope ${slope}`);
        // Create Alert in Supabase
        const { error: alertError } = await supabase_1.supabase.from('alerts').insert({
            tank_id: tankId,
            type: 'leak_warning',
            severity: 'critical',
            title: 'Unexplained inventory loss detected',
            message: `Rate: ${slope.toFixed(4)} L/interval. Check for leaks.`,
            status: 'active',
            data: { slope, readingsCount: readings.length }
        });
        if (alertError) {
            console.error('Failed to create leak alert:', alertError);
        }
        // Update Tank Status in Supabase
        const { error: updateError } = await supabase_1.supabase.from('tanks').update({
            has_active_leak_alert: true,
            leak_confidence: 0.85 // High confidence due to sustained drop
        }).eq('id', tankId);
        if (updateError) {
            console.error('Failed to update tank leak status:', updateError);
        }
    }
}
/**
 * Simple Linear Regression to find slope
 */
function calculateSlope(values) {
    const n = values.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += values[i];
        sumXY += i * values[i];
        sumXX += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
}
//# sourceMappingURL=leakDetection.js.map