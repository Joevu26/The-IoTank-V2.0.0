import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/config/supabase';
import { DeliveryDocument } from '@/types';

interface UseDeliveriesOptions {
    startDate?: string;
    endDate?: string;
    tankId?: string;
    status?: string;
}

export function useDeliveries(stationId: string, options: UseDeliveriesOptions = {}) {
    const [deliveries, setDeliveries] = useState<DeliveryDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDeliveries = useCallback(async () => {
        if (!stationId) return;

        setLoading(true);
        try {
            let query = supabase
                .from('deliveries')
                .select('*')
                .eq('station_id', stationId)
                .order('created_at', { ascending: false });

            if (options.startDate) {
                query = query.gte('created_at', options.startDate);
            }
            if (options.endDate) {
                query = query.lte('created_at', options.endDate);
            }
            if (options.tankId) {
                query = query.eq('tank_id', options.tankId);
            }
            if (options.status) {
                query = query.eq('status', options.status);
            }

            const { data, error: fetchError } = await query;

            if (fetchError) throw fetchError;

            // Map database fields to DeliveryDocument interface if needed
            // Based on types/index.ts, we might need to parse JSON fields
            const mappedDeliveries = (data || []).map(row => ({
                id: row.id,
                ts: row.ts || row.created_at,
                ts_day: row.ts_day,
                siteId: row.site_id,
                nodeId: row.node_id,
                tankId: row.tank_id,
                product: row.product,
                supplier: row.supplier,
                invoiceNo: row.invoice_no,
                invoiceLiters: row.invoice_liters,
                measured: typeof row.measured === 'string' ? JSON.parse(row.measured) : row.measured,
                before: typeof row.before === 'string' ? JSON.parse(row.before) : row.before,
                after: typeof row.after === 'string' ? JSON.parse(row.after) : row.after,
                variance: typeof row.variance === 'string' ? JSON.parse(row.variance) : row.variance,
                status: row.status,
                verified: row.verified,
                createdBy: typeof row.created_by === 'string' ? JSON.parse(row.created_by) : row.created_by,
                createdAt: row.created_at,
                notes: row.notes
            } as DeliveryDocument));

            setDeliveries(mappedDeliveries);
            setError(null);
        } catch (err: any) {
            console.error('Error fetching deliveries:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [stationId, options.startDate, options.endDate, options.tankId, options.status]);

    useEffect(() => {
        fetchDeliveries();

        // Real-time subscription
        const channel = supabase
            .channel(`deliveries-all-${stationId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'deliveries', filter: `station_id=eq.${stationId}` },
                () => fetchDeliveries()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchDeliveries, stationId]);

    return { deliveries, loading, error, refresh: fetchDeliveries };
}
