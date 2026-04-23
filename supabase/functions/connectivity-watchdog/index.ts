import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.40.0"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    // CRIT-001: Authenticate caller — must be pg_cron (CRON_SECRET) or a service-role call
    const authHeader = req.headers.get('Authorization') || '';
    const cronSecret   = Deno.env.get('CRON_SECRET') || '';
    const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const isAuthorized =
        (cronSecret  && authHeader === `Bearer ${cronSecret}`) ||
        (serviceKey  && authHeader === `Bearer ${serviceKey}`);

    if (!isAuthorized) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') || '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );

        console.log('[Watchdog] Starting connectivity integrity check...');
        const INACTIVITY_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

        const { data: tanks, error: tanksError } = await supabase.from('tanks').select('*');
        if (tanksError || !tanks) throw tanksError;

        for (const tank of tanks) {
            if (!tank.esp32_address) continue;

            const now = Date.now();
            const lastUpdate = tank.last_reading_at ? new Date(tank.last_reading_at).getTime() : 0;

            if (now - lastUpdate > INACTIVITY_THRESHOLD_MS) {
                // Check for existing active alert
                const { data: existingAlerts } = await supabase
                    .from('alerts')
                    .select('id')
                    .eq('tank_id', tank.id)
                    .eq('type', 'connectivity-lost')
                    .eq('status', 'active');

                if (!existingAlerts || existingAlerts.length === 0) {
                    await supabase.from('alerts').insert({
                        type: 'connectivity-lost',
                        severity: 'critical',
                        title: 'Sensor Offline',
                        message: `Tank "${tank.name}" has not reported data for over 1 hour. Check power and link stability.`,
                        tank_id: tank.id,
                        status: 'active'
                    });
                    console.log(`[Watchdog] Offline alert triggered for Tank: ${tank.id}`);
                }
            }
        }

        return new Response(JSON.stringify({ status: 'Connectivity watchdog cycle completed' }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });

    } catch (error) {
        console.error('[Watchdog] Error:', error.message);
        return new Response(JSON.stringify({ error: error.message }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
        });
    }
})
