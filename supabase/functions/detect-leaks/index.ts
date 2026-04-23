import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.40.0"
import { corsHeaders } from "../_shared/cors.ts"
import { requireAdminOrCron } from "../_shared/auth.ts"
import { calculateTimeBasedSlope } from "../_shared/algorithms.ts"

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    // CRIT-001: Authenticate caller using shared helper
    const auth = await requireAdminOrCron(req, corsHeaders);
    if ('response' in auth) return auth.response;
    const { supabaseAdmin: supabase } = auth;

    try {
        console.log('[LeakDetection] Starting forensic analysis cycle...');
        
        const { data: tanks, error: tanksError } = await supabase.from('tanks').select('*');
        if (tanksError || !tanks) throw tanksError;

        for (const tank of tanks) {
            // Only analyze idle tanks to prevent noise from active pumping
            if (tank.status !== 'idle') continue;

            const twoHoursAgo = new Date(Date.now() - (2 * 60 * 60 * 1000)).toISOString();
            const { data: readingsData, error: readingsError } = await supabase
                .from('sensor_readings')
                .select('volume, timestamp')
                .eq('tank_id', tank.id)
                .gt('timestamp', twoHoursAgo)
                .order('timestamp', { ascending: true });

            if (readingsError || !readingsData || readingsData.length < 5) continue;

            const points = readingsData.map(d => ({
                x: new Date(d.timestamp).getTime(),
                y: d.volume as number
            }));

            const slopeLhr = calculateTimeBasedSlope(points);
            const LEAK_THRESHOLD_LHR = -2.0; // 2L per hour loss during idle

            if (slopeLhr < LEAK_THRESHOLD_LHR) {
                console.warn(`[LeakDetection] Potential leak in Tank ${tank.id}: slope ${slopeLhr.toFixed(4)} L/hr`);

                // 🚨 Create Alert (Canonical Naming)
                await supabase.from('alerts').insert({
                    station_id: tank.station_id,
                    tank_id: tank.id,
                    alert_type: 'leak_detected',
                    severity: 'critical',
                    title: 'Forensic Inventory Leak Detected',
                    message: `System identified a sustained loss of ${Math.abs(slopeLhr).toFixed(2)} L/hr during an idle window. Check tank and piping integrity.`,
                    metadata: { slope: slopeLhr, readingsCount: points.length, durationHrs: 2 }
                });

                // 🛠️ Update Tank Status
                await supabase.from('tanks').update({
                    has_active_leak_alert: true,
                    leak_confidence: 0.92 
                }).eq('id', tank.id);
            }
        }

        return new Response(JSON.stringify({ status: 'success' }), { 
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
