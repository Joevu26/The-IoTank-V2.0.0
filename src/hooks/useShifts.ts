import { useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { ShiftDocument } from '@/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/utils/logger';
import { validateUUID } from '@/utils/sanitization';

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

            if (options.tankId && validateUUID(options.tankId)) {
                sbQuery = sbQuery.eq('tank_id', options.tankId);
            }

            if (options.siteId) {
                sbQuery = sbQuery.eq('site_id', options.siteId);
            }

            const { data, error } = await sbQuery;
            if (error) throw error;

            return (data || []).map(row => {
                const pumpReadings = row.pump_readings || {};
                const readingsArray = Object.values(pumpReadings) as any[];
                
                // Aggregate data for multi-tank stations
                const totalOpening = readingsArray.reduce((sum, r) => sum + (r.start || 0), 0);
                const totalClosing = readingsArray.reduce((sum, r) => sum + (r.end || 0), 0);
                const totalSales = row.volume_sold_liters || 0;
                
                return {
                    ...row,
                    id: row.id,
                    tankId: row.tank_id,
                    siteId: row.site_id,
                    received_collections: row.received_collections || {},
                    variance_data: row.variance_data || {},
                    
                    openingReading: totalOpening,
                    closingReading: totalClosing,
                    salesVolume: totalSales,
                    variance: row.variance_data?.amount || 0,
                    cashCollected: row.received_collections?.total || 0,
                    
                    openedAt: row.opened_at,
                    closedAt: row.closed_at,
                    operatorName: row.metadata?.opened_by?.display || row.metadata?.operator?.name || row.operator_name || 'Unknown',
                    notes: row.supervisor_notes || row.notes,
                    status: row.status,
                    reviewState: row.review_state
                } as unknown as ShiftDocument;
            });
        },
        enabled: !!stationId,
        staleTime: 5 * 1000,
    });

    useEffect(() => {
        if (!stationId) return;

        const channelId = `shifts-realtime:${stationId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const channel = supabase
            .channel(channelId)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'shift_closures', filter: `station_id=eq.${stationId}` },
                (payload) => {
                    logger.debug('[useShifts] Real-time event detected on shift_closures:', payload.eventType, 'SHIFTS_RT');
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
                .maybeSingle();

            if (error) throw error;
            return data || null;
        },
        enabled: !!stationId,
        staleTime: 5 * 1000,
    });

    useEffect(() => {
        if (!stationId) return;

        const channelId = `active-shift:${stationId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const channel = supabase
            .channel(channelId)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'current_station_shifts',
                filter: `station_id=eq.${stationId}` 
            }, (payload) => {
                logger.debug('[useActiveShift] Real-time event detected on current_station_shifts:', payload.eventType, 'SHIFTS_RT');
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
