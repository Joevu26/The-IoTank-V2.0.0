import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.40.0"
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdminOrCron } from "../_shared/auth.ts"
import { calculateTimeBasedSlope } from "../_shared/algorithms.ts"

declare const Deno: any;

serve(async (req) => {
    const corsHeaders = getCorsHeaders(req.headers.get('origin'));
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    // CRIT-001: Authenticate caller using shared helper
    const auth = await requireAdminOrCron(req, corsHeaders);
    if ('response' in auth) return auth.response;
    const { supabaseAdmin: supabase } = auth;

    try {
        console.log('[AlertEngine] Starting global heuristic scan...');
        
        // 1. Fetch active tanks and their station contact emails
        const { data: tanks, error: tanksError } = await supabase
            .from('tanks')
            .select(`
                *,
                station:client_billing(email, station_name)
            `);

        if (tanksError || !tanks) throw tanksError;

        const results = [];

        // 2. Process tanks in concurrent chunks to prevent edge function timeouts
        const chunkSize = 10;
        for (let i = 0; i < tanks.length; i += chunkSize) {
            const chunk = tanks.slice(i, i + chunkSize);
            
            const chunkPromises = chunk.map(async (tank) => {
                const stationEmail = (tank as any).station?.email || 'admin@iotank.com';
                const stationName = (tank as any).station?.station_name || tank.tank_name;
                const tankReport: any = { tank_id: tank.id, name: tank.tank_name, incidents: [] };
                
                // 3. Connectivity Check (Unified logic from watchdog)
                const thirtyMinAgo = new Date(Date.now() - (30 * 60 * 1000)).toISOString();

                const { data: lastReading } = await supabase
                    .from('sensor_readings')
                    .select('*')
                    .eq('tank_id', tank.id)
                    .order('timestamp', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (!lastReading || new Date(lastReading.timestamp) < new Date(thirtyMinAgo)) {
                    const gapMs = lastReading ? (Date.now() - new Date(lastReading.timestamp).getTime()) : Infinity;
                    const isCritical = gapMs > (60 * 60 * 1000); // 1 Hour Threshold

                    tankReport.incidents.push({
                        type: 'connectivity_lost',
                        severity: isCritical ? 'critical' : 'warning',
                        title: isCritical ? 'CRITICAL: Sensor Offline' : 'Telemetry Connection Lost',
                        message: isCritical 
                            ? `Tank "${tank.tank_name}" has been unreachable for over 1 hour. Immediate physical inspection required.`
                            : `Station node has not reported data since ${lastReading ? new Date(lastReading.timestamp).toLocaleTimeString() : 'Unknown'}.`
                    });
                }

                // 4. Inventory Level Breaches (Low/Overfill)
                if (lastReading) {
                    const percentage = (lastReading.volume / tank.tank_capacity) * 100;
                    
                    if (percentage < 15) {
                        tankReport.incidents.push({
                            type: 'low_level',
                            severity: 'critical',
                            title: 'Critical Inventory Breach',
                            message: `Stock level fell below 15% safety threshold. Current: ${lastReading.volume.toFixed(0)}L (${percentage.toFixed(1)}%).`
                        });
                    } else if (percentage > 98) {
                        tankReport.incidents.push({
                            type: 'overfill',
                            severity: 'warning',
                            title: 'Storage Capacity Alert',
                            message: `Near-max capacity detected. Current: ${percentage.toFixed(1)}%. Suspend deliveries immediately.`
                        });
                    }
                }

                // 5. Slope Analysis (Leak / Theft)
                const twoHoursAgo = new Date(Date.now() - (2 * 60 * 60 * 1000)).toISOString();
                const { data: trendData } = await supabase
                    .from('sensor_readings')
                    .select('volume, timestamp')
                    .eq('tank_id', tank.id)
                    .gt('timestamp', twoHoursAgo)
                    .order('timestamp', { ascending: true });

                if (trendData && trendData.length > 5) {
                    const points = trendData.map(d => ({
                        x: new Date(d.timestamp).getTime(),
                        y: d.volume as number
                    }));

                    const slopeLhr = calculateTimeBasedSlope(points);
                    
                    // If loss is > 30L/hr and sustained
                    if (slopeLhr < -30) {
                        tankReport.incidents.push({
                            type: 'theft_detected',
                            severity: 'critical',
                            title: 'Forensic Theft Detected',
                            message: `Unexplained rapid volume loss of ${Math.abs(slopeLhr).toFixed(1)}L/hr detected during idle window.`
                        });
                    }
                }

                // 6. Commit Alerts to Database
                for (const incident of tankReport.incidents) {
                    const { count } = await supabase
                        .from('alerts')
                        .select('*', { count: 'exact', head: true })
                        .eq('tank_id', tank.id)
                        .eq('alert_type', incident.type)
                        .eq('is_resolved', false);

                    if (count === 0) {
                        await supabase.from('alerts').insert({
                            station_id: tank.station_id,
                            tank_id: tank.id,
                            alert_type: incident.type,
                            severity: incident.severity,
                            title: incident.title,
                            message: incident.message,
                            metadata: { source: 'ServerEngine', timestamp: new Date().toISOString() }
                        });
                        
                        if (incident.severity === 'critical') {
                            const DISPATCH_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/dispatch-critical-alerts`;
                            await fetch(DISPATCH_URL, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    action: 'direct_security_alert',
                                    to: stationEmail,
                                    params: {
                                        type: incident.title,
                                        siteName: stationName,
                                        details: { description: incident.message, timestamp: new Date().toISOString() }
                                    }
                                })
                            }).catch(e => console.error('[AlertEngine] Dispatch trigger failed:', e));
                        }
                    }
                }
                return tankReport;
            });

            const chunkResults = await Promise.allSettled(chunkPromises);
            for (const res of chunkResults) {
                if (res.status === 'fulfilled') results.push(res.value);
            }
        }

        return new Response(JSON.stringify({ 
            status: 'success', 
            tanks_processed: tanks.length,
            cycle_at: new Date().toISOString() 
        }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });

    } catch (error) {
        console.error('[AlertEngine] Error:', error.message);
        return new Response(JSON.stringify({ error: error.message }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
        });
    }
})
