import { useState, useEffect } from 'react';
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
    const [shifts, setShifts] = useState<ShiftDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!stationId) {
            setLoading(false);
            return;
        }

        const fetchShifts = async () => {
            try {
                let query = supabase
                    .from('shift_closures')
                    .select('*')
                    .eq('station_id', stationId)
                    .order('closed_at', { ascending: false });

                if (options.startDate) {
                    query = query.gte('closed_at', options.startDate.toISOString());
                }

                if (options.endDate) {
                    const endOfDay = new Date(options.endDate);
                    endOfDay.setHours(23, 59, 59, 999);
                    query = query.lte('closed_at', endOfDay.toISOString());
                }

                if (options.tankId) {
                    query = query.eq('tank_id', options.tankId);
                }

                if (options.siteId) {
                    query = query.eq('site_id', options.siteId);
                }

                const { data, error: fetchError } = await query;

                if (fetchError) throw fetchError;

                const mappedShifts: ShiftDocument[] = (data || []).map(row => ({
                    ...row,
                    id: row.id,
                    tankId: row.tank_id,
                    siteId: row.site_id,
                    operatorId: row.operator_id,
                    operatorName: row.operator_name,
                    shiftType: row.shift_type,
                    openingReading: row.opening_reading,
                    closingReading: row.closing_reading,
                    openingDip: row.opening_dip,
                    closingDip: row.closing_dip,
                    salesVolume: row.sales_volume,
                    salesValue: row.sales_value,
                    cashCollected: row.cash_collected,
                    variance: row.variance,
                    status: row.status,
                    closedAt: row.closed_at,
                    notes: row.notes,
                    recordedAt: row.recorded_at,
                    metadata: row.metadata,
                    // Forensic Fields
                    received_collections: row.received_collections,
                    variance_data: row.variance_data
                } as unknown as ShiftDocument));

                setShifts(mappedShifts);
                setLoading(false);
                setError(null);
            } catch (err: any) {
                console.error('Error fetching shifts:', err);
                setError(err.message);
                setLoading(false);
            }
        };

        fetchShifts();

        const channel = supabase
            .channel(`shifts:${stationId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'shift_closures', filter: `station_id=eq.${stationId}` },
                () => fetchShifts()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [stationId, options.startDate, options.endDate, options.tankId, options.siteId]);

    return { shifts, loading, error };
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
        staleTime: 30 * 1000, 
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
            }, () => {
                queryClient.invalidateQueries({ queryKey: ['active_shift', stationId] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [stationId, queryClient]);

    return { activeShift: query.data || null, loading: query.isLoading, error: query.error as Error | null };
}
