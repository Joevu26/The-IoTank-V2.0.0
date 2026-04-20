import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.40.0"
import { corsHeaders } from "../_shared/cors.ts"

/**
 * Simple Linear Regression to find volume slope.
 */
function calculateSlope(values: number[]): number {
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += values[i];
        sumXY += i * values[i];
        sumXX += i * i;
    }
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') || '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );

        console.log('[LeakDetection] Starting forensic analysis cycle...');
        
        const { data: tanks, error: tanksError } = await supabase.from('tanks').select('*');
        if (tanksError || !tanks) throw tanksError;

        for (const tank of tanks) {
            // Only analyze idle tanks to prevent noise from active pumping
            if (tank.status !== 'idle') continue;

            const twoHoursAgo = new Date(Date.now() - (2 * 60 * 60 * 1000)).toISOString();
        const { data: readingsData, error: readingsError } = await supabase
                .from('sensor_readings')
                .select('volume')
                .eq('tank_id', tank.id)
                .gt('timestamp', twoHoursAgo)
                .order('timestamp', { ascending: true });

            if (readingsError || !readingsData || readingsData.length < 10) continue;

            const readings = readingsData.map(d => d.volume as number);
            const slope = calculateSlope(readings);
            const LEAK_THRESHOLD = -0.5; // >0.5L drop per internal interval

            if (slope < LEAK_THRESHOLD) {
                console.warn(`[LeakDetection] Potential leak in Tank ${tank.id}: slope ${slope}`);

                // 🚨 Create Alert
                await supabase.from('alerts').insert({
                    tank_id: tank.id,
                    type: 'leak_warning',
                    severity: 'critical',
                    title: 'Unexplained inventory loss detected',
                    message: `Forensic slope analysis indicates sustained loss of ${Math.abs(slope).toFixed(4)} L/interval.`,
                    status: 'active',
                    metadata: { slope, readingsCount: readings.length }
                });

                // 🛠️ Update Tank Status
                await supabase.from('tanks').update({
                    has_active_leak_alert: true,
                    leak_confidence: 0.85 
                }).eq('id', tank.id);
            }
        }

        return new Response(JSON.stringify({ status: 'Leak detection cycle completed' }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });

    } catch (error) {
        console.error('[LeakDetection] Error:', error.message);
        return new Response(JSON.stringify({ error: error.message }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
        });
    }
})
