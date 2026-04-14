import { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { ShiftDocument } from '@/types';

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

        // Subscribe to changes
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
