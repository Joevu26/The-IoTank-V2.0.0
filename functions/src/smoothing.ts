import * as functions from 'firebase-functions/v1';
import { supabase } from './supabase';

/**
 * Implements a simplified 1-Dimensional Kalman Filter for sensor data smoothing.
 * 
 * @param z - Measured value (noisy)
 * @param x_est_prev - Previous estimated state
 * @param P_prev - Previous estimated error covariance
 * @param Q - Process noise covariance (tune this)
 * @param R - Measurement noise covariance (tune this)
 * @returns { x_est, P } - New state estimate and new error covariance
 */
export function kalmanFilter(z: number, x_est_prev: number, P_prev: number, Q: number = 0.01, R: number = 0.1) {
    // Prediction Step
    const x_pred = x_est_prev;
    const P_pred = P_prev + Q;

    // Update Step
    const K = P_pred / (P_pred + R); // Kalman Gain
    const x_est = x_pred + K * (z - x_pred);
    const P = (1 - K) * P_pred;

    return { x_est, P };
}

/**
 * HTTP Function Trigger (to be called via Supabase Webhook)
 * Processes raw tank readings and calculates a 'smoothed' value.
 */
export const smoothreadings = functions.https.onRequest(async (req, res) => {
    // 1. Security check: Verify secret token from Supabase Webhook header
    const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;
    const incomingSecret = req.headers['x-supabase-webhook-secret'];

    if (!webhookSecret || incomingSecret !== webhookSecret) {
        console.error('[Smoothing] Unauthorized access attempt or missing SUPABASE_WEBHOOK_SECRET env var.');
        res.status(401).send('Unauthorized');
        return;
    }

    // 2. Basic verification of incoming data
    const { record } = req.body; // Supabase Webhook body format
    if (!record || typeof record.ambient_volume !== 'number') {
        res.status(400).send('Invalid record format');
        return;
    }

    const { tank_id, ambient_volume, timestamp } = record;

    try {
        // Fetch current tank state for filter
        const { data: tank, error: tankError } = await supabase
            .from('tanks')
            .select('last_smoothed_level, filter_covariance, outlier_count')
            .eq('id', tank_id)
            .single();

        if (tankError || !tank) throw new Error(`Tank ${tank_id} not found`);

        const prevEstimate = tank.last_smoothed_level || ambient_volume;
        const prevCovariance = tank.filter_covariance || 1.0;

        // --- Outlier Rejection Layer ---
        const deviation = Math.abs(ambient_volume - prevEstimate);
        
        // REFILL-AWARE LOGIC: 
        // 1. If volume INCREASES (Fuel INCREASE/Refill), we allow larger jumps
        //    because refills are typically fast but valid.
        // 2. If volume DECREASES (Fuel DECREASE/Usage), we remain strict
        //    to catch sensor noise/jitter.
        // 3. Absolute minimum floor of 15L to prevent lock-up.
        const isRefill = ambient_volume > prevEstimate; 
        const outlierThreshold = isRefill ? (0.8 * prevEstimate) : (0.3 * prevEstimate);
        const minDeviationFloor = 15; // Litres

        if (tank.last_smoothed_level !== undefined && deviation > outlierThreshold && deviation > minDeviationFloor) {
            console.warn(`[Smoothing] Outlier rejected for Tank ${tank_id}: ${ambient_volume} vs prev ${prevEstimate} (Refill: ${isRefill}).`);
            
            // If we get 5 outliers in a row, the sensor might have shifted - reset the filter
            const newOutlierCount = (tank.outlier_count || 0) + 1;
            const updatePayload: any = {
                last_reading_at: timestamp,
                outlier_count: newOutlierCount
            };

            if (newOutlierCount >= 5) {
                console.log(`[Smoothing] Too many outliers (${newOutlierCount}). Resetting filter for Tank ${tank_id}.`);
                updatePayload.last_smoothed_level = ambient_volume;
                updatePayload.filter_covariance = 1.0;
                updatePayload.outlier_count = 0;
            }

            await supabase.from('tanks').update(updatePayload).eq('id', tank_id);
            res.status(200).send(newOutlierCount >= 5 ? 'Filter reset after multiple outliers' : 'Outlier detected and logged');
            return;
        }

        // Apply Kalman Filter
        const { x_est: newSmoothedLevel, P: newCovariance } = kalmanFilter(
            ambient_volume,
            prevEstimate,
            prevCovariance,
            0.01, // Process noise
            0.5   // Measurement noise
        );

        // Update Tank State in Supabase
        const { error: updateError } = await supabase
            .from('tanks')
            .update({
                last_smoothed_level: newSmoothedLevel,
                filter_covariance: newCovariance,
                last_reading_at: timestamp,
                current_level: newSmoothedLevel, // UI reflects smoothed level
                outlier_count: 0 // Reset on valid reading
            })
            .eq('id', tank_id);

        if (updateError) throw updateError;

        res.status(200).send('Smoothed reading updated in Supabase');
    } catch (error) {
        console.error('Error in smoothreadings:', error);
        res.status(500).send('Internal Server Error');
    }
});
