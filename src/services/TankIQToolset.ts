import { supabase } from '@/config/supabase';

/**
 * TankIQ Toolset
 * Handlers for AI-generated tool calls that interact with Supabase safely.
 */
export const TankIQToolset = {
    /**
     * Fetches basic station status including tanks and active alerts.
     */
    async get_station_summary(stationId: string) {
        try {
            const { data, error } = await supabase.rpc('get_tankiq_station_summary', {
                p_station_id: stationId
            });
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('TankIQ Tool [get_station_summary] Error:', err);
            return { error: 'Failed to fetch station summary.' };
        }
    },

    /**
     * Fetches fuel consumption statistics over a specific period.
     */
    async get_consumption_analytics(stationId: string, parameters: { days?: number }) {
        try {
            const { data, error } = await supabase.rpc('get_tankiq_consumption_stats', {
                p_station_id: stationId,
                p_days: parameters.days || 7
            });
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('TankIQ Tool [get_consumption_analytics] Error:', err);
            return { error: 'Failed to fetch consumption statistics.' };
        }
    },

    /**
     * Fetches recent delivery logs.
     */
    async get_delivery_logs(stationId: string, parameters: { limit?: number }) {
        try {
            const { data, error } = await supabase.rpc('get_tankiq_delivery_logs', {
                p_station_id: stationId,
                p_limit: parameters.limit || 5
            });
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('TankIQ Tool [get_delivery_logs] Error:', err);
            return { error: 'Failed to fetch delivery logs.' };
        }
    },

    /**
     * Fetches market context including EPRA prices and regulatory notices.
     */
    async get_market_context() {
        try {
            const { data, error } = await supabase.rpc('get_tankiq_market_context');
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('TankIQ Tool [get_market_context] Error:', err);
            return { error: 'Failed to fetch market context.' };
        }
    }
};

/**
 * Tool Definitions for the AI Models
 */
export const TANKIQ_TOOLS_METADATA = [
    {
        type: 'function',
        function: {
            name: 'get_station_summary',
            description: 'Get a real-time summary of all tanks (volumes, capacities, fuel types) and currently active/unresolved alerts for the station.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_consumption_analytics',
            description: 'Get fuel consumption stats (total burn, avg daily burn) per tank over a specific number of days.',
            parameters: {
                type: 'object',
                properties: {
                    days: { type: 'number', description: 'Number of days to analyze (default: 7)' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_delivery_logs',
            description: 'Get a log of the most recent fuel deliveries recorded for the station.',
            parameters: {
                type: 'object',
                properties: {
                    limit: { type: 'number', description: 'Number of recent deliveries to fetch (default: 5)' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_market_context',
            description: 'Get current EPRA fuel prices in Kenya and recent regulatory notices or advisories.',
            parameters: { type: 'object', properties: {} }
        }
    }
];
