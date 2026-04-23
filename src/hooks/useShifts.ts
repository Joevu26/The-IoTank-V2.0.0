import { useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { ShiftDocument } from '@/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface UseShiftsOptions {
    startDate?: Date;
    endDate?: Date;
    tankId?: string;
    siteId?: string;
}

interface UseShiftsReturn {
    shifts: ShiftDocument[];
    loading: boolean;
    error: string | null;
}

/**
 * Hook for Shift Operational Logs (Historical)
 */
export function useShifts(stationId: string, options: UseShiftsOptions = {}): UseShiftsReturn {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['shifts', stationId, options],
        queryFn: async () => {
            if (!stationId) return [];

            let sbQuery = supabase
                .from('shift_closures')
                .select('*')
                .eq('station_id', stationId)
                .order('closed_at', { ascending: false });

            if (options.startDate) {
                sbQuery = sbQuery.gte('closed_at', options.startDate.toISOString());
            }

            if (options.endDate) {
                const endOfDay = new Date(options.endDate);
                endOfDay.setHours(23, 59, 59, 999);
                sbQuery = sbQuery.lte('closed_at', endOfDay.toISOString());
            }

            if (options.tankId) {
                sbQuery = sbQuery.eq('tank_id', options.tankId);
            }

            if (options.siteId) {
                sbQuery = sbQuery.eq('site_id', options.siteId);
            }

            const { data, error } = await sbQuery;
            if (error) throw error;

            return (data || []).map(row => ({
                ...row,
                id: row.id,
                tankId: row.tank_id,
                siteId: row.site_id,
                received_collections: row.received_collections || {},
                variance_data: row.variance_data || {},
                
                openingReading: row.pump_readings ? (Object.values(row.pump_readings)[0] as any)?.start : 0,
                closingReading: row.pump_readings ? (Object.values(row.pump_readings)[0] as any)?.end : 0,
                salesVolume: row.volume_sold_liters || 0,
                variance: row.variance_data?.amount || 0,
                cashCollected: row.received_collections?.total || 0,
                
                openedAt: row.opened_at,
                closedAt: row.closed_at,
                operatorName: row.metadata?.opened_by?.display || row.metadata?.operator?.name || row.operator_name || 'Unknown',
                notes: row.supervisor_notes || row.notes,
                status: row.status,
                reviewState: row.review_state
            } as unknown as ShiftDocument));
        },
        enabled: !!stationId,
        staleTime: 5 * 1000,
    });

    useEffect(() => {
        if (!stationId) return;

        const channel = supabase
            .channel(`shifts-realtime:${stationId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'shift_closures', filter: `station_id=eq.${stationId}` },
                (payload) => {
                    console.log('[useShifts] Real-time event detected on shift_closures:', payload.eventType);
                    // Invalidate everything shift-related to be safe
                    queryClient.invalidateQueries({ queryKey: ['shifts'] });
                    queryClient.invalidateQueries({ queryKey: ['active_shift'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [stationId, queryClient]);

    return { 
        shifts: query.data || [], 
        loading: query.isLoading, 
        error: query.error ? (query.error as Error).message : null 
    };
}

/**
 * Hook for Active Shift Tracking (Continuous State)
 */
export function useActiveShift(stationId: string | undefined) {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['active_shift', stationId],
        queryFn: async () => {
            if (!stationId) return null;
            const { data, error } = await supabase
                .from('current_station_shifts')
                .select('*')
                .eq('station_id', stationId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data || null;
        },
        enabled: !!stationId,
        staleTime: 5 * 1000,
    });

    useEffect(() => {
        if (!stationId) return;

        const channel = supabase
            .channel(`active-shift:${stationId}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'current_station_shifts',
                filter: `station_id=eq.${stationId}` 
            }, (payload) => {
                console.log('[useActiveShift] Real-time event detected on current_station_shifts:', payload.eventType);
                queryClient.invalidateQueries({ queryKey: ['active_shift'] });
                queryClient.invalidateQueries({ queryKey: ['shifts'] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [stationId, queryClient]);

    return { activeShift: query.data || null, loading: query.isLoading, error: query.error as Error | null };
}
