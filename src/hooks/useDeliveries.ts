import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/config/supabase';
import { DeliveryDocument } from '@/types';
import { validateUUID } from '@/utils/sanitization';

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
                .select('*, tanks(fuel_type, tank_name)')  // Join tank to get product type
                .eq('station_id', stationId)
                .order('created_at', { ascending: false });

            if (options.startDate) {
                query = query.gte('created_at', options.startDate);
            }
            if (options.endDate) {
                query = query.lte('created_at', options.endDate);
            }
            if (options.tankId && validateUUID(options.tankId)) {
                query = query.eq('tank_id', options.tankId);
            }
            if (options.status) {
                query = query.eq('status', options.status);
            }

            const { data, error: fetchError } = await query;

            if (fetchError) throw fetchError;

            const mappedDeliveries = (data || []).map(row => {
                // variance_volume is a DB GENERATED COLUMN: bol_claimed_volume - actual_received_volume
                const varianceLiters = row.variance_volume !== null && row.variance_volume !== undefined
                    ? Number(row.variance_volume)
                    : (Number(row.bol_claimed_volume || 0) - Number(row.actual_received_volume || 0));
                const invoiceLiters = Number(row.bol_claimed_volume || 0);
                const variancePct = invoiceLiters > 0 ? (varianceLiters / invoiceLiters) * 100 : 0;

                const actualReceivedVol = Number(row.actual_received_volume || row.tank_after_volume || 0);
                const beforeVol = Number(row.tank_before_volume || 0);
                const afterVol  = Number(row.tank_after_volume || 0);
                const capacity  = Number(row.tanks?.capacity || row.capacity || 1);

                // Normalize DB status to DeliveryDocument union
                const rawStatus = (row.verification_status || row.status || '').toUpperCase();
                const status: 'VERIFIED' | 'NEEDS_REVIEW' | 'DISPUTED' =
                    rawStatus === 'VERIFIED' ? 'VERIFIED' :
                    rawStatus === 'DISPUTED' ? 'DISPUTED' : 'NEEDS_REVIEW';

                return {
                    id: row.id,
                    ts: row.delivery_date || row.created_at,
                    ts_day: row.delivery_date ? row.delivery_date.slice(0, 10) : (row.created_at || '').slice(0, 10),
                    siteId: row.site_id || '',
                    nodeId: row.node_id || '',
                    tankId: row.tank_id || '',
                    // Product comes from joined tank's fuel_type
                    product: row.tanks?.fuel_type || row.product || 'Unknown',
                    supplier: row.supplier_name || row.supplier || '',
                    invoiceNo: row.bol_number || row.invoice_no || '',
                    invoiceLiters,
                    // Full measured shape as required by DeliveryDocument
                    measured: {
                        observedLiters: actualReceivedVol,
                        standardizedLiters: actualReceivedVol, // Thermal correction not yet applied at this layer
                        tempC: Number(row.temperature_c || 20),
                        refTempC: 15
                    },
                    // Full before/after shape as required by DeliveryDocument
                    before: {
                        pct: capacity > 0 ? parseFloat(((beforeVol / capacity) * 100).toFixed(1)) : 0,
                        litersStd: beforeVol
                    },
                    after: {
                        pct: capacity > 0 ? parseFloat(((afterVol / capacity) * 100).toFixed(1)) : 0,
                        litersStd: afterVol
                    },
                    variance: {
                        liters: varianceLiters,
                        pct: parseFloat(variancePct.toFixed(2))
                    },
                    status,
                    verified: row.is_accepted === true,
                    createdBy: typeof row.created_by === 'string'
                        ? JSON.parse(row.created_by)
                        : (row.created_by || { kind: 'system', authUserId: '', display: 'System' }),
                    createdAt: row.created_at,
                    notes: row.dispute_notes || row.notes,
                    bolPhotoUrl: row.bol_photo_url
                } as unknown as DeliveryDocument;
            });

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

        // Real-time subscription: listen for INSERT and UPDATE (status changes)
        const channelId = `deliveries-all-${stationId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const channel = supabase
            .channel(channelId)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'deliveries', filter: `station_id=eq.${stationId}` },
                fetchDeliveries
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'deliveries', filter: `station_id=eq.${stationId}` },
                fetchDeliveries
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchDeliveries, stationId]);

    return { deliveries, loading, error, refresh: fetchDeliveries };
}
